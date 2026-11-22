"use client";
/* Tải ảnh khung (thư viện Khung ảnh) + mặt nạ vùng ảnh (ảnh đen trắng → kênh alpha: trắng = vùng ảnh). Dùng chung, tải 1 lần. */
import { loadImg } from "@/lib/mockup/images";
import type { LoadedFrame } from "./render";
import type { Frame } from "./types";
import { drawHoles } from "@/lib/frames/holes";

const cache = new Map<string, Promise<LoadedFrame | null>>();
/** ảnh mặt nạ đen trắng → canvas có alpha theo độ sáng */
export function maskToAlpha(img: CanvasImageSource & { width: number; height: number }) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d", { willReadFrequently: true })!; x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const l = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) * (d.data[i + 3] / 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = l; }
  x.putImageData(d, 0, 0);
  return c;
}
export async function loadFrameImages(frames: Frame[]) {
  const out: Record<string, LoadedFrame> = {};
  await Promise.all(frames.map(async (f) => {
    const key = `${f.id}|${f.url}|${f.mask_url ?? ""}|${JSON.stringify(f.regions ?? null)}`;
    let p = cache.get(key);
    if (!p) {
      p = (async () => {
        try {
          const img = await loadImg(f.url);
          const mask = f.mask_url ? maskToAlpha(await loadImg(f.mask_url)) : null;
          return { img, mask, frame: f };
        } catch { return null; }
      })();
      cache.set(key, p);
    }
    const r = await p;
    if (r) out[f.id] = { ...r, frame: f };
  }));
  return out;
}

/** ảnh thu nhỏ của khung kèm ảnh thử nằm trong vùng ảnh (để thấy rõ vùng ảnh) */
export function framePreview(lf: LoadedFrame, photo: CanvasImageSource & { width: number; height: number }, size = 120) {
  const W = size, H = Math.max(1, Math.round(size * (lf.img.height / lf.img.width)));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  if (lf.frame.regions?.length) {
    drawHoles(x, lf.frame.regions, W, H, W, H, (pc, cx, cy, w, h) => { const s = Math.max(w / photo.width, h / photo.height); pc.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s); });
    x.drawImage(lf.img, 0, 0, W, H);
    return c.toDataURL("image/png");
  }
  const g = lf.frame.region ?? { x0: 0, y0: 0, x1: 1, y1: 1 }, ix = g.x0 * W, iy = g.y0 * H, iw = (g.x1 - g.x0) * W, ih = (g.y1 - g.y0) * H;
  const p = document.createElement("canvas"); p.width = W; p.height = H;
  const px = p.getContext("2d")!, s = Math.max(iw / photo.width, ih / photo.height);
  px.save(); px.beginPath(); px.rect(ix, iy, iw, ih); px.clip(); px.drawImage(photo, ix + iw / 2 - (photo.width * s) / 2, iy + ih / 2 - (photo.height * s) / 2, photo.width * s, photo.height * s); px.restore();
  if (lf.mask) { px.globalCompositeOperation = "destination-in"; px.drawImage(lf.mask, 0, 0, W, H); }
  x.drawImage(p, 0, 0); x.drawImage(lf.img, 0, 0, W, H);
  return c.toDataURL("image/png");
}
