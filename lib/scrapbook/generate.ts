/* CD Scrapbook — sinh mẫu BẰNG CODE theo seed (luôn ra giống nhau với cùng seed).
   Mỗi số ảnh N (5–10) × 5 phong cách = 30 mẫu. Ảnh nằm trong vành khuyên [hub 23 mm … an toàn 57 mm],
   ảnh chính (ô 0) luôn to nhất, đặt ở đỉnh; dải dưới cùng dành cho chữ (trừ phong cách "Vòng tròn": chữ chạy cong vòng ngoài).
   Trang trí (sticker, băng dính, mảnh giấy) được phép tràn ra mép — khi vẽ sẽ cắt theo hình tròn. */
import { SCRAP_CONFIG } from "./config";
import { autoDecorate, frameLibrary, stickerConfig } from "./decor";
import { surfaceOf } from "./surface";
import { C, R_HUB, R_SAFE, STYLES, type Frame, type Layer, type PhotoShape, type ScrapAsset, type StickerShape, type Style, type Template } from "./types";

export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
type R = () => number;
export const pick = <T,>(r: R, a: T[]) => a[Math.floor(r() * a.length) % a.length];
export const jit = (r: R, d: number) => (r() * 2 - 1) * d;
const rad = (deg: number) => (deg * Math.PI) / 180;

// bảng màu theo phong cách: nền giấy + màu điểm nhấn + tông (để chọn chất liệu hợp màu)
export const PALETTES: Record<Style, { bg: string; ink: string; tone: string; accents: string[] }[]> = {
  polaroid: [
    { bg: "#fbf3e6", ink: "#d9c7a8", tone: "cream", accents: ["#f4a6b8", "#9ec5e8", "#f6d36b", "#a8d5ba"] },
    { bg: "#fde7ea", ink: "#f2b8c3", tone: "pink", accents: ["#ff8fab", "#ffd166", "#9bd1e5", "#c3aed6"] },
    { bg: "#e9f3ee", ink: "#bcd9c7", tone: "green", accents: ["#7cc49a", "#f7b267", "#f28482", "#84a59d"] },
  ],
  torn: [
    { bg: "#efe3cf", ink: "#d8c4a3", tone: "cream", accents: ["#c8553d", "#588b8b", "#f28f3b", "#2d4b73"] },
    { bg: "#f3e9e2", ink: "#e0cbbd", tone: "orange", accents: ["#e07a5f", "#3d405b", "#81b29a", "#f2cc8f"] },
    { bg: "#e6e9f2", ink: "#c8cfe0", tone: "blue", accents: ["#4361ee", "#f72585", "#ffbe0b", "#3a0ca3"] },
  ],
  ring: [
    { bg: "#ece7ff", ink: "#d3c8ff", tone: "purple", accents: ["#9b5de5", "#f15bb5", "#fee440", "#00bbf9"] },
    { bg: "#fff1e6", ink: "#ffd8be", tone: "orange", accents: ["#ff9f1c", "#2ec4b6", "#e71d36", "#ffbf69"] },
    { bg: "#e7f6fb", ink: "#bfe6f2", tone: "blue", accents: ["#219ebc", "#fb8500", "#ffb703", "#8ecae6"] },
  ],
  magazine: [
    { bg: "#f4f1ea", ink: "#dcd6c8", tone: "mono", accents: ["#e63946", "#1d3557", "#f1c453", "#457b9d"] },
    { bg: "#fdf0d5", ink: "#ecd9b0", tone: "yellow", accents: ["#c1121f", "#003049", "#669bbc", "#f77f00"] },
    { bg: "#f1f1f1", ink: "#dadada", tone: "red", accents: ["#d62828", "#023e8a", "#fcbf49", "#2a9d8f"] },
  ],
  floral: [
    { bg: "#fff0f3", ink: "#ffd1dc", tone: "pink", accents: ["#ff4d6d", "#ff8fa3", "#ffb3c1", "#ffd166", "#95d5b2"] },
    { bg: "#f1f7ed", ink: "#d3e8c6", tone: "green", accents: ["#80b918", "#ffafcc", "#ffc8dd", "#f4a261", "#cdb4db"] },
    { bg: "#fff8e1", ink: "#ffe9a8", tone: "yellow", accents: ["#ffb703", "#fb6f92", "#8ecae6", "#ff8fab", "#90be6d"] },
  ],
};

// chất liệu admin hợp tông (không có thì undefined → bộ vẽ dùng hình mặc định)
export function asset(r: R, assets: ScrapAsset[], grp: ScrapAsset["grp"], tone: string, chance = 0.7) {
  const list = assets.filter((a) => a.grp === grp && a.is_active && (grp !== "frame" || a.region));
  if (!list.length || r() > chance) return undefined;
  // tông màu chỉ là ưu tiên nhẹ (×1.5), không loại chất liệu khác tông
  const w = list.map((a) => (tone !== "any" && a.tone === tone ? 1.5 : 1)), sum = w.reduce((x, y) => x + y, 0);
  let v = r() * sum;
  for (let i = 0; i < list.length; i++) { v -= w[i]; if (v <= 0) return list[i].id; }
  return list[list.length - 1].id;
}

type Slot = { slot: number; x: number; y: number; w: number; h: number; a: number };
/** Xếp n ô theo cung tròn (độ, 0° = phải, 90° = dưới), ô chính ở giữa cung; bh = hệ số cao/rộng của khung bao */
function ringSlots(n: number, o: { start: number; span: number; maxS: number; mainScale: number; spacing: number; bh?: number; rMid?: number }): Slot[] {
  const bh = o.bh ?? 1;
  const L = 2 * Math.PI * (o.rMid ?? 39) * (o.span / 360);
  const units = n - 1 + o.mainScale;
  const s = Math.min(o.maxS, (L / units) * o.spacing);
  const sizes = Array.from({ length: n }, (_, i) => (i === 0 ? Math.min(34, s * o.mainScale) : s));
  // thứ tự quanh cung: các ô phụ nửa trái · ô chính · nửa phải
  const others = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const leftN = Math.floor((n - 1) / 2);
  const order = [...others.slice(0, leftN), 0, ...others.slice(leftN)];
  const tot = order.reduce((t, i) => t + sizes[i], 0);
  let acc = 0;
  return order.map((i) => {
    const w = sizes[i], h = w * bh;
    const mid = acc + w / 2; acc += w;
    const a = o.start + (o.span * mid) / tot;
    const half = Math.max(w, h) / 2, diag = Math.hypot(w, h) / 2;
    const rMin = R_HUB + 1 + half, rMax = R_SAFE - diag;
    const rr = o.rMid !== undefined ? Math.min(Math.max(o.rMid, rMin), Math.max(rMin, rMax)) : (rMin + Math.max(rMin, rMax)) / 2;
    return { slot: i, w, h, a, x: C + rr * Math.cos(rad(a)), y: C + rr * Math.sin(rad(a)) };
  });
}

// (cũ) trang trí rải quanh đĩa — nay dùng placeStickers (lưới chiếm chỗ)
export function scatter(r: R, k: number, avoid: Slot[], rMin: number, rMax: number) {
  const out: { x: number; y: number }[] = [];
  for (let t = 0; t < k * 30 && out.length < k; t++) {
    const a = r() * Math.PI * 2, d = rMin + r() * (rMax - rMin);
    const p = { x: C + d * Math.cos(a), y: C + d * Math.sin(a) };
    if (avoid.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < Math.min(s.w, s.h) * 0.42)) continue;
    if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 8)) continue;
    out.push(p);
  }
  return out;
}
export const tapeOn = (r: R, s: Slot, rot: number, pal: { accents: string[] }, assets: ScrapAsset[], tone: string): Layer => {
  // băng dính ở mép trên ô (theo góc xoay của ô)
  const t = rad(rot), dy = -s.h / 2 - 0.5;
  return { k: "tape", x: s.x - dy * Math.sin(t), y: s.y + dy * Math.cos(t), w: Math.max(10, s.w * 0.5), h: 4.2, rot: rot + jit(r, 18),
    color: pick(r, pal.accents), pattern: pick(r, ["stripe", "dots", "plain"] as const), seed: Math.floor(r() * 1e6), asset: asset(r, assets, "tape", tone) };
};
const stickerShapes: StickerShape[] = ["star", "heart", "flower", "bow", "sparkle"];

// sticker / doodle / băng dính tự rải: lib/scrapbook/decor.ts
export { autoDecorate } from "./decor";
/** từ khoá tên bộ khung hợp từng phong cách (ưu tiên khi tự tạo mẫu) */
const STYLE_KEYS: Record<Style, string[]> = { polaroid: ["polaroid"], floral: ["hoa", "flower", "floral"], torn: ["xé", "giấy", "paper"], magazine: ["tạp chí", "tem", "magazine"], ring: ["tròn", "circle"] };
const norm = (s: string) => s.normalize("NFC").toLowerCase();
/** khung được phép cho phong cách: theo cài đặt admin → bộ có tên hợp phong cách → bất kỳ */
export function framesForStyle(frames: Frame[], style: Style): Frame[] {
  const list = frames.filter((f) => f.is_active && (f.region || f.mask_url));
  const chosen = stickerConfig().frameSets[style];
  if (chosen?.length) { const l = list.filter((f) => chosen.includes(f.set_id)); if (l.length) return l; }
  const sets = frameLibrary().filter((s) => STYLE_KEYS[style].some((k) => norm(s.name).includes(k)));
  const pref = list.filter((f) => sets.some((s) => s.id === f.set_id));
  return pref.length ? pref : list;
}
/** gắn khung ngẫu nhiên (theo seed) cho ~frameRatio% ô ảnh; ô có khung đổi chiều cao theo tỉ lệ ảnh khung (giữ tâm + chiều rộng) */
export function applyFrames(layers: Layer[], frames: Frame[], seed: number, style: Style = "polaroid", ratio = stickerConfig().frameRatio / 100): Layer[] {
  const list = framesForStyle(frames, style);
  if (!list.length || ratio <= 0) return layers;
  const r = rng(seed * 7 + 777);
  return layers.map((l) => {
    if (l.k !== "photo" || l.frame || r() >= ratio) return l;
    const f = pick(r, list);
    return { ...l, frame: f.id, h: l.w * (f.ratio || 1) };
  });
}
/** mẫu admin "Ngẫu nhiên từ bộ…": mỗi ô lấy 1 khung trong các bộ đã chọn (theo seed của thiết kế) */
export function resolveFrameSets(layers: Layer[], frames: Frame[], seed: number): Layer[] {
  const r = rng(seed * 13 + 4242);
  return layers.map((l) => {
    if (l.k !== "photo" || !l.frameSets?.length) return l;
    const list = frames.filter((f) => f.is_active && l.frameSets!.includes(f.set_id));
    if (!list.length) return l;
    const f = pick(r, list);
    return { ...l, frame: f.id, h: l.w * (f.ratio || 1) };
  });
}

export function generate(n: number, style: Style, seed: number, assets: ScrapAsset[] = [], frames: Frame[] = []): Template {
  const r = rng(seed * 31 + n * 7 + STYLES.findIndex((s) => s.id === style) * 1009);
  const pal = pick(r, PALETTES[style]);
  const L: Layer[] = [];
  const T = pal.tone;
  const bgAsset = asset(r, assets, "texture", T, 0.5);
  const txt = (font: "hand" | "marker" | "label", color: string, y = C + 40, sub = true) => {
    L.push({ k: "text", role: "main", x: C, y, w: 70, size: font === "hand" ? 9 : 7.5, rot: jit(r, 3), font, color });
    if (sub) L.push({ k: "text", role: "sub", x: C, y: y + 9, w: 52, size: 4.6, rot: jit(r, 2), font: font === "label" ? "label" : "marker", color });
  };
  let bg: Template["bg"] = { color: pal.bg, pattern: "dots", ink: pal.ink, asset: bgAsset };

  if (style === "polaroid") {
    const slots = ringSlots(n, { start: 90 + 40, span: 280, maxS: 25, mainScale: 1.3, spacing: 0.98, bh: 1.22 });
    const frame = asset(r, assets, "frame", T, 0.5);
    slots.forEach((s) => {
      const rot = jit(r, 9);
      L.push({ k: "photo", slot: s.slot, x: s.x, y: s.y, w: s.w, h: s.w, rot, shape: frame ? "frame" : "polaroid", seed: Math.floor(r() * 1e6), asset: frame });
    });
    txt("hand", "#3f3f46");
  } else if (style === "torn") {
    bg = { ...bg, pattern: "lines" };
    const slots = ringSlots(n, { start: 90 + 38, span: 284, maxS: 27, mainScale: 1.32, spacing: 1.2 });
    // mảnh giấy xé phía sau
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, d = 30 + r() * 22;
      L.push({ k: "paper", x: C + d * Math.cos(a), y: C + d * Math.sin(a), w: 22 + r() * 18, h: 16 + r() * 14, rot: jit(r, 30), paper: pick(r, ["kraft", "note", "grid"] as const), color: pick(r, ["#e9dcc4", "#fff8dc", "#f7f7f2"]), torn: true, seed: Math.floor(r() * 1e6), asset: asset(r, assets, "paper", T, 0.5) });
    }
    // ảnh chính vẽ sau cùng (nằm trên)
    [...slots.filter((x) => x.slot !== 0), ...slots.filter((x) => x.slot === 0)].forEach((s) => {
      const rot = jit(r, 12);
      L.push({ k: "photo", slot: s.slot, x: s.x + jit(r, 1.5), y: s.y + jit(r, 1.5), w: s.w, h: s.w * (0.82 + r() * 0.3), rot, shape: "torn", seed: Math.floor(r() * 1e6) });
    });
    L.push({ k: "paper", x: C, y: C + 42, w: 64, h: 15, rot: jit(r, 3), paper: "note", color: "#fffdf5", torn: true, seed: Math.floor(r() * 1e6) });
    L.push({ k: "doodle", x: C + 30, y: C + 30, s: 9, rot: jit(r, 30), shape: "arrow", color: pick(r, pal.accents), asset: asset(r, assets, "doodle", T, 0.5) });
    txt("marker", "#27272a", C + 41);
  } else if (style === "ring") {
    bg = { ...bg, pattern: "plain" };
    const slots = ringSlots(n, { start: -90 + jit(r, 8), span: 360, maxS: 21, mainScale: 1.22, spacing: 1.02, rMid: 36 });
    slots.forEach((s) => L.push({ k: "photo", slot: s.slot, x: s.x, y: s.y, w: s.w, h: s.w, rot: 0, shape: "circle", seed: Math.floor(r() * 1e6), border: "#ffffff" }));
    // sparkle nhỏ giữa các ô
    slots.forEach((s, i) => {
      const nx = slots[(i + 1) % slots.length];
      if (r() < 0.6) L.push({ k: "sticker", x: (s.x + nx.x) / 2 + jit(r, 1), y: (s.y + nx.y) / 2 + jit(r, 1), s: 3.2, rot: jit(r, 30), shape: pick(r, ["sparkle", "star", "heart"] as const), color: pick(r, pal.accents) });
    });
    // chữ chạy cong theo vòng ngoài: dòng chính phía trên, dòng phụ phía dưới
    L.push({ k: "text", role: "main", x: C, y: C, w: 0, size: 6.4, rot: 0, font: "marker", color: pick(r, pal.accents), arc: { r: 51.5, mid: 270 } });
    L.push({ k: "text", role: "sub", x: C, y: C, w: 0, size: 4.6, rot: 0, font: "marker", color: "#3f3f46", arc: { r: 51.5, mid: 90 } });
  } else if (style === "magazine") {
    bg = { ...bg, pattern: "grid" };
    const slots = ringSlots(n, { start: 90 + 36, span: 288, maxS: 26, mainScale: 1.3, spacing: 1.06 });
    for (let i = 0; i < 3; i++) {
      const a = r() * Math.PI * 2, d = 32 + r() * 20;
      L.push({ k: "paper", x: C + d * Math.cos(a), y: C + d * Math.sin(a), w: 20 + r() * 14, h: 26 + r() * 12, rot: jit(r, 14), paper: i === 2 ? "ticket" : "grid", color: i === 2 ? pick(r, pal.accents) : "#ffffff", torn: false, seed: Math.floor(r() * 1e6), asset: asset(r, assets, "paper", T, 0.5) });
    }
    slots.forEach((s, i) => {
      const round = i % 2 === 1;
      const shape: PhotoShape = round ? "circle" : "rect";
      L.push({ k: "photo", slot: s.slot, x: s.x, y: s.y, w: s.w, h: round ? s.w : s.w * (0.9 + r() * 0.2), rot: round ? 0 : jit(r, 4), shape, seed: Math.floor(r() * 1e6), border: "#ffffff" });
    });
    L.push({ k: "doodle", x: C - 34, y: C + 30, s: 8, rot: jit(r, 20), shape: "dash", color: pick(r, pal.accents), asset: asset(r, assets, "doodle", T, 0.4) });
    txt("label", pick(r, pal.accents));
  } else {
    // floral: khung tròn + khung tim, rất nhiều sticker hoa / nơ / sao
    const slots = ringSlots(n, { start: 90 + 40, span: 280, maxS: 25, mainScale: 1.3, spacing: 1.0 });
    slots.forEach((s, i) => L.push({ k: "photo", slot: s.slot, x: s.x, y: s.y, w: s.w, h: s.w, rot: i % 2 ? jit(r, 10) : 0, shape: i % 2 ? "heart" : "circle", seed: Math.floor(r() * 1e6), border: "#ffffff" }));
    txt("hand", pick(r, pal.accents));
  }
  // sticker tự rải theo lưới chiếm chỗ + khung ảnh ngẫu nhiên từ thư viện
  const base: Template = { id: `${n}-${style}`, n, style, seed, bg, layers: applyFrames(L, frames, seed, style), accents: pal.accents, tone: T };
  return autoDecorate(base, seed, assets);
}
