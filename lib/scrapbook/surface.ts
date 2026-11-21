/* Bề mặt (surface) của scrapbook: đĩa tròn 120 mm có hub · trang vuông 12 × 12 cm (lề an toàn 5 mm, lề gáy 7 mm)
   · cặp trang 24 × 12 cm (gáy ở giữa). Mọi lớp, ô ảnh, sticker, chữ… dùng chung toạ độ mm trên bề mặt. */
import { SCRAP_CONFIG } from "./config";
import { C, R_HUB, R_SAFE, type SurfaceKind, type Template } from "./types";

export const SAFE_MM = 5, GUTTER_MM = 7;
export type Surface = {
  kind: SurfaceKind; w: number; h: number;
  round: boolean; // đĩa: cắt tròn, có lỗ giữa
  safe: { x0: number; y0: number; x1: number; y1: number }; // vùng an toàn (hình chữ nhật; đĩa: thêm điều kiện bán kính)
  hub: { x: number; y: number; r: number } | null;
  gutter: number | null; // toạ độ x của đường gáy
  folds?: number[]; // bìa sau: toạ độ x của 2 nếp gấp gáy
};
/** bìa sau (Back cover Template): 150 × 117 mm, nếp gấp gáy cách 2 cạnh 6 mm */
export const BACK_W = 150, BACK_H = 117, BACK_FOLD = 6;
export function surfaceOf(t: Pick<Template, "surface" | "gutter"> | null | undefined): Surface {
  const k = t?.surface ?? "disc";
  if (k === "spread") return { kind: k, w: 240, h: 120, round: false, safe: { x0: SAFE_MM, y0: SAFE_MM, x1: 240 - SAFE_MM, y1: 120 - SAFE_MM }, hub: null, gutter: 120 };
  if (k === "back") return { kind: k, w: BACK_W, h: BACK_H, round: false, safe: { x0: BACK_FOLD + 4, y0: 4, x1: BACK_W - BACK_FOLD - 4, y1: BACK_H - 4 }, hub: null, gutter: null, folds: [BACK_FOLD, BACK_W - BACK_FOLD] };
  if (k === "page") {
    const left = (t?.gutter ?? "left") === "left";
    return { kind: k, w: 120, h: 120, round: false, safe: { x0: left ? GUTTER_MM : SAFE_MM, y0: SAFE_MM, x1: 120 - (left ? SAFE_MM : GUTTER_MM), y1: 120 - SAFE_MM }, hub: null, gutter: left ? 0 : 120 };
  }
  return { kind: "disc", w: 120, h: 120, round: true, safe: { x0: C - R_SAFE, y0: C - R_SAFE, x1: C + R_SAFE, y1: C + R_SAFE }, hub: { x: C, y: C, r: R_HUB }, gutter: null };
}
/** điểm có nằm trong vùng an toàn (và ngoài vùng hub) không */
export function inSafe(s: Surface, x: number, y: number) {
  if (x < s.safe.x0 || x > s.safe.x1 || y < s.safe.y0 || y > s.safe.y1) return false;
  if (s.round && Math.hypot(x - C, y - C) > R_SAFE) return false;
  if (s.hub && Math.hypot(x - s.hub.x, y - s.hub.y) < s.hub.r) return false;
  return true;
}
/** vị trí mặc định khi khách bấm thêm sticker thứ k: nửa dưới bề mặt, mỗi cái lệch thêm 6 mm */
export function addPoint(s: Surface, k: number) {
  const steps = [0, 1, -1, 2, -2, 3, -3], o = steps[k % steps.length] * SCRAP_CONFIG.addStep, oy = Math.floor(k / steps.length) * SCRAP_CONFIG.addStep * 0.5;
  if (s.round) return { x: C + o, y: C + 32 + oy };
  return { x: s.w / 2 + o, y: s.h * 0.72 + oy };
}
