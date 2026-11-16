"use client";

import { useMemo } from "react";

// ----- Ảnh hiển thị mịn: canvas thu nhỏ ảnh lớn đột ngột sẽ bị răng cưa/vỡ.
// Màn hình dùng bản thu nhỏ từng bước (mịn); khi xuất file thì đổi lại ảnh gốc (fullImage).
const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 3) : 1;
export function downscale(img: HTMLImageElement, maxSide: number): CanvasImageSource {
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  if (!w0 || !h0 || Math.max(w0, h0) <= maxSide || img.src.startsWith("data:image/svg")) return img;
  let src: CanvasImageSource = img;
  let w = w0, h = h0;
  const target = maxSide / Math.max(w0, h0);
  // giảm một nửa mỗi bước cho tới gần kích thước cần → mịn như Photoshop
  while (w / 2 >= w0 * target && h / 2 >= h0 * target) {
    w = Math.round(w / 2); h = Math.round(h / 2);
    src = step(src, w, h);
  }
  return step(src, Math.max(1, Math.round(w0 * target)), Math.max(1, Math.round(h0 * target)));
}
function step(src: CanvasImageSource, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}
// displayPx = kích thước ảnh trên màn hình (px CSS); làm tròn theo bậc để không tính lại liên tục
export function useView(img: HTMLImageElement | undefined, displayPx: number) {
  const bucket = Math.max(64, Math.ceil((displayPx * DPR * 1.5) / 128) * 128);
  return useMemo(() => (img ? downscale(img, bucket) : undefined), [img, bucket]);
}

