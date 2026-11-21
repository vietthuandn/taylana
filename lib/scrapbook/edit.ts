/* Sửa mẫu scrapbook (khách + admin): khung bao của lớp, phóng / thu / xoay, đường gióng vào tâm đĩa và các vòng tròn đồng tâm (chỉ mặt đĩa). */
import { C, R_HUB, R_SAFE, type Layer } from "./types";

export type Box = { x: number; y: number; w: number; h: number; rot: number };
/** Khung bao (mm) của lớp — lớp chữ lấy theo kích thước đo được khi vẽ (truyền vào textBox) */
/** tỉ lệ cao / rộng của ảnh sticker / ảnh tự do (đã tính vùng cắt) — để khung chọn ôm đúng ảnh, không thành hình vuông */
export function imgAr(l: Layer, img?: { width: number; height: number } | null) {
  if (!img || !img.width || (l.k !== "sticker" && l.k !== "doodle")) return 1;
  const c = l.k === "sticker" ? l.crop : undefined;
  return (img.height * (c?.h ?? 1)) / (img.width * (c?.w ?? 1));
}
export function boxOf(l: Layer, textBox?: Box, ar = 1): Box | null {
  if (l.k === "sticker" || l.k === "doodle") return ar > 1 ? { x: l.x, y: l.y, w: l.s / ar, h: l.s, rot: l.rot } : { x: l.x, y: l.y, w: l.s, h: l.s * ar, rot: l.rot };
  if (l.k === "text") return textBox ?? (l.arc ? null : { x: l.x, y: l.y, w: l.w, h: l.size * 1.6, rot: l.rot });
  return { x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot };
}
/** Đặt lại vị trí / cỡ / góc theo khung mới (b0 = khung lúc bắt đầu kéo) */
export function applyBox(l: Layer, b: Box, b0: Box): Layer {
  const k = b0.h > 0 ? b.h / b0.h : 1;
  if (l.k === "sticker" || l.k === "doodle") return { ...l, x: b.x, y: b.y, s: Math.max(1, b.w === b.h ? b.w : Math.max(b.w, b.h)), rot: b.rot };
  if (l.k === "text") {
    // chữ: dịch theo tâm khung, phóng theo tỉ lệ cỡ chữ
    const dx = b.x - b0.x, dy = b.y - b0.y;
    return { ...l, x: l.x + dx, y: l.y + dy, size: Math.max(1.2, l.size * k), w: Math.max(4, l.w * k), rot: b.rot };
  }
  return { ...l, x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h), rot: b.rot };
}
export const inside = (px: number, py: number, b: Box) => {
  const a = (-b.rot * Math.PI) / 180, dx = px - b.x, dy = py - b.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= b.w / 2 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= b.h / 2;
};
export const RINGS = [R_HUB, 35, 46, R_SAFE];
/** Gióng tâm lớp vào tâm đĩa / vòng tròn đồng tâm gần nhất */
export function snap(x: number, y: number, tol = 1.6): { x: number; y: number; guide: { center?: boolean; ring?: number } } {
  const dx = x - C, dy = y - C, r = Math.hypot(dx, dy);
  if (r < tol) return { x: C, y: C, guide: { center: true } };
  for (const R of RINGS) if (Math.abs(r - R) < tol) return { x: C + (dx / r) * R, y: C + (dy / r) * R, guide: { ring: R } };
  return { x, y, guide: {} };
}

/** kéo cạnh trái / phải của khung chữ: đổi ĐỘ RỘNG (chữ tự xuống dòng, cỡ chữ giữ nguyên), cạnh đối diện đứng yên. side = −1 trái · 1 phải */
export function applyWidth(l: Layer, b0: Box, side: -1 | 1, px: number, py: number, min = 8): Layer {
  const a = (b0.rot * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  const lx = (px - b0.x) * ux + (py - b0.y) * uy; // toạ độ con trỏ theo trục ngang của khung
  const fixed = (-side * b0.w) / 2;
  const w = Math.max(min, side * (lx - fixed));
  const c = fixed + (side * w) / 2; // tâm mới (theo trục ngang)
  return { ...l, w, x: b0.x + c * ux, y: b0.y + c * uy } as Layer;
}

/** Kéo nút góc / cạnh (hx, hy ∈ −1 · 0 · 1; cạnh: 1 trong 2 bằng 0) — đúng kiểu Figma / Canva, kể cả khi lớp đang xoay:
   góc / cạnh ĐỐI DIỆN đứng yên (theo hệ toạ độ của lớp đã xoay). lock = giữ tỉ lệ · fromCenter (Alt) = phóng / thu từ tâm. */
export function resizeBox(b0: Box, hx: -1 | 0 | 1, hy: -1 | 0 | 1, px: number, py: number, o: { lock: boolean; fromCenter: boolean; min?: number }): Box {
  const min = o.min ?? 2, a = (b0.rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const dx = px - b0.x, dy = py - b0.y;
  const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos; // con trỏ theo trục của lớp
  const ax = o.fromCenter ? 0 : (-hx * b0.w) / 2, ay = o.fromCenter ? 0 : (-hy * b0.h) / 2; // điểm cố định
  const span = (h: number, l: number, an: number, w0: number) => (h === 0 ? w0 : Math.max(min, o.fromCenter ? 2 * h * l : h * (l - an)));
  let w = span(hx, lx, ax, b0.w), h = span(hy, ly, ay, b0.h);
  if (o.lock) {
    const s = hx !== 0 && hy !== 0 ? Math.max(w / b0.w, h / b0.h) : hx !== 0 ? w / b0.w : h / b0.h;
    w = Math.max(min, b0.w * s); h = Math.max(min, b0.h * s);
  }
  // tâm mới (theo trục lớp) rồi đổi về toạ độ bề mặt
  const cx = o.fromCenter || hx === 0 ? 0 : ax + (hx * w) / 2, cy = o.fromCenter || hy === 0 ? 0 : ay + (hy * h) / 2;
  return { x: b0.x + cx * cos - cy * sin, y: b0.y + cx * sin + cy * cos, w, h, rot: b0.rot };
}
