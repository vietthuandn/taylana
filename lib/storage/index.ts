import "server-only";
/* Lớp lưu trữ chung (CHỈ server): Cloudflare R2 (mặc định) hoặc Supabase Storage (STORAGE_PROVIDER=supabase để quay lại nhanh).
   Key bí mật R2 / service role chỉ đọc ở đây — không bao giờ ra trình duyệt. Khoá file: xem lib/storage/keys.ts. */
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serviceClient } from "@/lib/supabase/service";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { R2_PUBLIC_URL, isPublicKey, rootOf } from "./keys";

export const PROVIDER: "r2" | "supabase" = process.env.STORAGE_PROVIDER === "supabase" ? "supabase" : "r2";
export const CACHE_PUBLIC = "public, max-age=31536000, immutable";
export type BucketKind = "public" | "private";

let s3: S3Client | null = null;
function r2() {
  const id = process.env.R2_ACCOUNT_ID, ak = process.env.R2_ACCESS_KEY_ID, sk = process.env.R2_SECRET_ACCESS_KEY;
  if (!id || !ak || !sk) throw new Error("Thiếu biến môi trường R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  return (s3 ??= new S3Client({ region: "auto", endpoint: `https://${id}.r2.cloudflarestorage.com`, credentials: { accessKeyId: ak, secretAccessKey: sk } }));
}
const bucketName = (k: BucketKind) => {
  const b = k === "public" ? process.env.R2_PUBLIC_BUCKET : process.env.R2_PRIVATE_BUCKET;
  if (!b) throw new Error(`Thiếu biến môi trường ${k === "public" ? "R2_PUBLIC_BUCKET" : "R2_PRIVATE_BUCKET"}`);
  return b;
};
const kindOf = (key: string): BucketKind => (isPublicKey(key) ? "public" : "private");
/** Supabase: khoá "bucket/đường/dẫn" → [bucket, đường dẫn] */
const split = (key: string) => [rootOf(key), key.slice(rootOf(key).length + 1)] as const;
function svc() {
  const sb = serviceClient();
  if (!sb) throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY");
  return sb;
}

/** URL tải lên trực tiếp từ trình duyệt (PUT, hạn 10 phút). Trình duyệt phải gửi đúng các header trả về. */
export async function getUploadUrl(bucket: BucketKind, key: string, contentType: string, maxSize: number, size = maxSize) {
  if (size > maxSize) throw new Error("File quá lớn");
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (bucket === "public") headers["Cache-Control"] = CACHE_PUBLIC;
  if (PROVIDER === "supabase") {
    const [b, p] = split(key);
    const { data, error } = await svc().storage.from(b).createSignedUploadUrl(p);
    if (error || !data) throw new Error(error?.message ?? "Không tạo được link tải lên");
    return { url: data.signedUrl, headers: { ...headers, "x-upsert": "false" } };
  }
  const cmd = new PutObjectCommand({ Bucket: bucketName(bucket), Key: key, ContentType: contentType, ContentLength: size, ...(bucket === "public" ? { CacheControl: CACHE_PUBLIC } : {}) });
  const url = await getSignedUrl(r2(), cmd, { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length", "cache-control"]) });
  return { url, headers };
}

export function getPublicUrl(key: string) {
  if (PROVIDER === "supabase") return `${SUPABASE_URL}/storage/v1/object/public/${key.split("/").map(encodeURIComponent).join("/")}`;
  return `${R2_PUBLIC_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** link đọc file riêng tư (mặc định 1 giờ) */
export async function getSignedReadUrl(key: string, expiresIn = 3600) {
  if (PROVIDER === "supabase") {
    const [b, p] = split(key);
    const { data } = await svc().storage.from(b).createSignedUrl(p, expiresIn);
    return data?.signedUrl ?? null;
  }
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucketName(kindOf(key)), Key: key }), { expiresIn: Math.min(expiresIn, 7 * 24 * 3600) });
}
export async function getSignedReadUrls(keys: string[], expiresIn = 3600) {
  const out: Record<string, string> = {};
  await Promise.all(keys.map(async (k) => { const u = await getSignedReadUrl(k, expiresIn).catch(() => null); if (u) out[k] = u; }));
  return out;
}

async function deleteKeys(keys: string[]) {
  if (!keys.length) return 0;
  if (PROVIDER === "supabase") {
    const by = new Map<string, string[]>();
    for (const k of keys) { const [b, p] = split(k); by.set(b, [...(by.get(b) ?? []), p]); }
    for (const [b, ps] of by) for (let i = 0; i < ps.length; i += 100) { const r = await svc().storage.from(b).remove(ps.slice(i, i + 100)); if (r.error) throw new Error(r.error.message); }
    return keys.length;
  }
  const by = new Map<BucketKind, string[]>();
  for (const k of keys) by.set(kindOf(k), [...(by.get(kindOf(k)) ?? []), k]);
  for (const [b, ks] of by) for (let i = 0; i < ks.length; i += 1000) {
    const r = await r2().send(new DeleteObjectsCommand({ Bucket: bucketName(b), Delete: { Objects: ks.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    if (r.Errors?.length) throw new Error(r.Errors[0].Message ?? "Xoá file thất bại");
  }
  return keys.length;
}
export const deleteObject = (key: string) => deleteKeys([key]);
export const deleteObjects = (keys: string[]) => deleteKeys([...new Set(keys)]);

/** liệt kê mọi file có tiền tố (đệ quy) */
async function list(prefix: string): Promise<{ key: string; size: number }[]> {
  const out: { key: string; size: number }[] = [];
  if (PROVIDER === "supabase") {
    const [b, p0] = split(prefix.endsWith("/") ? prefix : `${prefix}/`);
    const walk = async (dir: string, depth: number) => {
      for (let offset = 0; ; offset += 1000) {
        const { data } = await svc().storage.from(b).list(dir.replace(/\/$/, ""), { limit: 1000, offset });
        for (const f of data ?? []) {
          const path = dir ? `${dir.replace(/\/$/, "")}/${f.name}` : f.name;
          if (f.id) out.push({ key: `${b}/${path}`, size: Number((f.metadata as { size?: number } | null)?.size ?? 0) });
          else if (depth < 6) await walk(path, depth + 1);
        }
        if ((data ?? []).length < 1000) break;
      }
    };
    await walk(p0, 0);
    return out;
  }
  let token: string | undefined;
  do {
    const r = await r2().send(new ListObjectsV2Command({ Bucket: bucketName(kindOf(prefix)), Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of r.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0 });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}
/** xoá mọi file có tiền tố (vd "mockup-shares/<id>/") */
export async function deletePrefix(prefix: string) {
  if (!prefix.endsWith("/") || prefix.split("/").filter(Boolean).length < 2) throw new Error("Tiền tố không hợp lệ");
  return deleteKeys((await list(prefix)).map((f) => f.key));
}
/** dung lượng + số file theo tiền tố (vd "order-files/") */
export async function getBucketUsage(prefix: string) {
  const files = await list(prefix);
  return { file_count: files.length, total_bytes: files.reduce((t, f) => t + f.size, 0) };
}

/** dung lượng gói miễn phí (R2: 10GB · Supabase Free: 1GB) */
export const STORAGE_QUOTA = PROVIDER === "r2" ? 10 * 1024 ** 3 : 1024 ** 3;
/** dung lượng theo từng thư mục gốc (trang Tổng quan, Dọn file) */
export async function storageUsageRows() {
  const roots = ["order-files", "public-assets", "scrapbook", "mockups", "design-assets", "mockup-shares"];
  try {
    const rows = await Promise.all(roots.map(async (r) => ({ bucket: r, ...(await getBucketUsage(`${r}/`)) })));
    return { data: rows.filter((r) => r.file_count > 0), error: null };
  } catch (e) { return { data: [], error: { message: e instanceof Error ? e.message : "Không đọc được dung lượng" } }; }
}
