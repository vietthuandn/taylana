"use client";
/* Tải ảnh khung (thư viện Khung ảnh) + mặt nạ vùng ảnh (ảnh đen trắng → kênh alpha: trắng = vùng ảnh). Dùng chung, tải 1 lần. */
import { loadImg } from "@/lib/mockup/images";
import type { LoadedFrame } from "./render";
import type { Frame } from "./types";

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
    const key = `${f.id}|${f.url}|${f.mask_url ?? ""}`;
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
