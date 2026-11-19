/* Tự rải sticker / doodle / băng dính cho 1 bề mặt (đĩa, trang, cặp trang) — CD Scrapbook + Booklet Scrapbook.
   - Nguồn: TẤT CẢ chất liệu đang bật nhóm Sticker (sticker thường + điểm nhấn) và Doodle (doodle nhỏ); Băng dính dán góc / cạnh
     trên ảnh. Xáo trộn theo seed, lấy lần lượt KHÔNG LẶP trong 1 thiết kế (hết danh sách mới lặp). Sticker hợp tông được ưu tiên
     nhẹ (trọng số ×1.5), không loại sticker khác tông. Sticker vẽ bằng code chỉ dùng khi thư viện có < 6 sticker (tắt được).
   - Kích thước theo % bề rộng 1 trang / đường kính đĩa (120 mm), giữ tỉ lệ gốc (khi vẽ không phóng quá 2× cỡ gốc ở 300 DPI).
   - Vị trí: lưới chiếm chỗ (vùng trống lớn nhất trước, rồi mép / góc ảnh). Điểm nhấn đè góc / mép 1 ảnh, che ≤ 20% ảnh, không đè
     50% diện tích giữa ảnh. Sticker chồng nhau ≤ 15%, tràn mép tối đa vùng bleed, xoay −15°…15°, không vắt qua gáy cặp trang.
   Cài đặt (admin → Quản lý template → CD / Booklet Scrapbook → "Cài đặt rải sticker") lưu ở site_settings "scrap_stickers" / "scrap_stickers_booklet". */
import { deepest, grid, mark } from "./place";
import { surfaceOf, type Surface } from "./surface";
import { C, R_HUB, R_OUT, type FrameSet, type Layer, type ScrapAsset, type StickerShape, type Style, type Template } from "./types";

export type Range = [number, number];
export type StickerCfg = {
  normal: Range; accent: Range; doodle: Range; // % của 120 mm
  disc: { stickers: Range; accents: Range; doodles: Range };
  page: { stickers: Range; doodles: Range };
  spread: { stickers: Range; doodles: Range };
  tapes: Range; // số miếng băng dính mỗi ảnh
  defaults: boolean; // cho phép sticker vẽ bằng code khi thư viện có < 6 sticker
  toneBoost: number; // ưu tiên sticker hợp tông
  frameRatio: number; // % ô ảnh có khung khi tự tạo mẫu
  frameSets: Partial<Record<Style, string[]>>; // bộ khung được dùng cho từng phong cách (trống = tự chọn theo tên bộ)
};
export const DEFAULT_STICKER_CFG: StickerCfg = {
  normal: [18, 28], accent: [30, 38], doodle: [8, 14],
  disc: { stickers: [4, 7], accents: [1, 2], doodles: [2, 4] },
  page: { stickers: [3, 5], doodles: [1, 3] },
  spread: { stickers: [5, 8], doodles: [2, 5] },
  tapes: [1, 2], defaults: true, toneBoost: 1.5, frameRatio: 60, frameSets: {},
};
const rg = (v: unknown, d: Range): Range => (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && isFinite(n)) ? [Math.min(v[0], v[1]), Math.max(v[0], v[1])] : d);
export function mergeStickerCfg(v?: Partial<StickerCfg> | null): StickerCfg {
  const d = DEFAULT_STICKER_CFG, x = (v ?? {}) as Partial<StickerCfg>;
  return {
    normal: rg(x.normal, d.normal), accent: rg(x.accent, d.accent), doodle: rg(x.doodle, d.doodle),
    disc: { stickers: rg(x.disc?.stickers, d.disc.stickers), accents: rg(x.disc?.accents, d.disc.accents), doodles: rg(x.disc?.doodles, d.disc.doodles) },
    page: { stickers: rg(x.page?.stickers, d.page.stickers), doodles: rg(x.page?.doodles, d.page.doodles) },
    spread: { stickers: rg(x.spread?.stickers, d.spread.stickers), doodles: rg(x.spread?.doodles, d.spread.doodles) },
    tapes: rg(x.tapes, d.tapes), defaults: x.defaults ?? d.defaults, toneBoost: typeof x.toneBoost === "number" && x.toneBoost > 0 ? x.toneBoost : d.toneBoost,
    frameRatio: typeof x.frameRatio === "number" ? Math.min(100, Math.max(0, x.frameRatio)) : d.frameRatio,
    frameSets: x.frameSets && typeof x.frameSets === "object" ? x.frameSets : {},
  };
}
let CFG = DEFAULT_STICKER_CFG;
/** gọi trước khi sinh mẫu (trang khách / admin) để dùng cài đặt của admin */
export function setStickerConfig(v?: Partial<StickerCfg> | null) { CFG = mergeStickerCfg(v); }
export const stickerConfig = () => CFG;
let SETS: FrameSet[] = [];
/** các bộ khung đang bật (tên bộ dùng để ưu tiên khung hợp phong cách khi tự tạo mẫu) */
export function setFrameLibrary(sets: FrameSet[]) { SETS = sets; }
export const frameLibrary = () => SETS;

const MAX_COVER = 0.2, MAX_OVERLAP = 0.15, BLEED = 3, ROT = 15, GUTTER = 1.5;
type R = () => number;
function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const randIn = (r: R, [a, b]: Range) => a + r() * (b - a);
const intIn = (r: R, [a, b]: Range) => Math.round(a + r() * (b - a));
const mm = (pct: number) => (pct * 120) / 100;
const rad = (d: number) => (d * Math.PI) / 180;

// ---------- bộ bài sticker: xáo theo seed, lấy lần lượt không lặp ----------
export type DeckItem = { asset?: string; shape?: StickerShape; doodle?: "arrow" | "swirl" | "dash" };
const CODE_STICKERS: StickerShape[] = ["star", "heart", "flower", "bow", "sparkle"];
const CODE_DOODLES: DeckItem[] = [{ doodle: "arrow" }, { doodle: "swirl" }, { doodle: "dash" }, { shape: "sparkle" }, { shape: "heart" }, { shape: "star" }];
function weightedShuffle<T>(r: R, items: T[], w: (t: T) => number) {
  return items.map((t) => ({ t, k: Math.pow(r() || 1e-9, 1 / w(t)) })).sort((a, b) => b.k - a.k).map((x) => x.t);
}
export type Deck = { sticker: () => DeckItem | null; doodle: () => DeckItem | null; tape: () => string | undefined };
export function makeDeck(assets: ScrapAsset[], tone: string, seed: number): Deck {
  const r = rng(seed * 101 + 13), cfg = CFG;
  const on = (g: string) => assets.filter((a) => a.is_active && a.grp === g);
  const w = (a: ScrapAsset) => (tone !== "any" && a.tone === tone ? cfg.toneBoost : 1);
  const lib: DeckItem[] = on("sticker").map((a) => ({ asset: a.id, w: w(a) }) as DeckItem & { w: number });
  const stickers: (DeckItem & { w?: number })[] = lib.length < 6 && cfg.defaults ? [...lib, ...CODE_STICKERS.map((shape) => ({ shape }))] : lib;
  const doodLib = on("doodle").map((a) => ({ asset: a.id, w: w(a) }) as DeckItem & { w: number });
  const doodles: (DeckItem & { w?: number })[] = doodLib.length ? (doodLib.length < 3 && cfg.defaults ? [...doodLib, ...CODE_DOODLES] : doodLib) : cfg.defaults ? CODE_DOODLES : [];
  const tapes = on("tape");
  const cycler = (list: (DeckItem & { w?: number })[]) => {
    let q: DeckItem[] = [];
    return () => {
      if (!list.length) return null;
      if (!q.length) q = weightedShuffle(r, list, (x) => (x as { w?: number }).w ?? 1);
      return q.shift()!;
    };
  };
  const tapeQ = cycler(tapes.map((a) => ({ asset: a.id, w: w(a) })));
  return { sticker: cycler(stickers), doodle: cycler(doodles), tape: () => tapeQ()?.asset };
}

// ---------- đặt ----------
type Sq = { x: number; y: number; s: number };
const overlap = (a: Sq, b: Sq) => {
  const ix = Math.max(0, Math.min(a.x + a.s / 2, b.x + b.s / 2) - Math.max(a.x - a.s / 2, b.x - b.s / 2));
  const iy = Math.max(0, Math.min(a.y + a.s / 2, b.y + b.s / 2) - Math.max(a.y - a.s / 2, b.y - b.s / 2));
  return (ix * iy) / Math.min(a.s * a.s, b.s * b.s);
};
/** nằm trong vùng cho phép: tràn mép tối đa BLEED mm, không vắt qua gáy, không đè vùng hub của đĩa */
function fits(S: Surface, q: Sq) {
  if (S.round) {
    const d = Math.hypot(q.x - C, q.y - C);
    return d + q.s * 0.35 <= R_OUT + BLEED && d - q.s * 0.5 >= R_HUB - 1;
  }
  if (q.x - q.s / 2 < -BLEED || q.y - q.s / 2 < -BLEED || q.x + q.s / 2 > S.w + BLEED || q.y + q.s / 2 > S.h + BLEED) return false;
  if (S.kind === "spread" && S.gutter !== null && Math.abs(q.x - S.gutter) < q.s / 2 + GUTTER) return false;
  return true;
}
type Photo = Extract<Layer, { k: "photo" }>;
/** sticker vắt qua góc / mép ảnh: che ≤ cover diện tích ảnh, không đè 50% diện tích giữa ảnh */
function onPhotoEdge(S: Surface, r: R, ph: Photo, size: number, cover: number, placed: Sq[]): Sq | null {
  const t = rad(ph.rot), inner = 0.3536; // nửa cạnh của hình chữ nhật giữa chiếm 50% diện tích
  for (let k = 0; k < 10; k++) {
    const corner = r() < 0.65, sx = r() < 0.5 ? -1 : 1, sy = r() < 0.5 ? -1 : 1;
    let s = Math.min(size, Math.sqrt(cover * ph.w * ph.h / (corner ? 0.25 : 0.5)) * 1.0);
    // phần sticker lấn vào trong ảnh không chạm vùng giữa → đẩy tâm ra ngoài mép
    const marginX = ph.w * (0.5 - inner), marginY = ph.h * (0.5 - inner);
    let lx: number, ly: number;
    if (corner) { lx = sx * (ph.w / 2 + Math.max(0, s / 2 - marginX)); ly = sy * (ph.h / 2 + Math.max(0, s / 2 - marginY)); }
    else if (r() < 0.5) { lx = sx * (ph.w / 2 + Math.max(0, s / 2 - marginX)); ly = sy * ph.h * (0.38 + r() * 0.1); }
    else { lx = sx * ph.w * (0.38 + r() * 0.1); ly = sy * (ph.h / 2 + Math.max(0, s / 2 - marginY)); }
    // che bao nhiêu (xấp xỉ hình vuông không xoay trong hệ toạ độ ảnh)
    const cov = Math.max(0, Math.min(ph.w / 2, lx + s / 2) - Math.max(-ph.w / 2, lx - s / 2)) * Math.max(0, Math.min(ph.h / 2, ly + s / 2) - Math.max(-ph.h / 2, ly - s / 2));
    if (cov > cover * ph.w * ph.h * 1.05) { s *= 0.85; continue; }
    const q = { x: ph.x + lx * Math.cos(t) - ly * Math.sin(t), y: ph.y + lx * Math.sin(t) + ly * Math.cos(t), s };
    if (!fits(S, q) || placed.some((p) => overlap(p, q) > MAX_OVERLAP)) continue;
    return q;
  }
  return null;
}

/** Rải sticker / doodle / băng dính tự động. topUp: giữ nguyên lớp của mẫu (mẫu admin sửa tay), chỉ bổ sung sticker nếu còn ít hơn mức tối thiểu. */
export function autoDecorate(t: Template, seed: number, assets: ScrapAsset[], o: { deck?: Deck; topUp?: boolean } = {}): Template {
  const S = surfaceOf(t), r = rng(seed * 17 + 5), cfg = CFG;
  const deck = o.deck ?? makeDeck(assets, t.tone ?? "any", seed);
  const accents = t.accents?.length ? t.accents : ["#ff8fab", "#ffd166", "#9bd1e5"];
  const keep = o.topUp ? t.layers : t.layers.filter((l) => !l.auto);
  const plan = S.kind === "disc" ? cfg.disc : S.kind === "page" ? cfg.page : cfg.spread;
  let total = intIn(r, plan.stickers), nAcc = S.kind === "disc" ? Math.min(total, intIn(r, cfg.disc.accents)) : S.kind === "spread" ? 2 : 1, nDood = intIn(r, plan.doodles);
  if (t.style === "floral") total += 2;
  if (o.topUp) {
    const have = keep.filter((l) => l.k === "sticker").length;
    if (have >= plan.stickers[0]) return t;
    total = plan.stickers[0] - have; nAcc = 0; nDood = 0;
  }
  const out: Layer[] = [], placed: Sq[] = keep.filter((l) => l.k === "sticker").map((l) => ({ x: l.x, y: l.y, s: (l as { s: number }).s }));
  const photos = keep.filter((l) => l.k === "photo") as Photo[];
  const rot = () => (r() * 2 - 1) * ROT;
  const mkSticker = (q: Sq, it: DeckItem): Layer => it.doodle
    ? { k: "doodle", x: q.x, y: q.y, s: q.s, rot: rot(), shape: it.doodle, color: accents[Math.floor(r() * accents.length) % accents.length], auto: true }
    : { k: "sticker", x: q.x, y: q.y, s: q.s, rot: rot(), shape: it.shape ?? "star", color: accents[Math.floor(r() * accents.length) % accents.length], asset: it.asset, auto: true };

  // 1) băng dính: 1–2 miếng mỗi ảnh (góc chéo hoặc cạnh trên), được vắt qua gáy
  if (!o.topUp) for (const ph of photos) {
    if (ph.shape === "circle" || ph.shape === "heart") continue;
    const n = intIn(r, cfg.tapes), tw = Math.max(12, Math.min(24, ph.w * 0.42)), th = rad(ph.rot);
    const spots: [number, number, number][] = r() < 0.5 ? [[0, -1, 0], [-1, -1, -45], [1, 1, -45]] : [[-1, -1, -45], [1, -1, 45], [0, -1, 0]];
    for (let k = 0; k < n; k++) {
      const [sx, sy, a] = spots[k], lx = (sx * ph.w) / 2, ly = (sy * ph.h) / 2 - (sx === 0 ? 0.5 : 0);
      out.push({ k: "tape", x: ph.x + lx * Math.cos(th) - ly * Math.sin(th), y: ph.y + lx * Math.sin(th) + ly * Math.cos(th), w: tw, h: 5, rot: ph.rot + a + (r() * 2 - 1) * 8,
        color: accents[Math.floor(r() * accents.length) % accents.length], pattern: (["stripe", "dots", "plain"] as const)[Math.floor(r() * 3)], seed: Math.floor(r() * 1e6), asset: deck.tape(), auto: true });
    }
  }
  const g = grid(S, keep, S.kind === "spread" ? 3 : 0);
  const put = (q: Sq, it: DeckItem) => { out.push(mkSticker(q, it)); placed.push(q); mark(g, q.x, q.y, q.s / 2); };
  // 2) sticker điểm nhấn: mỗi trang (nửa cặp trang) 1 cái — đè góc / mép 1 ảnh, không có ảnh thì vào vùng trống lớn nhất
  const halves = S.kind === "spread" ? [[0, 120], [120, 240]] : [[0, S.w]];
  for (let k = 0; k < nAcc; k++) {
    const [x0, x1] = halves[k % halves.length], it = deck.sticker();
    if (!it) break;
    const size = mm(randIn(r, cfg.accent));
    const own = photos.filter((p) => p.x >= x0 && p.x < x1);
    let q: Sq | null = null;
    for (let tries = 0; !q && tries < 4 && own.length; tries++) q = onPhotoEdge(S, r, own[Math.floor(r() * own.length) % own.length], size, MAX_COVER, placed);
    if (!q) { const p = deepest(g, r); if (p && p.x >= x0 - 10 && p.x <= x1 + 10) { const s = Math.min(size, p.r * 2 * 1.15); const c = { x: p.x, y: p.y, s }; if (s >= mm(cfg.normal[0]) * 0.6 && fits(S, c)) q = c; } }
    if (q) put(q, it);
  }
  // 3) sticker thường: vùng trống lớn nhất trước, hết chỗ thì vắt qua mép ảnh
  for (let k = nAcc; k < total; k++) {
    const it = deck.sticker();
    if (!it) break;
    const want = mm(randIn(r, cfg.normal));
    let q: Sq | null = null;
    const p = deepest(g, r);
    if (p && p.r * 2 * 1.15 >= want * 0.6) { const c = { x: p.x, y: p.y, s: Math.min(want, p.r * 2 * 1.15) }; if (fits(S, c) && !placed.some((z) => overlap(z, c) > MAX_OVERLAP)) q = c; }
    for (let tries = 0; !q && tries < 4 && photos.length; tries++) q = onPhotoEdge(S, r, photos[Math.floor(r() * photos.length) % photos.length], want, 0.12, placed);
    if (q) put(q, it);
  }
  // 4) doodle nhỏ
  for (let k = 0; k < nDood; k++) {
    const it = deck.doodle();
    if (!it) break;
    const p = deepest(g, r);
    if (!p || p.r * 2 < 4) break;
    const q = { x: p.x, y: p.y, s: Math.min(mm(randIn(r, cfg.doodle)), p.r * 2 * 1.2) };
    if (!fits(S, q)) { mark(g, p.x, p.y, 2); continue; }
    if (it.asset && !it.doodle && !it.shape) { out.push({ k: "doodle", x: q.x, y: q.y, s: q.s, rot: rot(), shape: "arrow", color: accents[0], asset: it.asset, auto: true }); placed.push(q); mark(g, q.x, q.y, q.s / 2); }
    else put(q, it);
  }
  return { ...t, layers: [...keep, ...out] };
}
