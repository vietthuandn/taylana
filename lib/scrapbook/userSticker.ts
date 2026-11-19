"use client";
/* Sticker khách tự tải (chạy trên trình duyệt): PNG trong suốt → cắt sát khung bao; ảnh không trong suốt → xoá nền
   (lib/stickerSlicer, giữ vùng lớn nhất) · thêm viền trắng kiểu sticker bế (có bóng nhẹ). */
import { itemCanvas, itemsFromSheet, runSlice, type Item, type Sheet } from "@/lib/stickerSlicer";

const MAX = 1200;
export async function readImageData(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!; x.imageSmoothingQuality = "high"; x.drawImage(bmp, 0, 0, w, h); bmp.close();
  return { w, h, data: x.getImageData(0, 0, w, h).data };
}
/** ảnh có vùng trong suốt đáng kể (> 1% điểm ảnh) */
export function hasAlpha(d: Uint8ClampedArray) {
  let n = 0;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 240) n++;
  return n > d.length / 16 / 100;
}
/** PNG trong suốt: cắt sát theo khung bao phần có màu */
export function cropAlpha(img: { w: number; h: number; data: Uint8ClampedArray }) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const c = document.createElement("canvas"); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  const full = document.createElement("canvas"); full.width = img.w; full.height = img.h;
  full.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
  c.getContext("2d")!.drawImage(full, -x0, -y0);
  return c;
}
/** xoá nền ảnh chụp: giữ vùng liền khối lớn nhất */
export async function removeBg(img: { w: number; h: number; data: Uint8ClampedArray }, tolerance: number): Promise<{ sheet: Sheet; item: Item } | null> {
  const res = await runSlice(img.data, img.w, img.h, { tolerance, minAreaPct: 0.3, close: 2 });
  const sheet: Sheet = { w: img.w, h: img.h, orig: img.data, res };
  const items = itemsFromSheet(sheet, "sticker");
  if (!items.length) return null;
  const area = (it: Item) => it.mask.reduce((a, v) => a + (v ? 1 : 0), 0);
  return { sheet, item: items.reduce((a, b) => (area(b) > area(a) ? b : a)) };
}
export const cutCanvas = (sheet: Sheet, item: Item) => itemCanvas(sheet, item);
/** viền trắng kiểu sticker bế + bóng nhẹ; t = độ dày (px) */
export function withBorder(src: HTMLCanvasElement, t: number) {
  if (t <= 0) return src;
  const pad = Math.ceil(t + 6), W = src.width + pad * 2, H = src.height + pad * 2;
  const sil = document.createElement("canvas"); sil.width = src.width; sil.height = src.height;
  const s = sil.getContext("2d")!; s.drawImage(src, 0, 0); s.globalCompositeOperation = "source-in"; s.fillStyle = "#ffffff"; s.fillRect(0, 0, sil.width, sil.height);
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const x = out.getContext("2d")!;
  // viền: nhân bản bóng trắng quanh vòng tròn bán kính t
  const ring = document.createElement("canvas"); ring.width = W; ring.height = H;
  const rx = ring.getContext("2d")!;
  const steps = Math.max(16, Math.round(t * 3));
  for (let i = 0; i < steps; i++) { const a = (i / steps) * Math.PI * 2; rx.drawImage(sil, pad + Math.cos(a) * t, pad + Math.sin(a) * t); }
  rx.drawImage(sil, pad, pad);
  x.shadowColor = "rgba(0,0,0,0.22)"; x.shadowBlur = Math.max(2, t * 0.8); x.shadowOffsetY = Math.max(1, t * 0.25);
  x.drawImage(ring, 0, 0);
  x.shadowColor = "transparent";
  x.drawImage(src, pad, pad);
  return out;
}
