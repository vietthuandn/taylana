/* Sửa mẫu scrapbook (khách + admin): khung bao của lớp, phóng / thu / xoay, đường gióng vào tâm đĩa và các vòng tròn đồng tâm. */
import { C, R_HUB, R_SAFE, type Layer } from "./types";

export type Box = { x: number; y: number; w: number; h: number; rot: number };
/** Khung bao (mm) của lớp — lớp chữ lấy theo kích thước đo được khi vẽ (truyền vào textBox) */
export function boxOf(l: Layer, textBox?: Box): Box | null {
  if (l.k === "sticker" || l.k === "doodle") return { x: l.x, y: l.y, w: l.s, h: l.s, rot: l.rot };
  if (l.k === "text") return textBox ?? (l.arc ? null : { x: l.x, y: l.y, w: l.w, h: l.size * 1.6, rot: l.rot });
  return { x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot };
}
/** Đặt lại vị trí / cỡ / góc theo khung mới (b0 = khung lúc bắt đầu kéo) */
export function applyBox(l: Layer, b: Box, b0: Box): Layer {
  const k = b0.h > 0 ? b.h / b0.h : 1;
  if (l.k === "sticker" || l.k === "doodle") return { ...l, x: b.x, y: b.y, s: Math.max(1, (b.w + b.h) / 2), rot: b.rot };
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
