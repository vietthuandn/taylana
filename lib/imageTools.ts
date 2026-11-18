"use client";

/* Tiện ích ảnh cho công cụ in (chỉ chạy trên trình duyệt, không upload). */
import JSZip from "jszip";
import { COLOR_SPACE, DPI, JPG_QUALITY } from "./printSpecs";

export type LoadedImage = { id: string; name: string; file: File; url: string; el: HTMLImageElement; w: number; h: number; error?: string };
export const ACCEPT_IMG = "image/jpeg,image/png,image/webp";
const uid = () => Math.random().toString(36).slice(2, 10);

// Đọc số thành phần màu của JPEG (4 = CMYK)
async function jpegComponents(file: File): Promise<number | null> {
  const b = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return b[i + 9];
    const len = (b[i + 2] << 8) | b[i + 3];
    i += 2 + len;
  }
  return null;
}

export async function loadImage(file: File): Promise<LoadedImage> {
  const base = { id: uid(), name: file.name, file, url: URL.createObjectURL(file) };
  const okType = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  const el = new Image();
  if (!okType) return { ...base, el, w: 0, h: 0, error: "Chỉ nhận ảnh JPG, PNG hoặc WEBP." };
  if (/jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name)) {
    const c = await jpegComponents(file).catch(() => null);
    if (c === 4) return { ...base, el, w: 0, h: 0, error: "Ảnh dùng hệ màu CMYK — hãy chuyển sang RGB rồi tải lại." };
  }
  try {
    await new Promise<void>((res, rej) => { el.onload = () => res(); el.onerror = () => rej(); el.src = base.url; });
    if (!el.naturalWidth) throw new Error();
    return { ...base, el, w: el.naturalWidth, h: el.naturalHeight };
  } catch {
    return { ...base, el, w: 0, h: 0, error: "Không đọc được ảnh (file lỗi hoặc định dạng không hỗ trợ)." };
  }
}

// Vẽ ảnh vào ô (x, y, w, h): "cover" phủ kín (cắt bớt) · "contain" vừa khung (nền trắng)
export function drawFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, mode: "cover" | "contain") {
  const s = mode === "cover" ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}
// DPI thực tế khi ảnh được phóng theo tỉ lệ s (px in / px ảnh)
export const effectiveDpi = (s: number) => Math.round(DPI / s);
export const fitScale = (iw: number, ih: number, w: number, h: number, mode: "cover" | "contain") =>
  mode === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
export const LOW_DPI = 285; // dưới mức này thì cảnh báo có thể mờ

export function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { colorSpace: COLOR_SPACE } as CanvasRenderingContext2DSettings)!;
  ctx.fillStyle = "#ffffff"; // JPG không có trong suốt → nền trắng
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

// Ghi DPI vào metadata JPEG (JFIF APP0: đơn vị = dpi, mật độ = 300 × 300)
export async function canvasToJpeg(c: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), "image/jpeg", JPG_QUALITY));
  const src = new Uint8Array(await blob.arrayBuffer());
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x01, DPI >> 8, DPI & 0xff, DPI >> 8, DPI & 0xff, 0x00, 0x00];
  let out: Uint8Array;
  if (src[2] === 0xff && src[3] === 0xe0 && src[6] === 0x4a && src[7] === 0x46 && src[8] === 0x49 && src[9] === 0x46) {
    out = src.slice();
    out[13] = 1; out[14] = DPI >> 8; out[15] = DPI & 0xff; out[16] = DPI >> 8; out[17] = DPI & 0xff;
  } else {
    out = new Uint8Array(src.length + app0.length);
    out.set(src.subarray(0, 2), 0); out.set(app0, 2); out.set(src.subarray(2), 2 + app0.length);
  }
  return new Blob([out as BlobPart], { type: "image/jpeg" });
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function saveZip(files: { name: string; blob: Blob }[], zipName: string) {
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  saveBlob(await zip.generateAsync({ type: "blob" }), zipName);
}
