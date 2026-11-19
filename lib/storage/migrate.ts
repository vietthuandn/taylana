import "server-only";
/* Tự chuyển file cũ từ Supabase Storage sang R2 — chạy trên Vercel, mỗi lần lịch dọn link chia sẻ gọi (15 phút / lần) xử lý 1 đợt
   (tối đa ~200 file / ~4 phút), cho tới khi xong thì tự dừng. Giữ nguyên khoá "<bucket>/<đường dẫn>".
   Xong file → đổi link ảnh công khai trong database (…supabase.co/storage/v1/object/public/<khoá> → <NEXT_PUBLIC_R2_PUBLIC_URL>/<khoá>).
   KHÔNG xoá gì trên Supabase Storage. Chạy lại không trùng (file đã có trên R2 cùng dung lượng → bỏ qua).
   Tiến độ + nhật ký lưu ở bucket R2 riêng tư (_system/r2-migration.json) — chỉ admin xem ở trang Dọn file. */
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { serviceClient } from "@/lib/supabase/service";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { CACHE_PUBLIC, PROVIDER, bucketName, r2 } from "./index";
import { R2_PUBLIC_URL } from "./keys";

const BUCKETS = ["scrapbook", "mockups", "public-assets", "order-files", "design-assets", "mockup-shares"];
const PUBLIC = ["scrapbook", "mockups", "public-assets"];
const STATUS_KEY = "_system/r2-migration.json";
const BATCH = 200, BUDGET_MS = 240_000;
const TABLES: Record<string, string[]> = {
  site_settings: ["key"], scrapbook_template_settings: ["surface_type", "n", "style"], home_variant_notes: ["variant_id"],
  packages: ["id"], products: ["id"], options: ["id"], option_groups: ["id"], addons: ["id"], showcase_items: ["id"], reviews: ["id"],
  guide_sections: ["id"], design_templates: ["id"], photostrip_frames: ["id"], canva_templates: ["id"], mockup_frames: ["id"], mockup_backgrounds: ["id"],
  scrapbook_assets: ["id"], scrapbook_templates: ["id"], frames: ["id"], frame_sets: ["id"], cutout_fonts: ["id"], cutout_glyphs: ["id"],
  wish_topics: ["id"], wishes: ["id"], designs: ["id"], mockup_shares: ["id"], order_items: ["id"], cart_items: ["id"],
};

export type MigrationStatus = {
  phase: "files" | "db" | "done"; cursor: number; total: number; copied: number; skipped: number; failed: number; rows: number;
  failedKeys: string[]; startedAt: string; updatedAt: string; finishedAt: string | null; runningUntil: number; log: string[]; error?: string;
};
const fresh = (): MigrationStatus => ({ phase: "files", cursor: 0, total: 0, copied: 0, skipped: 0, failed: 0, rows: 0, failedKeys: [], startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null, runningUntil: 0, log: [] });

export async function readMigrationStatus(): Promise<MigrationStatus | null> {
  if (PROVIDER !== "r2") return null;
  try {
    const r = await r2().send(new GetObjectCommand({ Bucket: bucketName("private"), Key: STATUS_KEY }));
    return JSON.parse(await r.Body!.transformToString()) as MigrationStatus;
  } catch { return null; }
}
async function save(s: MigrationStatus) {
  s.updatedAt = new Date().toISOString();
  s.log = s.log.slice(-300); s.failedKeys = s.failedKeys.slice(-500);
  await r2().send(new PutObjectCommand({ Bucket: bucketName("private"), Key: STATUS_KEY, Body: JSON.stringify(s), ContentType: "application/json" }));
}
const stamp = () => new Date().toISOString().slice(11, 19);

type Sb = NonNullable<ReturnType<typeof serviceClient>>;
async function listBucket(sb: Sb, bucket: string, dir = "", depth = 0): Promise<{ key: string; path: string; size: number; type: string }[]> {
  const out: { key: string; path: string; size: number; type: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(dir, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) { if (/not found/i.test(error.message)) return out; throw new Error(`${bucket}/${dir}: ${error.message}`); }
    for (const f of data ?? []) {
      const path = dir ? `${dir}/${f.name}` : f.name;
      const meta = (f.metadata ?? {}) as { size?: number; mimetype?: string };
      if (f.id) out.push({ key: `${bucket}/${path}`, path, size: Number(meta.size ?? 0), type: meta.mimetype || "application/octet-stream" });
      else if (depth < 10) out.push(...(await listBucket(sb, bucket, path, depth + 1)));
    }
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
async function r2Size(Bucket: string, Key: string) {
  try { return (await r2().send(new HeadObjectCommand({ Bucket, Key }))).ContentLength ?? 0; } catch { return -1; }
}
async function copy(sb: Sb, f: { key: string; path: string; size: number; type: string }) {
  const root = f.key.split("/")[0], pub = PUBLIC.includes(root), Bucket = bucketName(pub ? "public" : "private");
  const have = await r2Size(Bucket, f.key);
  if (have >= 0 && (have === f.size || !f.size)) return "skip" as const;
  const { data, error } = await sb.storage.from(root).download(f.path);
  if (error || !data) throw new Error(error?.message ?? "không tải được");
  const body = Buffer.from(await data.arrayBuffer());
  await r2().send(new PutObjectCommand({ Bucket, Key: f.key, Body: body, ContentType: f.type, ContentLength: body.length, ...(pub ? { CacheControl: CACHE_PUBLIC } : {}) }));
  return "copy" as const;
}

/** 1 đợt chuyển dữ liệu. Đã xong / thiếu cấu hình / đợt trước còn chạy → không làm gì. */
export async function runMigrationBatch() {
  if (PROVIDER !== "r2" || !R2_PUBLIC_URL || !process.env.R2_ACCOUNT_ID) return { ok: false, reason: "chưa cấu hình R2" };
  const sb = serviceClient();
  if (!sb) return { ok: false, reason: "thiếu SUPABASE_SERVICE_ROLE_KEY" };
  const s = (await readMigrationStatus()) ?? fresh();
  if (s.phase === "done") return { ok: true, reason: "đã xong" };
  if (Date.now() < s.runningUntil) return { ok: true, reason: "đợt trước đang chạy" };
  const t0 = Date.now();
  s.runningUntil = t0 + BUDGET_MS + 60_000; s.error = undefined;
  await save(s);
  try {
    if (s.phase === "files") {
      const files: { key: string; path: string; size: number; type: string }[] = [];
      for (const b of BUCKETS) files.push(...(await listBucket(sb, b)));
      s.total = files.length;
      let n = 0;
      while (s.cursor < files.length && n < BATCH && Date.now() - t0 < BUDGET_MS) {
        const f = files[s.cursor];
        try { const r = await copy(sb, f); if (r === "copy") { s.copied++; s.log.push(`${stamp()} + đã chép ${f.key}`); } else s.skipped++; s.failedKeys = s.failedKeys.filter((k) => k !== f.key); }
        catch (e) { s.failed++; if (!s.failedKeys.includes(f.key)) s.failedKeys.push(f.key); s.log.push(`${stamp()} ! lỗi ${f.key}: ${e instanceof Error ? e.message : e}`); }
        s.cursor++; n++;
        if (n % 25 === 0) await save(s);
      }
      // hết danh sách: thử lại file lỗi 1 lần rồi sang bước đổi link
      if (s.cursor >= files.length && Date.now() - t0 < BUDGET_MS) {
        for (const k of [...s.failedKeys]) {
          const f = files.find((x) => x.key === k);
          if (!f) { s.failedKeys = s.failedKeys.filter((x) => x !== k); continue; }
          try { await copy(sb, f); s.failedKeys = s.failedKeys.filter((x) => x !== k); s.log.push(`${stamp()} + thử lại được ${k}`); } catch { /* để lại danh sách lỗi */ }
        }
        s.phase = "db"; s.log.push(`${stamp()} Xong phần file: ${s.copied} đã chép · ${s.skipped} đã có · ${s.failedKeys.length} còn lỗi`);
      }
    }
    if (s.phase === "db" && Date.now() - t0 < BUDGET_MS) {
      const OLD = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/`, NEW = `${R2_PUBLIC_URL}/`;
      const swap = (v: unknown): unknown => typeof v === "string" ? (v.includes(OLD) ? v.split(OLD).join(NEW) : v)
        : Array.isArray(v) ? v.map(swap) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)])) : v;
      for (const [t, pk] of Object.entries(TABLES)) {
        for (let from = 0; ; from += 500) {
          const { data, error } = await sb.from(t).select("*").range(from, from + 499);
          if (error) break; // bảng chưa có → bỏ qua
          for (const r of (data ?? []) as Record<string, unknown>[]) {
            if (!JSON.stringify(r).includes(OLD)) continue;
            const patch: Record<string, unknown> = {};
            for (const [c, v] of Object.entries(r)) { const nv = swap(v); if (JSON.stringify(nv) !== JSON.stringify(v)) patch[c] = nv; }
            const { error: ue } = await sb.from(t).update(patch).match(Object.fromEntries(pk.map((k) => [k, r[k]])));
            if (ue) s.log.push(`${stamp()} ! lỗi đổi link ${t}: ${ue.message}`); else s.rows++;
          }
          if ((data ?? []).length < 500) break;
        }
      }
      s.phase = "done"; s.finishedAt = new Date().toISOString();
      s.log.push(`${stamp()} Đã chuyển xong — ${s.rows} dòng database đã đổi link ảnh sang R2`);
    }
  } catch (e) {
    s.error = e instanceof Error ? e.message : String(e);
    s.log.push(`${stamp()} ! dừng đợt này: ${s.error} (lần sau tự chạy tiếp)`);
  }
  s.runningUntil = 0;
  await save(s);
  return { ok: true, phase: s.phase, cursor: s.cursor, total: s.total };
}
