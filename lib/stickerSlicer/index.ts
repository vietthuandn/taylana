"use client";
/* Tách tờ sticker (trình duyệt): đọc ảnh → thu nhỏ ≤ 4000px → Web Worker xoá nền + tách món → các món (mặt nạ riêng) để duyệt.
   Mỗi món giữ 1 mặt nạ trong khung bao: 0 = bỏ · 1 = giữ pixel đã xoá nền · 2 = khôi phục pixel gốc (cọ khôi phục). */
import { TONES } from "@/lib/scrapbook/types";
import type { SliceParams, SliceResult } from "./core";

export const MAX_SIDE = 4000;
export type Sheet = { w: number; h: number; orig: Uint8ClampedArray; res: SliceResult };
export type Item = { key: string; x0: number; y0: number; x1: number; y1: number; mask: Uint8Array; name: string; grp: string; tone: string; checked: boolean };

/** Ảnh → dữ liệu pixel (thu nhỏ nếu cạnh dài > 4000px) */
export async function readSheet(src: Blob): Promise<{ w: number; h: number; data: Uint8ClampedArray }> {
  const bmp = await createImageBitmap(src);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high"; x.drawImage(bmp, 0, 0, w, h); bmp.close();
  return { w, h, data: x.getImageData(0, 0, w, h).data };
}
export function runSlice(data: Uint8ClampedArray, w: number, h: number, params: SliceParams): Promise<SliceResult> {
  return new Promise((res, rej) => {
    const wk = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    wk.onmessage = (e) => { wk.terminate(); if (e.data.ok) res(e.data as SliceResult); else rej(new Error(e.data.error)); };
    wk.onerror = (e) => { wk.terminate(); rej(new Error(e.message || "Lỗi xử lý ảnh")); };
    const copy = new Uint8ClampedArray(data);
    wk.postMessage({ data: copy, w, h, params }, [copy.buffer]);
  });
}

const PAD = 4;
const nearestTone = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 24) return max > 200 ? "cream" : "mono";
  let best = "any", bd = Infinity;
  for (const t of TONES) {
    if (t.id === "any" || t.id === "mono") continue;
    const R = parseInt(t.hex.slice(1, 3), 16), G = parseInt(t.hex.slice(3, 5), 16), B = parseInt(t.hex.slice(5, 7), 16);
    const dd = (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2;
    if (dd < bd) { bd = dd; best = t.id; }
  }
  return best;
};
/** tông màu chủ đạo + nhóm gợi ý (dài / rộng > 3 → băng dính) */
export function guess(sheet: Sheet, it: Pick<Item, "x0" | "y0" | "x1" | "y1" | "mask">) {
  const { w } = sheet, bw = it.x1 - it.x0 + 1, bh = it.y1 - it.y0 + 1, d = sheet.res.rgba;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < bh; y += 2) for (let x = 0; x < bw; x += 2) {
    if (!it.mask[y * bw + x]) continue;
    const i = ((it.y0 + y) * w + it.x0 + x) * 4;
    if (d[i + 3] < 128) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  const ratio = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
  return { tone: n ? nearestTone(r / n, g / n, b / n) : "any", grp: ratio > 3 ? "tape" : "sticker" };
}
let seq = 0;
const nameOf = (grp: string, i: number) => `${grp === "tape" ? "Băng dính" : grp === "frame" ? "Khung" : grp === "doodle" ? "Doodle" : grp === "paper" ? "Mảnh giấy" : grp === "texture" ? "Texture" : "Sticker"} ${String(i).padStart(2, "0")}`;
/** món từ 1 vùng liền khối: khung bao + lề 4px, chỉ giữ pixel thuộc đúng vùng (pixel của món bên cạnh bị bỏ) */
export function itemsFromSheet(sheet: Sheet, defGrp: string | null): Item[] {
  const { w, h } = sheet, L = sheet.res.labels, d = sheet.res.rgba;
  return sheet.res.comps.map((c, i) => {
    const x0 = Math.max(0, c.x0 - PAD), y0 = Math.max(0, c.y0 - PAD), x1 = Math.min(w - 1, c.x1 + PAD), y1 = Math.min(h - 1, c.y1 + PAD);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, mask = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const p = (y0 + y) * w + x0 + x;
      if (L[p] === c.id && d[p * 4 + 3] > 0) mask[y * bw + x] = 1;
    }
    const base = { x0, y0, x1, y1, mask };
    const gs = guess(sheet, base);
    const grp = defGrp ?? gs.grp;
    return { key: `it${seq++}`, ...base, grp, tone: gs.tone, name: nameOf(grp, i + 1), checked: true };
  });
}
/** gộp nhiều món thành 1 (hợp các mặt nạ trên khung bao chung) */
export function mergeItems(sheet: Sheet, list: Item[]): Item {
  const x0 = Math.min(...list.map((i) => i.x0)), y0 = Math.min(...list.map((i) => i.y0)), x1 = Math.max(...list.map((i) => i.x1)), y1 = Math.max(...list.map((i) => i.y1));
  const bw = x1 - x0 + 1, mask = new Uint8Array(bw * (y1 - y0 + 1));
  for (const it of list) {
    const iw = it.x1 - it.x0 + 1;
    for (let y = it.y0; y <= it.y1; y++) for (let x = it.x0; x <= it.x1; x++) { const v = it.mask[(y - it.y0) * iw + (x - it.x0)]; if (v) mask[(y - y0) * bw + (x - x0)] = Math.max(mask[(y - y0) * bw + (x - x0)], v); }
  }
  return { ...list[0], key: `it${seq++}`, x0, y0, x1, y1, mask, checked: true };
}
/** tách thủ công: món mới từ khung chữ nhật vẽ trên ảnh gốc (mọi pixel còn sau khi xoá nền) */
export function itemFromRect(sheet: Sheet, r: { x0: number; y0: number; x1: number; y1: number }, grp: string, n: number): Item | null {
  const x0 = Math.max(0, Math.round(Math.min(r.x0, r.x1))), y0 = Math.max(0, Math.round(Math.min(r.y0, r.y1)));
  const x1 = Math.min(sheet.w - 1, Math.round(Math.max(r.x0, r.x1))), y1 = Math.min(sheet.h - 1, Math.round(Math.max(r.y0, r.y1)));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const bw = x1 - x0 + 1, mask = new Uint8Array(bw * (y1 - y0 + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (sheet.res.rgba[(y * sheet.w + x) * 4 + 3] > 0) mask[(y - y0) * bw + (x - x0)] = 1;
  const base = { x0, y0, x1, y1, mask };
  return { key: `it${seq++}`, ...base, grp, tone: guess(sheet, base).tone, name: nameOf(grp, n), checked: true };
}
/** chia đôi 1 món bằng đường cắt (2 điểm trên ảnh gốc) */
export function splitItem(it: Item, a: { x: number; y: number }, b: { x: number; y: number }): [Item, Item] {
  const bw = it.x1 - it.x0 + 1, bh = it.y1 - it.y0 + 1;
  const m1 = new Uint8Array(it.mask.length), m2 = new Uint8Array(it.mask.length);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const v = it.mask[y * bw + x];
    if (!v) continue;
    const side = (b.x - a.x) * (it.y0 + y - a.y) - (b.y - a.y) * (it.x0 + x - a.x);
    (side >= 0 ? m1 : m2)[y * bw + x] = v;
  }
  return [{ ...it, key: `it${seq++}`, mask: m1, name: `${it.name}a` }, { ...it, key: `it${seq++}`, mask: m2, name: `${it.name}b` }];
}
/** cọ xoá (0) / cọ khôi phục (2) tại điểm (toạ độ ảnh gốc), bán kính r */
export function brush(it: Item, cx: number, cy: number, r: number, v: 0 | 2) {
  const bw = it.x1 - it.x0 + 1, bh = it.y1 - it.y0 + 1;
  for (let y = Math.max(0, Math.floor(cy - r - it.y0)); y <= Math.min(bh - 1, Math.ceil(cy + r - it.y0)); y++)
    for (let x = Math.max(0, Math.floor(cx - r - it.x0)); x <= Math.min(bw - 1, Math.ceil(cx + r - it.x0)); x++)
      if ((it.x0 + x - cx) ** 2 + (it.y0 + y - cy) ** 2 <= r * r) it.mask[y * bw + x] = v;
}
/** vẽ 1 món ra canvas PNG nền trong suốt (cắt sát phần còn pixel + lề 4px) */
export function itemCanvas(sheet: Sheet, it: Item) {
  const bw = it.x1 - it.x0 + 1, bh = it.y1 - it.y0 + 1, { w } = sheet;
  let a = bw, b = bh, c = -1, e = -1;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (it.mask[y * bw + x]) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > e) e = y; }
  if (c < 0) return null;
  a = Math.max(0, a - PAD); b = Math.max(0, b - PAD); c = Math.min(bw - 1, c + PAD); e = Math.min(bh - 1, e + PAD);
  const W = c - a + 1, H = e - b + 1, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!, img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const v = it.mask[(b + y) * bw + a + xx];
    if (!v) continue;
    const s = ((it.y0 + b + y) * w + it.x0 + a + xx) * 4, o = (y * W + xx) * 4;
    const src = v === 2 ? sheet.orig : sheet.res.rgba;
    img.data[o] = src[s]; img.data[o + 1] = src[s + 1]; img.data[o + 2] = src[s + 2]; img.data[o + 3] = v === 2 ? 255 : src[s + 3];
  }
  x.putImageData(img, 0, 0);
  return cv;
}
