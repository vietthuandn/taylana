/* Booklet Scrapbook — sinh mẫu BẰNG CODE theo seed: trang 1 (bìa, trang đơn) → các cặp trang mở đôi (surface "spread",
   ảnh / sticker / băng dính được vắt qua gáy) → trang cuối (trang đơn). Mỗi cặp trang lấy ngẫu nhiên 1 kiểu dàn trang cặp.
   Phong cách (Polaroid, Xé dán, Vòng tròn, Tạp chí, Hoa lá) dùng chung bảng màu + chất liệu với CD Scrapbook.
   Ô ảnh đánh số toàn cuốn (slot 0 = ảnh bìa). Admin có thể sửa tay từng kiểu cặp trang × phong cách (surface_type "spread"). */
import { DEFAULT_WISHES } from "./wishes";
import { PALETTES, applyFrames, asset, jit, pick, rng } from "./generate";
import { autoDecorate, makeDeck } from "./decor";
import { STYLES, type Frame, type Layer, type PhotoShape, type ScrapAsset, type Style, type Template, type TemplateSetting, type WishCard } from "./types";

export const BOOKLET_PAGES = [4, 8, 12] as const;
export const SPREAD_KINDS: { id: number; name: string }[] = [
  { id: 1, name: "Mỗi trang 1 ảnh to" },
  { id: 2, name: "2 ảnh trái + lời chúc phải" },
  { id: 3, name: "1 ảnh tràn 2 trang + note" },
  { id: 4, name: "3 polaroid rải qua 2 trang" },
  { id: 5, name: "Ảnh + lời chúc mỗi trang" },
];
type R = () => number;
const SHAPE: Record<Style, PhotoShape> = { polaroid: "polaroid", torn: "torn", ring: "circle", magazine: "rect", floral: "circle" };
const CARD: Record<Style, WishCard> = { polaroid: "note", torn: "lined", ring: "label", magazine: "card", floral: "card" };
const CARD_COLOR: Record<WishCard, string[]> = { note: ["#fff3a8", "#ffd6e0", "#d7f0ff", "#e1f7d5"], lined: ["#fffdf6"], label: ["#ffffff"], card: ["#ffffff", "#fff8ef", "#fdf2f8"] };
const sampleWish = (r: R) => pick(r, DEFAULT_WISHES.filter((w) => w.lang === "vi")).content;

function ctx(style: Style, seed: number, salt: number) {
  const r = rng(seed * 31 + salt * 977 + STYLES.findIndex((s) => s.id === style) * 1009);
  return { r, pal: pick(r, PALETTES[style]) };
}
function photo(r: R, style: Style, slot: number, x: number, y: number, w: number, h: number, i: number, rot = jit(r, style === "magazine" ? 3 : 7)): Layer {
  let shape = SHAPE[style];
  if (style === "floral") shape = i % 2 ? "heart" : "circle";
  if (shape === "circle" || shape === "heart") { const s = Math.min(w, h); w = s; h = s; }
  return { k: "photo", slot, x, y, w, h, rot: shape === "circle" ? 0 : rot, shape, seed: Math.floor(r() * 1e6), border: style === "polaroid" || style === "torn" ? undefined : "#ffffff" };
}
function wish(r: R, style: Style, x: number, y: number, w: number, h: number, value = sampleWish(r)): Layer {
  const card = CARD[style];
  return { k: "wish", x, y, w, h, rot: jit(r, 4), card, color: pick(r, CARD_COLOR[card]), ink: "#3f3f46", value, seed: Math.floor(r() * 1e6) };
}
function extras(r: R, style: Style, L: Layer[], pal: { accents: string[]; tone: string }, assets: ScrapAsset[], area: { x0: number; x1: number }) {
  // giấy xé / doodle tuỳ phong cách (nằm dưới ảnh)
  if (style === "torn" || style === "magazine") {
    const k = style === "torn" ? 2 : 1;
    for (let i = 0; i < k; i++) L.unshift({ k: "paper", x: area.x0 + 10 + r() * (area.x1 - area.x0 - 20), y: 15 + r() * 90, w: 26 + r() * 16, h: 20 + r() * 12, rot: jit(r, 20), paper: pick(r, style === "torn" ? ["kraft", "note", "grid"] as const : ["grid", "ticket"] as const), color: style === "torn" ? pick(r, ["#e9dcc4", "#fff8dc", "#f7f7f2"]) : pick(r, pal.accents), torn: style === "torn", seed: Math.floor(r() * 1e6), asset: asset(r, assets, "paper", pal.tone, 0.5) });
  }
}
function bgOf(style: Style, pal: { bg: string; ink: string }, assets: ScrapAsset[], r: R, tone: string): Template["bg"] {
  return { color: pal.bg, ink: pal.ink, pattern: style === "torn" ? "lines" : style === "magazine" ? "grid" : style === "ring" ? "plain" : "dots", asset: asset(r, assets, "texture", tone, 0.5) };
}

/** 1 cặp trang (240 × 120 mm), ô ảnh đánh số 0… trong cặp */
export function generateSpread(kind: number, style: Style, seed: number, assets: ScrapAsset[] = []): Template {
  const { r, pal } = ctx(style, seed, kind);
  const L: Layer[] = [];
  const P = (slot: number, x: number, y: number, w: number, h: number) => L.push(photo(r, style, slot, x, y, w, h, slot));
  if (kind === 1) { P(0, 60 + jit(r, 3), 60 + jit(r, 3), 82, 92); P(1, 180 + jit(r, 3), 60 + jit(r, 3), 82, 92); }
  else if (kind === 2) { P(0, 46, 40, 64, 50); P(1, 74, 84, 60, 46); L.push(wish(r, style, 180, 60, 82, 70)); }
  else if (kind === 3) { L.push({ ...photo(r, style, 0, 120, 54, 206, 88, 0, jit(r, 1.5)), shape: style === "torn" ? "torn" : "rect" } as Layer); L.push(wish(r, style, 182, 101, 64, 26)); }
  else if (kind === 4) {
    const shape: PhotoShape = style === "ring" || style === "floral" ? SHAPE[style] : "polaroid";
    [[54, 52], [124, 70], [190, 50]].forEach(([x, y], i) => L.push({ ...photo(r, style, i, x + jit(r, 3), y + jit(r, 4), 54, 54, i, jit(r, 9)), shape: style === "floral" ? (i % 2 ? "heart" : "circle") : shape } as Layer));
  } else { P(0, 60, 46, 80, 62); L.push(wish(r, style, 60, 99, 78, 24)); L.push(wish(r, style, 180, 22, 78, 24)); P(1, 180, 74, 80, 62); }
  extras(r, style, L, { accents: pal.accents, tone: pal.tone }, assets, { x0: 0, x1: 240 });
  return { id: `spread-${kind}-${style}`, n: kind, style, seed, surface: "spread", kind, bg: bgOf(style, pal, assets, r, pal.tone), layers: L, accents: pal.accents, tone: pal.tone };
}
/** trang 1 (bìa): 1 ảnh lớn + tiêu đề (dòng chính) */
export function generateCover(style: Style, seed: number, assets: ScrapAsset[] = []): Template {
  const { r, pal } = ctx(style, seed, 91);
  const L: Layer[] = [photo(r, style, 0, 61, 50, 90, 76, 0, jit(r, 3))];
  L.push({ k: "text", role: "main", x: 61, y: 103, w: 96, size: 9, rot: jit(r, 2), font: style === "magazine" ? "label" : "hand", color: style === "magazine" ? pick(r, pal.accents) : "#3f3f46" });
  return { id: `cover-${style}`, n: 1, style, seed, surface: "page", gutter: "left", bg: bgOf(style, pal, assets, r, pal.tone), layers: L, accents: pal.accents, tone: pal.tone };
}
/** trang cuối: 1 ảnh hoặc 1 khung lời chúc lớn */
export function generateBack(style: Style, seed: number, slot: number, assets: ScrapAsset[] = []): Template {
  const { r, pal } = ctx(style, seed, 92);
  const L: Layer[] = r() < 0.5 ? [photo(r, style, slot, 59, 58, 86, 86, 0)] : [wish(r, style, 59, 60, 90, 80)];
  return { id: `back-${style}`, n: 1, style, seed, surface: "page", gutter: "right", bg: bgOf(style, pal, assets, r, pal.tone), layers: L, accents: pal.accents, tone: pal.tone };
}
const slotsOf = (t: Template) => t.layers.filter((l) => l.k === "photo").length;
const offset = (t: Template, by: number): Template => ({ ...t, layers: t.layers.map((l) => (l.k === "photo" ? { ...l, slot: l.slot + by } : l)) });

export type BookletSet = { id: string; style: Style; seed: number; pages: number; surfaces: Template[]; photoCount: number };
/** spreadSettings: cài đặt admin cho kiểu cặp trang (surface_type "spread", n = kiểu): mẫu sửa tay + bật / tắt */
export function generateBooklet(pages: number, style: Style, seed: number, assets: ScrapAsset[] = [], frames: Frame[] = [], spreadSettings: TemplateSetting[] = []): BookletSet {
  const r = rng(seed * 13 + pages * 101 + STYLES.findIndex((s) => s.id === style) * 7);
  const kinds = SPREAD_KINDS.map((k) => k.id).filter((id) => spreadSettings.find((s) => s.n === id && s.style === style)?.is_active !== false);
  const pool = kinds.length ? kinds : [1];
  const out: Template[] = [];
  let slot = 0;
  const cover = generateCover(style, seed, assets);
  // 1 bộ bài sticker cho cả cuốn: không lặp sticker trong 1 thiết kế (hết danh sách mới lặp)
  const deck = makeDeck(assets, cover.tone ?? "any", seed);
  const push = (t: Template) => {
    const o = offset(t, slot);
    // mẫu admin sửa tay: giữ nguyên lớp (cả sticker), chỉ bổ sung nếu còn ít hơn mức tối thiểu
    const d = autoDecorate(t.fixed ? o : { ...o, layers: applyFrames(o.layers, frames, t.seed + out.length) }, t.seed + out.length * 31, assets, { deck, topUp: !!t.fixed });
    slot += slotsOf(t); out.push(d);
  };
  push(cover);
  let last = -1;
  for (let p = 2; p + 1 < pages; p += 2) {
    let kind = pick(r, pool);
    if (kind === last && pool.length > 1) kind = pool[(pool.indexOf(kind) + 1) % pool.length];
    last = kind;
    push(spreadTemplate(kind, style, seed + p * 17, assets, spreadSettings));
  }
  const back = generateBack(style, seed, 0, assets);
  push(back);
  return { id: `${pages}-${style}`, style, seed, pages, surfaces: out, photoCount: slot };
}
/** 1 cặp trang theo kiểu: mẫu admin sửa tay (nếu có) hoặc sinh bằng code */
export function spreadTemplate(kind: number, style: Style, seed: number, assets: ScrapAsset[], spreadSettings: TemplateSetting[] = []): Template {
  const s = spreadSettings.find((x) => x.n === kind && x.style === style);
  if (s?.template) return { ...structuredClone(s.template), id: `spread-${kind}-${style}`, n: kind, style, surface: "spread", kind, fixed: true };
  return generateSpread(kind, style, s?.seed ?? seed, assets);
}
export const bookletSeed = (pages: number, style: Style) => pages * 100 + STYLES.findIndex((s) => s.id === style) + 1;
export function bookletSets(pages: number, assets: ScrapAsset[], frames: Frame[], spreadSettings: TemplateSetting[]) {
  return STYLES.map((s) => generateBooklet(pages, s.id, bookletSeed(pages, s.id), assets, frames, spreadSettings));
}
