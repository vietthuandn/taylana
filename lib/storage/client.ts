"use client";
/* Lưu trữ phía trình duyệt: xin link tải lên (/api/storage/upload-url) rồi PUT file THẲNG lên R2 (có tiến độ — thanh mảnh trên cùng
   trang, components/ui/UploadProgress.tsx), xin link đọc file riêng tư (/api/storage/read-url), xoá file (/api/storage/delete). */
export type UploadScope = "scrapbook" | "mockups" | "public-assets" | "order" | "design" | "share";
export type Uploaded = { key: string; path: string; url: string | null };
export type Progress = { id: string; loaded: number; total: number; done?: boolean };
export const UPLOAD_EVENT = "taylana-upload";

const emit = (p: Progress) => { try { window.dispatchEvent(new CustomEvent<Progress>(UPLOAD_EVENT, { detail: p })); } catch { /* bỏ qua */ } };
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Lỗi ${r.status}`);
  return j as T;
}

/** tải 1 file lên (khoá do server sinh). folder: thư mục con (vd "assets", "cutout/<font_id>", id đơn, id link chia sẻ) */
export async function uploadFile(scope: UploadScope, blob: Blob, o: { folder?: string; filename?: string; contentType?: string; onProgress?: (loaded: number, total: number) => void } = {}): Promise<Uploaded> {
  const contentType = o.contentType || blob.type || "application/octet-stream";
  const up = await post<{ url: string; headers: Record<string, string>; key: string; path: string; publicUrl: string | null }>("/api/storage/upload-url", { scope, folder: o.folder ?? "", filename: o.filename ?? "", contentType, size: blob.size });
  const id = up.key;
  await new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("PUT", up.url);
    for (const [k, v] of Object.entries(up.headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => { if (e.lengthComputable) { emit({ id, loaded: e.loaded, total: e.total }); o.onProgress?.(e.loaded, e.total); } };
    x.onload = () => (x.status >= 200 && x.status < 300 ? res() : rej(new Error(`Tải file lên thất bại (mã ${x.status})`)));
    x.onerror = () => rej(new Error("Lỗi mạng khi tải file lên"));
    emit({ id, loaded: 0, total: blob.size });
    x.send(blob);
  }).finally(() => emit({ id, loaded: blob.size, total: blob.size, done: true }));
  return { key: up.key, path: up.path, url: up.publicUrl };
}

const cache = new Map<string, { at: number; url: string }>();
const TTL = 50 * 60 * 1000; // link đọc hạn 1 giờ → làm mới sau 50 phút
/** link đọc (hạn 1 giờ) cho file riêng tư theo khoá; file không được phép xem → không có trong kết quả */
export async function readUrls(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}, need: string[] = [];
  for (const k of new Set(keys)) { const c = cache.get(k); if (c && Date.now() - c.at < TTL) out[k] = c.url; else need.push(k); }
  for (let i = 0; i < need.length; i += 500) {
    const { urls } = await post<{ urls: Record<string, string> }>("/api/storage/read-url", { keys: need.slice(i, i + 500) });
    for (const [k, u] of Object.entries(urls)) { cache.set(k, { at: Date.now(), url: u }); out[k] = u; }
  }
  return out;
}
export async function readUrl(key: string) { return (await readUrls([key]))[key] ?? null; }
/** tải nội dung file riêng tư về (thay cho storage.download) */
export async function downloadPrivate(key: string): Promise<Blob | null> {
  const u = await readUrl(key).catch(() => null);
  if (!u) return null;
  const r = await fetch(u).catch(() => null);
  return r?.ok ? r.blob() : null;
}

/** xoá file: theo khoá, theo link công khai, hoặc cả thư mục (prefixes: "mockup-shares/<id>/") */
export async function deleteFiles(o: { keys?: string[]; urls?: (string | null | undefined)[]; prefixes?: string[] }) {
  const urls = (o.urls ?? []).filter((u): u is string => !!u);
  if (!o.keys?.length && !urls.length && !o.prefixes?.length) return 0;
  return (await post<{ deleted: number }>("/api/storage/delete", { keys: o.keys ?? [], urls, prefixes: o.prefixes ?? [] })).deleted;
}
export async function storageUsage(prefix: string) {
  const r = await fetch(`/api/storage/usage?prefix=${encodeURIComponent(prefix)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Lỗi");
  return j as { file_count: number; total_bytes: number };
}
