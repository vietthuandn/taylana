/* Google Drive (link chia sẻ công khai) → ảnh, chạy TRÊN TRÌNH DUYỆT bằng NEXT_PUBLIC_GOOGLE_API_KEY (không qua server Vercel).
   · nhận link thư mục /drive/folders/<id>, link file /file/d/<id>, hoặc ?id=<id>
   · thư mục: files.list (có phân trang), duyệt thư mục con tối đa 2 cấp, CHỈ lấy ảnh (jpeg, png, webp, heic…), đếm file bỏ qua
   · tải: files.get?alt=media&key=… (fetch thẳng) — bị chặn thì qua /api/img-proxy · HEIC → JPG (heic2any) · tối đa 30MB / ảnh */

export const DRIVE_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
export const driveEnabled = !!DRIVE_KEY;
export const DRIVE_MAX_BYTES = 30 * 1024 * 1024;
export const DRIVE_MAX_FILES = 60;
const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";

export type DriveFile = { id: string; name: string; mimeType: string; size: number; thumb: string | null; folder: string }; // folder = tên thư mục con (gợi ý xếp ô)
export class DriveError extends Error {}
const ERR_ACCESS = "Không đọc được thư mục. Kiểm tra quyền chia sẻ: Bất kỳ ai có đường liên kết.";

/** link Drive → { kind, id } */
export function parseDriveLink(link: string): { kind: "folder" | "file"; id: string } | null {
  const s = link.trim();
  let m = s.match(/\/folders\/([\w-]{10,})/);
  if (m) return { kind: "folder", id: m[1] };
  m = s.match(/\/file\/d\/([\w-]{10,})/) ?? s.match(/\/d\/([\w-]{10,})/);
  if (m) return { kind: "file", id: m[1] };
  m = s.match(/[?&]id=([\w-]{10,})/);
  if (m) return { kind: /folder/i.test(s) ? "folder" : "file", id: m[1] };
  return /^[\w-]{20,}$/.test(s) ? { kind: "folder", id: s } : null;
}

const isImage = (mime: string, name: string) => mime.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
type Raw = { id: string; name: string; mimeType: string; size?: string; thumbnailLink?: string };
const FIELDS = "id,name,mimeType,size,thumbnailLink,imageMediaMetadata(width,height)";

async function getJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new DriveError(ERR_ACCESS);
  return r.json();
}
async function listFolder(id: string) {
  const out: Raw[] = [];
  let page = "";
  do {
    const q = new URLSearchParams({ q: `'${id}' in parents and trashed=false`, fields: `nextPageToken,files(${FIELDS})`, pageSize: "1000", key: DRIVE_KEY, supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    if (page) q.set("pageToken", page);
    const j = await getJson(`${API}?${q}`);
    out.push(...((j.files ?? []) as Raw[]));
    page = j.nextPageToken ?? "";
  } while (page);
  return out;
}

/** đọc link: danh sách ảnh + số file bỏ qua (nhạc, video, pdf, zip…) */
export async function readDriveLink(link: string): Promise<{ files: DriveFile[]; skipped: number }> {
  if (!DRIVE_KEY) throw new DriveError("Chưa cấu hình Google API key.");
  const p = parseDriveLink(link);
  if (!p) throw new DriveError(ERR_ACCESS);
  const files: DriveFile[] = [];
  let skipped = 0;
  const take = (f: Raw, folder: string) => {
    if (isImage(f.mimeType, f.name)) files.push({ id: f.id, name: f.name, mimeType: f.mimeType, size: Number(f.size ?? 0), thumb: f.thumbnailLink ?? null, folder });
    else skipped++;
  };
  if (p.kind === "file") {
    const f = (await getJson(`${API}/${p.id}?${new URLSearchParams({ fields: FIELDS, key: DRIVE_KEY, supportsAllDrives: "true" })}`)) as Raw;
    if (f.mimeType !== FOLDER) { take(f, ""); return { files, skipped }; }
  }
  // thư mục: cấp 0 + thư mục con tối đa 2 cấp
  const walk = async (id: string, folder: string, depth: number) => {
    for (const f of await listFolder(id)) {
      if (f.mimeType === FOLDER) { if (depth < 2) await walk(f.id, folder ? `${folder} ${f.name}` : f.name, depth + 1); }
      else take(f, folder);
    }
  };
  await walk(p.id, "", 0);
  files.sort((a, b) => (a.folder + a.name).localeCompare(b.folder + b.name, "vi", { numeric: true }));
  return { files, skipped };
}

/** tải 1 ảnh Drive → File (HEIC → JPG) */
export async function downloadDriveFile(f: DriveFile): Promise<File> {
  if (f.size > DRIVE_MAX_BYTES) throw new DriveError(`${f.name}: ảnh lớn hơn 30MB`);
  const url = `${API}/${f.id}?alt=media&key=${DRIVE_KEY}&supportsAllDrives=true`;
  let blob: Blob | null = null;
  try { const r = await fetch(url); if (r.ok) blob = await r.blob(); } catch { /* CORS → thử qua proxy */ }
  if (!blob) {
    const r = await fetch(`/api/img-proxy?url=${encodeURIComponent(url)}`);
    if (!r.ok) throw new DriveError(`${f.name}: không tải được (${r.status === 401 || r.status === 403 ? "cần đăng nhập hoặc quyền chia sẻ" : r.status})`);
    blob = await r.blob();
  }
  if (blob.size > DRIVE_MAX_BYTES) throw new DriveError(`${f.name}: ảnh lớn hơn 30MB`);
  let name = f.name, type = blob.type && blob.type !== "application/octet-stream" ? blob.type : f.mimeType;
  if (/hei[cf]/i.test(type) || /\.hei[cf]$/i.test(name)) {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
    blob = Array.isArray(out) ? out[0] : out;
    name = name.replace(/\.hei[cf]$/i, "") + ".jpg"; type = "image/jpeg";
  }
  return new File([blob], name, { type });
}

/** tải nhiều ảnh, 3 file song song, báo tiến độ; lỗi từng file không dừng cả lượt */
export async function downloadDriveFiles<T extends { file: DriveFile }>(items: T[], onProgress: (done: number, total: number) => void) {
  const out: (T & { blob: File })[] = [], errors: string[] = [];
  let i = 0, done = 0;
  const worker = async () => {
    while (i < items.length) {
      const it = items[i++];
      try { out.push({ ...it, blob: await downloadDriveFile(it.file) }); } catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
      onProgress(++done, items.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { out, errors };
}
