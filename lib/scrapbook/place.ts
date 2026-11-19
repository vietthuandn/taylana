/* Đặt sticker / ô ảnh vào chỗ trống: lưới chiếm chỗ (ô 2 mm) trên vùng an toàn của bề mặt.
   Ô bị chiếm = có ảnh, chữ, lời chúc, sticker đã đặt, nằm ngoài vùng an toàn hoặc trong vùng hub.
   Vùng trống lớn nhất = ô có khoảng cách tới ô bị chiếm xa nhất (biến đổi khoảng cách 2 lượt). */
import { SCRAP_CONFIG } from "./config";
import { inSafe, type Surface } from "./surface";
import type { Layer } from "./types";

type R = () => number;
type Box = { x: number; y: number; w: number; h: number; rot: number };
const rad = (d: number) => (d * Math.PI) / 180;

export function layerBox(l: Layer): Box | null {
  if (l.k === "sticker" || l.k === "doodle") return { x: l.x, y: l.y, w: l.s, h: l.s, rot: l.rot };
  if (l.k === "text") return l.arc ? null : { x: l.x, y: l.y, w: Math.max(l.w, l.size * 4), h: l.size * 1.6, rot: l.rot };
  return { x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot };
}
const inBox = (px: number, py: number, b: Box, pad = 0) => {
  const a = -rad(b.rot), dx = px - b.x, dy = py - b.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= b.w / 2 + pad && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= b.h / 2 + pad;
};
const OCCUPY = new Set<Layer["k"]>(["photo", "text", "wish", "sticker"]);

type Grid = { cols: number; rows: number; cell: number; blocked: Uint8Array; dist: Float32Array; s: Surface };
function grid(s: Surface, layers: Layer[]): Grid {
  const cell = SCRAP_CONFIG.gridMM, cols = Math.ceil(s.w / cell), rows = Math.ceil(s.h / cell);
  const blocked = new Uint8Array(cols * rows);
  const boxes = layers.filter((l) => OCCUPY.has(l.k)).map(layerBox).filter(Boolean) as Box[];
  const arcs = layers.filter((l) => l.k === "text" && l.arc) as Extract<Layer, { k: "text" }>[];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
    let b = !inSafe(s, x, y) || boxes.some((bx) => inBox(x, y, bx, 0.6));
    if (!b && arcs.length) b = arcs.some((t) => Math.abs(Math.hypot(x - t.x, y - t.y) - t.arc!.r) < t.size);
    blocked[j * cols + i] = b ? 1 : 0;
  }
  return { cols, rows, cell, blocked, dist: distance(blocked, cols, rows), s };
}
// khoảng cách (số ô) tới ô bị chiếm gần nhất — chamfer 2 lượt
function distance(b: Uint8Array, cols: number, rows: number) {
  const d = new Float32Array(cols * rows), INF = 1e6, D2 = Math.SQRT2;
  for (let i = 0; i < d.length; i++) d[i] = b[i] ? 0 : INF;
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= cols || j >= rows ? 0 : d[j * cols + i]);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    if (!d[k]) continue;
    d[k] = Math.min(d[k], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + D2, at(i + 1, j - 1) + D2);
  }
  for (let j = rows - 1; j >= 0; j--) for (let i = cols - 1; i >= 0; i--) {
    const k = j * cols + i;
    if (!d[k]) continue;
    d[k] = Math.min(d[k], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + D2, at(i - 1, j + 1) + D2);
  }
  return d;
}
function mark(g: Grid, x: number, y: number, r: number) {
  const c = g.cell;
  for (let j = Math.max(0, Math.floor((y - r) / c)); j <= Math.min(g.rows - 1, Math.ceil((y + r) / c)); j++)
    for (let i = Math.max(0, Math.floor((x - r) / c)); i <= Math.min(g.cols - 1, Math.ceil((x + r) / c)); i++)
      if (Math.hypot((i + 0.5) * c - x, (j + 0.5) * c - y) <= r) g.blocked[j * g.cols + i] = 1;
  g.dist = distance(g.blocked, g.cols, g.rows);
}
/** ô trống "sâu" nhất; r() có thì chọn ngẫu nhiên trong các ô gần sâu nhất */
function deepest(g: Grid, r?: R) {
  let max = 0;
  for (const v of g.dist) if (v > max && v < 1e5) max = v;
  if (max <= 0) return null;
  const cand: number[] = [];
  g.dist.forEach((v, i) => { if (v >= max * (r ? 0.8 : 1) - 1e-6 && v < 1e5) cand.push(i); });
  const i = r ? cand[Math.floor(r() * cand.length) % cand.length] : cand[0];
  return { x: ((i % g.cols) + 0.5) * g.cell, y: (Math.floor(i / g.cols) + 0.5) * g.cell, r: g.dist[i] * g.cell };
}
/** vùng trống lớn nhất (tâm + bán kính mm) — đặt ô ảnh / khung lời chúc mới */
export function largestEmpty(s: Surface, layers: Layer[]) {
  return deepest(grid(s, layers)) ?? { x: s.w / 2, y: s.h / 2, r: 10 };
}

export type StickerMake = (x: number, y: number, size: number, rot: number) => Layer;
export type TapeMake = (x: number, y: number, w: number, rot: number) => Layer;
const overlap = (a: { x: number; y: number; s: number }, b: { x: number; y: number; s: number }) => {
  const ix = Math.max(0, Math.min(a.x + a.s / 2, b.x + b.s / 2) - Math.max(a.x - a.s / 2, b.x - b.s / 2));
  const iy = Math.max(0, Math.min(a.y + a.s / 2, b.y + b.s / 2) - Math.max(a.y - a.s / 2, b.y - b.s / 2));
  return (ix * iy) / Math.min(a.s * a.s, b.s * b.s);
};
/**
 * Rải `count` sticker: ~60% vào các vùng trống lớn nhất (cỡ co theo độ rộng vùng trống),
 * ~40% đè lên mép / góc ảnh (băng dính chéo góc, sticker vắt qua mép — che ≤ 15% ảnh, không đè vào giữa ảnh).
 * Không 2 sticker nào chồng nhau quá 20%. Trả về các lớp mới (cờ auto).
 */
export function placeStickers(s: Surface, layers: Layer[], r: R, count: number, baseSize: number, make: StickerMake, tape?: TapeMake): Layer[] {
  const cfg = SCRAP_CONFIG, out: Layer[] = [], placed: { x: number; y: number; s: number }[] = [];
  for (const l of layers) if (l.k === "sticker") placed.push({ x: l.x, y: l.y, s: l.s });
  const onPhoto = Math.round(count * cfg.overlapShare), free = count - onPhoto;
  // 1) vùng trống
  const g = grid(s, layers);
  for (let k = 0; k < free; k++) {
    const p = deepest(g, r);
    if (!p) break;
    const size = Math.min(baseSize * cfg.stickerScale * (0.85 + r() * 0.3), p.r * 2 * 0.95);
    if (size < cfg.minStickerMM) break;
    out.push({ ...make(p.x, p.y, size, (r() * 2 - 1) * 25), auto: true } as Layer);
    placed.push({ x: p.x, y: p.y, s: size });
    mark(g, p.x, p.y, size / 2);
  }
  // 2) đè lên mép / góc ảnh
  const photos = layers.filter((l) => l.k === "photo") as Extract<Layer, { k: "photo" }>[];
  for (let k = 0, tries = 0; k < onPhoto && photos.length && tries < onPhoto * 12; tries++) {
    const ph = photos[Math.floor(r() * photos.length) % photos.length];
    const t = rad(ph.rot), corner = r() < 0.6, sx = r() < 0.5 ? -1 : 1, sy = r() < 0.5 ? -1 : 1;
    // điểm neo trong hệ toạ độ của ảnh: góc, hoặc giữa 1 cạnh (lệch khỏi giữa để không che vùng giữa ảnh)
    const lx = corner ? (sx * ph.w) / 2 : r() < 0.5 ? (sx * ph.w) / 2 : sx * ph.w * (0.22 + r() * 0.12);
    const ly = corner ? (sy * ph.h) / 2 : Math.abs(lx) === ph.w / 2 ? sy * ph.h * (0.22 + r() * 0.12) : (sy * ph.h) / 2;
    const ax = ph.x + lx * Math.cos(t) - ly * Math.sin(t), ay = ph.y + lx * Math.sin(t) + ly * Math.cos(t);
    if (ax < 2 || ay < 2 || ax > s.w - 2 || ay > s.h - 2) continue;
    if (s.round && Math.hypot(ax - 60, ay - 60) > 58) continue;
    if (s.hub && Math.hypot(ax - s.hub.x, ay - s.hub.y) < s.hub.r + 2) continue;
    const useTape = tape && corner && r() < 0.6;
    if (useTape) {
      // băng dính chéo góc ảnh
      const w = Math.min(18, Math.max(9, Math.min(ph.w, ph.h) * 0.42));
      const cand = { x: ax, y: ay, s: w * 0.6 };
      if (placed.some((q) => overlap(q, cand) > cfg.maxStickerOverlap)) continue;
      out.push({ ...tape(ax, ay, w, ph.rot + sx * sy * 45 + (r() * 2 - 1) * 8), auto: true } as Layer);
      placed.push(cand); k++;
      continue;
    }
    // sticker vắt qua mép: góc che ~1/4 sticker, mép che ~1/2 → giới hạn cỡ để che ≤ 15% ảnh
    const area = ph.w * ph.h, maxS = Math.sqrt((cfg.maxPhotoCover * area) / (corner ? 0.25 : 0.5));
    const size = Math.min(baseSize * cfg.stickerScale * (0.8 + r() * 0.3), maxS);
    if (size < cfg.minStickerMM) continue;
    const cand = { x: ax, y: ay, s: size };
    if (placed.some((q) => overlap(q, cand) > cfg.maxStickerOverlap)) continue;
    out.push({ ...make(ax, ay, size, (r() * 2 - 1) * 30), auto: true } as Layer);
    placed.push(cand); k++;
  }
  return out;
}
