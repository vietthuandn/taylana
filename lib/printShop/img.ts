"use client";
/* Bàn in — ảnh trên máy: kích thước, ảnh thu nhỏ (bộ nhớ đệm), đọc thư mục / file .zip kéo thả, ghép thư mục ↔ đơn. */
import { fold } from "./types";

export const IMG_RE = /\.(jpe?g|png|webp|tiff?|bmp|heic|heif|jfif)$/i;
export async function dims(blob: Blob) {
  try { const b = await createImageBitmap(blob); const r = { w: b.width, h: b.height }; b.close(); return r; } catch { return { w: 0, h: 0 }; }
}
const thumbs = new Map<string, Promise<string>>();
/** ảnh thu nhỏ (~360px, JPEG) — nhớ theo khoá + thời điểm lưu */
export function thumbUrl(key: string, blob: Blob, at: number) {
  const k = `${key}@${at}`;
  let p = thumbs.get(k);
  if (!p) {
    p = (async () => {
      try {
        const b = await createImageBitmap(blob), s = Math.min(1, 360 / Math.max(b.width, b.height));
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(b.width * s)); c.height = Math.max(1, Math.round(b.height * s));
        c.getContext("2d")!.drawImage(b, 0, 0, c.width, c.height); b.close();
        return await new Promise<string>((res) => c.toBlob((x) => res(x ? URL.createObjectURL(x) : URL.createObjectURL(blob)), "image/jpeg", 0.85));
      } catch { return URL.createObjectURL(blob); }
    })();
    thumbs.set(k, p);
  }
  return p;
}

export type Folder = { name: string; files: File[] };
type Entry = { isFile: boolean; isDirectory: boolean; name: string; file?: (cb: (f: File) => void, err: (e: unknown) => void) => void; createReader?: () => { readEntries: (cb: (e: Entry[]) => void, err: (e: unknown) => void) => void } };
async function walk(e: Entry, out: File[]) {
  if (e.isFile && e.file) { const f = await new Promise<File>((res, rej) => e.file!(res, rej)); if (IMG_RE.test(f.name)) out.push(f); return; }
  if (e.isDirectory && e.createReader) {
    const r = e.createReader();
    for (;;) { const batch = await new Promise<Entry[]>((res, rej) => r.readEntries(res, rej)); if (!batch.length) break; for (const c of batch) await walk(c, out); }
  }
}
/** thư mục lớn kéo thả: mỗi thư mục con = 1 đơn (tên thư mục ≈ username / mã đơn) */
export async function foldersFromDrop(dt: DataTransfer): Promise<Folder[]> {
  const entries = [...dt.items].map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.()).filter(Boolean) as Entry[];
  const out: Folder[] = [];
  const zips = [...dt.files].filter((f) => /\.zip$/i.test(f.name));
  for (const z of zips) out.push(...(await foldersFromZip(z)));
  for (const e of entries) {
    if (!e.isDirectory || !e.createReader) continue;
    const r = e.createReader(), kids: Entry[] = [];
    for (;;) { const b = await new Promise<Entry[]>((res, rej) => r.readEntries(res, rej)); if (!b.length) break; kids.push(...b); }
    const subs = kids.filter((k) => k.isDirectory);
    if (subs.length) for (const s of subs) { const fs: File[] = []; await walk(s, fs); if (fs.length) out.push({ name: s.name, files: fs }); }
    else { const fs: File[] = []; await walk(e, fs); if (fs.length) out.push({ name: e.name, files: fs }); }
  }
  return out;
}
export async function foldersFromZip(z: File): Promise<Folder[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(z);
  const by = new Map<string, File[]>();
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && IMG_RE.test(n) && !n.startsWith("__MACOSX"));
  const parts = names.map((n) => n.split("/"));
  const root = parts.length && parts.every((p) => p.length > 2 && p[0] === parts[0][0]) ? 1 : 0; // zip có 1 thư mục gốc bao ngoài
  for (const [i, n] of names.entries()) {
    const p = parts[i], dir = p.length > root + 1 ? p[root] : z.name.replace(/\.zip$/i, "");
    const blob = await zip.files[n].async("blob");
    by.set(dir, [...(by.get(dir) ?? []), new File([blob], p[p.length - 1], { type: /png$/i.test(n) ? "image/png" : "image/jpeg" })]);
  }
  return [...by.entries()].map(([name, files]) => ({ name, files }));
}
/** độ giống 2 chuỗi (0..1) — Levenshtein */
export function similar(a: string, b: string) {
  a = fold(a).replace(/[^a-z0-9]/g, ""); b = fold(b).replace(/[^a-z0-9]/g, "");
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.5 + 0.5;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}
