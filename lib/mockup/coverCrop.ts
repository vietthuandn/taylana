"use client";

/* Cắt ảnh về ĐÚNG tỉ lệ (rộng / cao) kiểu PHỦ KÍN (cover): scale = max(rộng_vùng / rộng_ảnh, cao_vùng / cao_ảnh),
   chiều dư cắt đều 2 bên (căn giữa). Ảnh luôn phủ kín 100%, không bao giờ hở. Dùng chung cho CD Mockup và Booklet. */
type Src = CanvasImageSource & { width: number; height: number };

export function coverCrop(image: Src, aspect: number, maxSide = 2048): HTMLCanvasElement {
  const iw = (image as HTMLImageElement).naturalWidth || image.width;
  const ih = (image as HTMLImageElement).naturalHeight || image.height;
  // kích thước đích: giữ độ nét tối đa của ảnh gốc, giới hạn maxSide
  let w = Math.min(iw, ih * aspect), h = w / aspect;
  const k = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  const s = Math.max(w / iw, h / ih);
  x.drawImage(image, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
  return c;
}

/** Ô màu trơn đúng tỉ lệ (vùng để trắng / chưa có ảnh) */
export function solidFill(color: string, aspect: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(256 * Math.min(1, aspect)) || 1; c.height = Math.round(256 / Math.max(1, aspect)) || 1;
  const x = c.getContext("2d")!;
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
