/* Font chữ cắt dán ("cut-out"): mỗi ký tự có nhiều biến thể (nhiều mảnh cắt khác nhau), dựng chữ chọn ngẫu nhiên THEO SEED.
   Tiếng Việt có dấu: tách ký tự bằng Unicode NFD → chữ gốc + dấu phụ (mũ, trăng, móc) + dấu thanh.
   Có ký tự dựng sẵn (ví dụ "Ấ") thì dùng luôn; không thì ghép mảnh chữ gốc + mảnh dấu (thu nhỏ ~45%, lệch / xoay nhẹ).
   Thiếu chữ thường → dùng chữ hoa (và ngược lại); thiếu hẳn → mảnh giấy trắng in ký tự bằng font đậm. */
import { rng } from "./generate";

export type GlyphKind = "upper" | "lower" | "digit" | "tone" | "diacritic" | "symbol" | "precomposed";
export type Glyph = { id: string; font_id: string; ch: string; kind: GlyphKind; url: string; w: number; h: number; anchor?: { x: number; y: number } | null; sort_order: number };
export type CutoutFont = { id: string; name: string; is_active: boolean; sort_order: number };

// dấu kết hợp Unicode
export const TONES: { ch: string; name: string; key?: string }[] = [
  { ch: "́", name: "Sắc", key: "´" }, { ch: "̀", name: "Huyền", key: "`" }, { ch: "̉", name: "Hỏi" },
  { ch: "̃", name: "Ngã", key: "~" }, { ch: "̣", name: "Nặng" },
];
export const DIACRITICS: { ch: string; name: string; key?: string }[] = [
  { ch: "̂", name: "Mũ", key: "^" }, { ch: "̆", name: "Trăng", key: "˘" }, { ch: "̛", name: "Móc" },
];
export const SYMBOLS = ["!", "?", ".", ",", "'", '"', "&", "-", "+", "♥", "★", ":"];
const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), LOW = "abcdefghijklmnopqrstuvwxyz".split(""), DIG = "0123456789".split("");
export const SECTIONS: { id: string; name: string; chars: string[] }[] = [
  { id: "upper", name: "Chữ HOA", chars: [...UP, "Đ"] },
  { id: "lower", name: "Chữ thường", chars: [...LOW, "đ"] },
  { id: "digit", name: "Số", chars: DIG },
  { id: "mark", name: "Dấu thanh và dấu phụ", chars: [...TONES.map((t) => t.ch), ...DIACRITICS.map((d) => d.ch)] },
  { id: "symbol", name: "Ký hiệu", chars: SYMBOLS },
];
/** Ký tự bắt buộc: A–Z, a–z, Đ, đ, 0–9, 5 dấu thanh, dấu mũ, trăng, móc */
export const REQUIRED = [...UP, ...LOW, "Đ", "đ", ...DIG, ...TONES.map((t) => t.ch), ...DIACRITICS.map((d) => d.ch)];
const MARK_NAMES: Record<string, string> = Object.fromEntries([...TONES, ...DIACRITICS].map((m) => [m.ch, `dấu ${m.name.toLowerCase()}`]));
export const charLabel = (ch: string) => MARK_NAMES[ch] ?? ch;
export const isMark = (ch: string) => ch in MARK_NAMES;

export function kindOf(ch: string): GlyphKind {
  if (TONES.some((t) => t.ch === ch)) return "tone";
  if (DIACRITICS.some((d) => d.ch === ch)) return "diacritic";
  if (/^[A-ZĐ]$/.test(ch)) return "upper";
  if (/^[a-zđ]$/.test(ch)) return "lower";
  if (/^[0-9]$/.test(ch)) return "digit";
  if (ch.normalize("NFD") !== ch && /\p{L}/u.test(ch)) return "precomposed";
  return "symbol";
}
/** phím gõ → ký tự (dấu thanh / dấu phụ gõ bằng ký tự đại diện) */
export function keyToChar(key: string) {
  const m = [...TONES, ...DIACRITICS].find((x) => x.key === key);
  return m ? m.ch : key;
}
export function missingChars(glyphs: Glyph[]) {
  const have = new Set(glyphs.map((g) => g.ch));
  return REQUIRED.filter((c) => !have.has(c));
}

// ---------- dựng chữ ----------
type Img = CanvasImageSource & { width: number; height: number };
export type LoadedFont = { id: string; variants: Map<string, Img[]> };
/** Tải ảnh các mảnh của 1 bộ font (chỉ các ký tự cần, nếu truyền chars) */
export async function loadCutoutFont(id: string, glyphs: Glyph[], load: (url: string) => Promise<Img>, chars?: Set<string>): Promise<LoadedFont> {
  const variants = new Map<string, Img[]>();
  await Promise.all(glyphs.filter((g) => g.font_id === id && (!chars || chars.has(g.ch))).map(async (g) => {
    try { const im = await load(g.url); variants.set(g.ch, [...(variants.get(g.ch) ?? []), im]); } catch { /* bỏ mảnh lỗi */ }
  }));
  return { id, variants };
}
/** Các ký tự (kể cả chữ gốc, dấu) cần để dựng 1 chuỗi */
export function charsNeeded(text: string) {
  const out = new Set<string>();
  for (const ch of text) {
    out.add(ch);
    const d = ch.normalize("NFD");
    for (const c of d) { out.add(c); if (/\p{L}/u.test(c)) { out.add(c.toUpperCase()); out.add(c.toLowerCase()); } }
    if (/\p{L}/u.test(ch)) { out.add(ch.toUpperCase()); out.add(ch.toLowerCase()); }
  }
  return out;
}

export type Piece = { img: Img | null; ch: string; cx: number; cy: number; w: number; h: number; rot: number };
export type CutoutOpts = { size: number; curve: number; chaos: number; spacing: number; seed: number };
const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0)!; h = Math.imul(h, 16777619); } return h >>> 0; };

/** Xếp chữ cut-out → các mảnh (mm, gốc toạ độ = tâm dòng chữ). Ngẫu nhiên theo seed + (ký tự, lần xuất hiện) → sửa 1 chữ không làm đổi các chữ khác. */
export function layoutCutout(text: string, font: LoadedFont | null, o: CutoutOpts) {
  const H = o.size, occ = new Map<string, number>();
  const pick = (ch: string, r: () => number): Img | null => {
    const v = font?.variants.get(ch);
    return v?.length ? v[Math.floor(r() * v.length) % v.length] : null;
  };
  const glyphOf = (ch: string, r: () => number) => pick(ch, r) ?? (/\p{L}/u.test(ch) ? pick(ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase(), r) : null);
  type Unit = { pieces: Piece[]; w: number }; // 1 ký tự (gồm dấu) trên đường thẳng, gốc x = mép trái
  const units: Unit[] = [];
  for (const ch of text) {
    if (ch === "\n") continue;
    if (/\s/.test(ch)) { units.push({ pieces: [], w: H * 0.4 }); continue; }
    const n = occ.get(ch) ?? 0; occ.set(ch, n + 1);
    const r = rng(hash(`${o.seed}|${ch}|${n}`));
    const k = 1 + (r() * 2 - 1) * 0.1 * o.chaos; // chênh kích thước ±10%
    const h = H * k, dy = (r() * 2 - 1) * 0.12 * H * o.chaos, rot = (r() * 2 - 1) * 10 * o.chaos;
    const pieces: Piece[] = [];
    let base: Img | null = pick(ch, r) ?? pick(ch.normalize("NFC"), r); // ký tự dựng sẵn
    let marks: string[] = [];
    let baseCh = ch;
    if (!base) {
      const d = ch.normalize("NFD");
      baseCh = d[0]; marks = [...d.slice(1)];
      if (ch === "Đ" || ch === "đ") { baseCh = ch; marks = []; }
      base = glyphOf(baseCh, r);
    }
    const bw = base ? (h * base.width) / base.height : h * 0.72;
    pieces.push({ img: base, ch: baseCh, cx: bw / 2, cy: dy, w: bw, h, rot });
    // dấu: phụ (mũ / trăng sát phía trên, móc góc trên phải) → thanh (trên cùng; nặng ở dưới)
    let top = dy - h / 2;
    const mh = h * 0.45;
    for (const m of marks.filter((c) => DIACRITICS.some((x) => x.ch === c)).concat(marks.filter((c) => TONES.some((x) => x.ch === c)))) {
      const im = pick(m, r);
      const mw = im ? (mh * im.width) / im.height : mh * 0.9;
      const jx = (r() * 2 - 1) * h * 0.06, jr = (r() * 2 - 1) * 12;
      if (m === "̛") pieces.push({ img: im, ch: m, cx: bw * 0.92 + jx, cy: dy - h * 0.32, w: mw, h: mh, rot: rot + jr });
      else if (m === "̣") pieces.push({ img: im, ch: m, cx: bw / 2 + jx, cy: dy + h / 2 + mh * 0.55, w: mw, h: mh, rot: rot + jr });
      else { const cy = top - mh * 0.42; pieces.push({ img: im, ch: m, cx: bw / 2 + jx, cy, w: mw, h: mh, rot: rot + jr }); top = cy - mh * 0.42; }
    }
    units.push({ pieces, w: bw });
  }
  const gap = H * 0.06 + o.spacing;
  const total = units.reduce((t, u) => t + u.w, 0) + gap * Math.max(0, units.length - 1);
  // xếp theo đường thẳng hoặc cung tròn (mỗi mảnh xoay vuông góc theo cung)
  const out: Piece[] = [];
  const c = Math.max(-1, Math.min(1, o.curve));
  const theta = Math.abs(c) * Math.PI * 0.9, R = theta > 0.01 ? total / theta : 0;
  let x = -total / 2;
  for (const u of units) {
    const mid = x + u.w / 2;
    for (const p of u.pieces) {
      const lx = x + p.cx, ly = p.cy;
      if (!R) { out.push({ ...p, cx: lx, cy: ly }); continue; }
      const phi = mid / R, s = Math.sign(c), off = lx - mid; // cầu vồng: tâm cung ở dưới · nụ cười: tâm cung ở trên
      const ax = R * Math.sin(phi), ay = s * R * (1 - Math.cos(phi));
      const t = s * phi;
      out.push({ ...p, cx: ax + off * Math.cos(t) - ly * Math.sin(t), cy: ay + off * Math.sin(t) + ly * Math.cos(t), rot: p.rot + (t * 180) / Math.PI });
    }
    x += u.w + gap;
  }
  const xs = out.flatMap((p) => [p.cx - p.w / 2, p.cx + p.w / 2]), ys = out.flatMap((p) => [p.cy - p.h / 2, p.cy + p.h / 2]);
  const bounds = out.length ? { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } : { x0: -H, x1: H, y0: -H / 2, y1: H / 2 };
  return { pieces: out, bounds };
}

/** Vẽ các mảnh (ctx đang ở hệ mm, gốc = tâm lớp chữ). Mảnh thiếu → giấy trắng in ký tự bằng font đậm. shadowPx = px / mm (bóng đổ). */
export function drawCutout(x: CanvasRenderingContext2D, pieces: Piece[], pxPerMm: number) {
  for (const p of pieces) {
    x.save();
    x.translate(p.cx, p.cy); x.rotate((p.rot * Math.PI) / 180);
    x.shadowColor = "rgba(40,30,20,0.22)"; x.shadowBlur = 1.1 * pxPerMm; x.shadowOffsetX = 0.2 * pxPerMm; x.shadowOffsetY = 0.45 * pxPerMm;
    if (p.img) x.drawImage(p.img, -p.w / 2, -p.h / 2, p.w, p.h);
    else {
      x.fillStyle = "#fffdf7"; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.shadowColor = "transparent";
      x.fillStyle = "#18181b"; x.textAlign = "center"; x.textBaseline = "middle";
      x.font = `900 ${p.h * 0.78}px "Be Vietnam Pro", "Inter", sans-serif`;
      x.fillText(isMark(p.ch) ? `◌${p.ch}`.slice(-1) : p.ch, 0, p.h * 0.04);
    }
    x.restore();
  }
}
