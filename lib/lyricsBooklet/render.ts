"use client";

/* Booklet Lyrics — vẽ 1 trang booklet (120 × 120 mm) và bìa sau có tracklist (150 × 117 mm, 2 gáy 6 mm).
   Lyrics chia 3 cột (khoảng cách 4 mm), cỡ chữ tự co 7.5pt → tối thiểu (mặc định 6.5pt), line-height 1.3, không tràn khung.
   Xếp "Nối đuôi": các bài chảy liên tục qua các cột / trang lyrics (flowLayout), cỡ chữ cố định theo lựa chọn. */
import { BACK_H_CM, BACK_SPINE_CM, BACK_W_CM, LEFT_SPINE_ROTATION, RIGHT_SPINE_ROTATION } from "@/lib/cdSpecs";
import { contentBox } from "./layout";
import { DEFAULT_FORMAT, FONT_SIZES, PAGE_MM as P, PT, type Adjust, type Album, type BackId, type Block, type LyricsFormat, type Page, type Palette, type Song } from "./types";
import { collapseRepeats, toInline } from "./format";

type Img = CanvasImageSource & { width: number; height: number };
export type Ctx = {
  songs: Song[]; album: Album; photos: (Img | null)[]; adjust?: Record<number, Adjust | undefined>; palette: Palette;
  titleFont: string; bodyFont: string; minPt: number; mode?: "preview" | "print"; guides?: boolean; editSlot?: number | null; hoverSlot?: number | null;
  fmt?: LyricsFormat; // cỡ chữ lời + kiểu lời (mặc định: Bình thường · Nguyên bản)
  cover?: Img | null; coverAdj?: Adjust; // ảnh bìa riêng (trang 1)
};
export type PageHit = { k: "photo"; slot: number; x: number; y: number; w: number; h: number; rot: number } | { k: "song"; song: number; x: number; y: number; w: number; h: number; rot: number }
  | { k: "cover"; x: number; y: number; w: number; h: number; rot: number };

let fontEpoch = 0; // tăng khi font tải xong → đo lại luồng chữ "Nối đuôi"
export async function loadBookletFonts(title: string, body: string) {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([`700 20px "${title}"`, `400 20px "${body}"`, `600 20px "${body}"`, `italic 400 20px "${body}"`].map((f) => document.fonts.load(f, "Aăâđêôơư").catch(() => null)));
  fontEpoch++;
}

const rad = (d: number) => (d * Math.PI) / 180;
let K = 1; // px / mm (cho shadowBlur)
function drawPhoto(x: CanvasRenderingContext2D, img: Img | null, w: number, h: number, adj: Adjust | undefined, empty: string, plus: boolean) {
  if (!img) {
    x.fillStyle = empty; x.fillRect(-w / 2, -h / 2, w, h);
    if (plus) { x.strokeStyle = "#a1a1aa"; x.lineWidth = 0.6; const s = Math.min(8, Math.min(w, h) * 0.18); x.beginPath(); x.moveTo(-s / 2, 0); x.lineTo(s / 2, 0); x.moveTo(0, -s / 2); x.lineTo(0, s / 2); x.stroke(); }
    return;
  }
  const z = Math.max(1, adj?.zoom ?? 1), s = Math.max(w / img.width, h / img.height) * z;
  const dw = img.width * s, dh = img.height * s, mx = (dw - w) / 2, my = (dh - h) / 2;
  x.drawImage(img, -dw / 2 + Math.max(-mx, Math.min(mx, adj?.dx ?? 0)), -dh / 2 + Math.max(-my, Math.min(my, adj?.dy ?? 0)), dw, dh);
}

// ---------- chữ ----------
function wrap(x: CanvasRenderingContext2D, text: string, maxW: number) {
  if (!text) return [""];
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/(\s+)/)) {
    const tryLine = line + word;
    if (x.measureText(tryLine).width <= maxW || !line.trim()) {
      if (x.measureText(tryLine).width > maxW) { // 1 từ quá dài → ngắt theo ký tự
        let cur = "";
        for (const ch of tryLine) { if (x.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; } else cur += ch; }
        line = cur;
      } else line = tryLine;
    } else { out.push(line.trimEnd()); line = word.trimStart(); }
  }
  out.push(line.trimEnd());
  return out;
}
// ---------- dàn lời 1 bài (dùng chung cho vẽ + tính sức chứa theo chiều cao thật) ----------
type LLine = { t: string; justify: boolean; bold?: string }; // bold: tiền tố in đậm ở đầu dòng (tên bài liền dòng)
type Laid = { lines: LLine[]; size: number; lh: number; perCol: number; fits: boolean; titleInline: boolean };
const sizeOf = (fmt: LyricsFormat, minPt: number) => { const f = FONT_SIZES.find((x) => x.id === fmt.size) ?? FONT_SIZES[0]; return { pt: f.pt, min: fmt.size === "normal" ? Math.min(f.pt, minPt) : f.min }; };
export const titleSizeOf = (fmt: LyricsFormat) => 11 * PT * ((FONT_SIZES.find((x) => x.id === fmt.size) ?? FONT_SIZES[0]).pt / 7.5);
/** dòng hiển thị theo kiểu lời (không sửa lời gốc) */
function displayOf(s: Song, fmt: LyricsFormat): { mode: "lines"; lines: string[] } | { mode: "inline"; paras: string[] } {
  const style = s.style ?? fmt.style, o = { lang: fmt.lang, labels: s.labels, noMerge: s.noMerge };
  if (style === "inline") return { mode: "inline", paras: toInline(s.lyrics, { ...o, paraBreak: fmt.paraBreak }) };
  if (style === "collapse") {
    const lines: string[] = [];
    collapseRepeats(s.lyrics, o).forEach((bl, i) => {
      if (i) lines.push("");
      if (bl.kind === "ref") lines.push(`(${bl.label})`);
      else { if (bl.label) lines.push(`[${bl.label}]`); lines.push(...bl.lines); }
    });
    return { mode: "lines", lines };
  }
  return { mode: "lines", lines: s.lyrics.split("\n") };
}
// ngắt dòng liền: " / " và " // " dính vào từ phía trước → không bao giờ đứng đầu dòng; dòng (trừ dòng cuối đoạn) căn đều 2 bên
function wrapInline(x: CanvasRenderingContext2D, text: string, maxW: number, firstIndent: number): LLine[] {
  const raw = text.split(/\s+/).filter(Boolean), words: string[] = [];
  for (const w of raw) { if ((w === "/" || w === "//") && words.length) words[words.length - 1] += ` ${w}`; else words.push(w); }
  const out: LLine[] = [];
  let line = "", avail = maxW - firstIndent;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (x.measureText(t).width <= avail || !line) line = t;
    else { out.push({ t: line, justify: true }); line = w; avail = maxW; }
  }
  if (line) out.push({ t: line, justify: false });
  return out;
}
function linesAt(x: CanvasRenderingContext2D, d: ReturnType<typeof displayOf>, s: Song, si: number, size: number, font: string, titleFont: string, colW: number, inlineTitle: boolean): LLine[] {
  x.font = `400 ${size}px "${font}"`;
  if (d.mode !== "inline") return d.lines.flatMap((l) => (l.trim() ? wrap(x, l, colW).map((t) => ({ t, justify: false })) : [{ t: "", justify: false }]));
  const prefix = inlineTitle ? `${si + 1}. ${(s.title || `Bài ${si + 1}`).toUpperCase()} — ` : "";
  x.font = `700 ${size}px "${titleFont}"`;
  const pw = prefix ? x.measureText(prefix).width : 0;
  x.font = `400 ${size}px "${font}"`;
  const lines = d.paras.flatMap((para, i) => { const L = wrapInline(x, para, colW, i === 0 ? pw : 0); if (i === 0 && prefix && L[0]) L[0].bold = prefix; return L; });
  return !lines.length && prefix ? [{ t: "", justify: false, bold: prefix }] : lines;
}
function laySong(x: CanvasRenderingContext2D, s: Song, si: number, fmt: LyricsFormat, minPt: number, font: string, titleFont: string, colW: number, bodyH: number): Laid {
  const d = displayOf(s, fmt), { pt, min } = sizeOf(fmt, minPt);
  const inlineTitle = d.mode === "inline" && fmt.titleInline;
  let last: Laid | null = null;
  for (let p = pt; p >= min - 1e-6; p -= 0.25) {
    const size = p * PT, lh = size * 1.3;
    const lines = linesAt(x, d, s, si, size, font, titleFont, colW, inlineTitle);
    const perCol = Math.max(1, Math.floor(bodyH / lh));
    last = { lines, size, lh, perCol, fits: lines.length <= perCol * 3, titleInline: inlineTitle };
    if (last.fits) return last;
  }
  return last!;
}
let measureCtx: CanvasRenderingContext2D | null = null;
/** Bài có vừa khung (w × h mm, gồm tên bài + 3 cột) ở cỡ chữ nhỏ nhất cho phép không — đo bằng canvas, đúng font / cỡ / độ rộng cột */
export function songFits(s: Song, si: number, c: Pick<Ctx, "bodyFont" | "titleFont" | "minPt" | "fmt">, w: number, h: number) {
  if (s.titleOnly || !s.lyrics.trim()) return true;
  if (typeof document === "undefined") return true;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const fmt = c.fmt ?? DEFAULT_FORMAT, tSize = titleSizeOf(fmt), colW = (w - 8) / 3;
  const inl = (s.style ?? fmt.style) === "inline" && fmt.titleInline;
  const bodyH = h - (inl ? 0 : tSize * 1.5) - (s.note.trim() ? 3.4 : 0);
  return laySong(measureCtx!, s, si, fmt, c.minPt, c.bodyFont, c.titleFont, colW, bodyH).fits;
}
function drawLine(x: CanvasRenderingContext2D, ln: LLine, t: string, X: number, Y: number, colW: number, size: number, c: Ctx) {
  let ox = 0;
  if (ln.bold) { x.font = `700 ${size}px "${c.titleFont}"`; x.fillStyle = c.palette.accent; x.fillText(ln.bold, X, Y); ox = x.measureText(ln.bold).width; }
  x.font = `400 ${size}px "${c.bodyFont}"`; x.fillStyle = c.palette.ink;
  const words = t.split(" ");
  if (ln.justify && words.length > 1) {
    // căn đều 2 bên trong cột
    const wsum = words.reduce((a, w) => a + x.measureText(w).width, 0), gap = (colW - ox - wsum) / (words.length - 1);
    let cx = X + ox;
    for (const w of words) { x.fillText(w, cx, Y); cx += x.measureText(w).width + gap; }
  } else x.fillText(t, X + ox, Y);
}

// ---------- "Nối đuôi": luồng chữ liên tục qua các cột (3 cột / trang lyrics, cột cao bằng khung nội dung) ----------
export type FlowItem = { si: number; y: number; h: number } & ({ t: "title"; text: string; size: number } | { t: "line"; ln: LLine } | { t: "note"; text: string });
export type Flow = { cols: FlowItem[][]; size: number; lh: number; colW: number; colH: number; endCol: number[] };
const COL_GAP = 4;
let flowCache: { k: unknown[]; v: Flow } | null = null;
export function flowLayout(c: Pick<Ctx, "songs" | "bodyFont" | "titleFont" | "minPt" | "fmt">): Flow {
  const key = [c.songs, c.bodyFont, c.titleFont, c.minPt, c.fmt, fontEpoch];
  if (flowCache && flowCache.k.every((v, i) => v === key[i])) return flowCache.v;
  const box = contentBox(2), colW = (box.w - COL_GAP * 2) / 3, colH = box.h;
  const fmt = c.fmt ?? DEFAULT_FORMAT, size = sizeOf(fmt, c.minPt).pt * PT, lh = size * 1.3, tSize = titleSizeOf(fmt), tlh = tSize * 1.25;
  const out: Flow = { cols: [[]], size, lh, colW, colH, endCol: [] };
  if (typeof document === "undefined") return out;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const x = measureCtx!;
  let y = 0;
  const col = () => out.cols[out.cols.length - 1];
  const nextCol = () => { out.cols.push([]); y = 0; };
  const blank = (l: LLine) => !l.t && !l.bold;
  c.songs.forEach((s, si) => {
    const has = !s.titleOnly && !!s.lyrics.trim(), d = displayOf(s, fmt);
    const inl = has && d.mode === "inline" && fmt.titleInline;
    const lines = has ? linesAt(x, d, s, si, size, c.bodyFont, c.titleFont, colW, inl) : [];
    while (lines.length && blank(lines[0])) lines.shift();
    while (lines.length && blank(lines[lines.length - 1])) lines.pop();
    let title: string[] = [];
    if (!inl) { x.font = `700 ${tSize}px "${c.titleFont}"`; title = wrap(x, `${si + 1}. ${s.title || `Bài ${si + 1}`}`, colW); }
    const sep = title.length && lines.length ? tSize * 0.35 : 0;
    // tên bài không nằm cuối cột: sau tên phải còn chỗ cho ít nhất 2 dòng lời
    const head = title.length * tlh + sep + Math.min(2, lines.length || 0) * lh;
    if (y > 0 && y + lh * 1.5 + head > colH) nextCol(); else if (y > 0) y += lh * 1.5;
    for (const t of title) { col().push({ si, y, h: tlh, t: "title", text: t, size: tSize }); y += tlh; }
    y += sep;
    for (const ln of lines) {
      if (y + lh > colH + 1e-6) { nextCol(); if (blank(ln)) continue; }
      col().push({ si, y, h: lh, t: "line", ln }); y += lh;
    }
    if (s.note.trim()) { if (y + 3.4 > colH) nextCol(); col().push({ si, y, h: 3.4, t: "note", text: s.note.trim() }); y += 3.4; }
    out.endCol.push(out.cols.length - 1);
  });
  flowCache = { k: key, v: out };
  return out;
}
/** số trang lyrics cần cho kiểu "Nối đuôi" (3 cột / trang) */
export const flowPages = (c: Pick<Ctx, "songs" | "bodyFont" | "titleFont" | "minPt" | "fmt">) => (c.songs.length ? Math.ceil(flowLayout(c).cols.length / 3) : 0);
function drawFlow(x: CanvasRenderingContext2D, b: Extract<Block, { k: "flow" }>, c: Ctx, hits: PageHit[]) {
  const f = flowLayout(c);
  x.textAlign = "left"; x.textBaseline = "top";
  for (let ci = b.from; ci < Math.min(b.to, f.cols.length); ci++) {
    const X = b.x + (ci - b.from) * (f.colW + COL_GAP), seg = new Map<number, [number, number]>();
    for (const it of f.cols[ci]) {
      const Y = b.y + it.y;
      if (it.t === "title") { x.font = `700 ${it.size}px "${c.titleFont}"`; x.fillStyle = c.palette.accent; x.fillText(it.text, X, Y); }
      else if (it.t === "line") drawLine(x, it.ln, it.ln.t, X, Y, f.colW, f.size, c);
      else { x.font = `italic 400 ${2.3}px "${c.bodyFont}"`; x.fillStyle = c.palette.ink; x.globalAlpha = 0.7; x.fillText(it.text, X, Y + 0.6); x.globalAlpha = 1; }
      const r = seg.get(it.si); seg.set(it.si, r ? [r[0], it.y + it.h] : [it.y, it.y + it.h]);
    }
    for (const [si, [y0, y1]] of seg) hits.push({ k: "song", song: si, x: X + f.colW / 2, y: b.y + (y0 + y1) / 2, w: f.colW, h: y1 - y0, rot: 0 });
  }
}
function fitText(x: CanvasRenderingContext2D, text: string, weight: string, family: string, size: number, maxW: number) {
  let s = size;
  x.font = `${weight} ${s}px "${family}"`;
  const w = x.measureText(text).width;
  if (w > maxW) { s *= maxW / w; x.font = `${weight} ${s}px "${family}"`; }
  return s;
}
/** Khối lyrics: 1 hoặc 2 bài (chia trên / dưới, ngăn bằng đường mảnh). Trả về vùng bấm của từng bài. */
function drawLyrics(x: CanvasRenderingContext2D, b: Extract<Block, { k: "lyrics" }>, c: Ctx, hits: PageHit[]) {
  const colGap = 4, colW = (b.w - colGap * 2) / 3;
  const parts = b.songs.map((i) => c.songs[i]);
  const need = parts.map((s) => (s.titleOnly || !s.lyrics.trim() ? 8 : 10 + s.lyrics.split("\n").length));
  const tot = need.reduce((a, v) => a + v, 0);
  let y = b.y;
  b.songs.forEach((si, k) => {
    const s = c.songs[si];
    const h = b.songs.length === 1 ? b.h : Math.max(b.h * 0.3, Math.min(b.h * 0.7, (b.h - 4) * (need[k] / tot)));
    const top = y;
    // tên bài + số thứ tự (co theo cỡ chữ lời); kiểu "Liền dòng" có thể đặt tên bài liền với lời
    const fmt = c.fmt ?? DEFAULT_FORMAT, tSize = titleSizeOf(fmt);
    const inlineTitle = (s.style ?? fmt.style) === "inline" && fmt.titleInline && !s.titleOnly && !!s.lyrics.trim();
    x.fillStyle = c.palette.accent; x.textAlign = "left"; x.textBaseline = "top";
    if (!inlineTitle) {
      fitText(x, `${si + 1}. ${s.title || `Bài ${si + 1}`}`, "700", c.titleFont, tSize, b.w);
      x.fillText(`${si + 1}. ${s.title || `Bài ${si + 1}`}`, b.x, top);
    }
    const noteH = s.note.trim() ? 3.4 : 0;
    const bodyTop = top + (inlineTitle ? 0 : tSize * 1.5), bodyH = h - (inlineTitle ? 0 : tSize * 1.5) - noteH;
    if (!s.titleOnly && s.lyrics.trim()) {
      const L = laySong(x, s, si, fmt, c.minPt, c.bodyFont, c.titleFont, colW, bodyH);
      const max = L.perCol * 3;
      L.lines.slice(0, max).forEach((ln, i) => {
        const col = Math.floor(i / L.perCol), row = i % L.perCol;
        const X = b.x + col * (colW + colGap), Y = bodyTop + row * L.lh;
        let t = ln.t;
        if (!L.fits && i === max - 1) t = `${t.replace(/.{0,2}$/, "")}…`;
        drawLine(x, ln, t, X, Y, colW, L.size, c);
      });
    }
    if (noteH) { x.font = `italic 400 ${2.3}px "${c.bodyFont}"`; x.fillStyle = c.palette.ink; x.globalAlpha = 0.7; x.fillText(s.note.trim(), b.x, top + h - noteH + 0.6); x.globalAlpha = 1; }
    hits.push({ k: "song", song: si, x: b.x + b.w / 2, y: top + h / 2, w: b.w, h, rot: 0 });
    y += h;
    if (k === 0 && b.songs.length > 1) {
      x.strokeStyle = c.palette.ink; x.globalAlpha = 0.35; x.lineWidth = 0.2;
      x.beginPath(); x.moveTo(b.x, y + 2); x.lineTo(b.x + b.w, y + 2); x.stroke(); x.globalAlpha = 1;
      y += 4;
    }
  });
}

/** Vẽ 1 trang booklet. size = px cạnh trang. */
export function renderPage(page: Page, c: Ctx, size: number) {
  const N = Math.round(size), k = N / P;
  K = k;
  const cv = document.createElement("canvas"); cv.width = cv.height = N;
  const x = cv.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.scale(k, k);
  x.fillStyle = c.palette.bg; x.fillRect(0, 0, P, P);
  const hits: PageHit[] = [];
  const print = c.mode === "print";
  for (const b of page.blocks) {
    x.save();
    if (b.k === "photo") {
      const img = c.photos[b.slot] ?? null;
      x.translate(b.x + b.w / 2, b.y + b.h / 2); x.rotate(rad(b.rot ?? 0));
      if (b.polaroid) {
        x.shadowColor = "rgba(0,0,0,0.22)"; x.shadowBlur = 1.6 * K; x.shadowOffsetY = 0.6 * K;
        x.fillStyle = "#fffdf8"; x.fillRect(-b.w / 2 - 2.5, -b.h / 2 - 2.5, b.w + 5, b.h + 11);
        x.shadowColor = "transparent";
      }
      x.save(); x.beginPath(); x.rect(-b.w / 2, -b.h / 2, b.w, b.h); x.clip();
      drawPhoto(x, img, b.w, b.h, c.adjust?.[b.slot], print ? c.palette.bg : "#ececef", !print);
      x.restore();
      if (!print && (c.editSlot === b.slot || c.hoverSlot === b.slot)) { x.setLineDash([1.4, 1]); x.lineWidth = 0.6; x.strokeStyle = "#ff5fa2"; x.strokeRect(-b.w / 2 + 0.4, -b.h / 2 + 0.4, b.w - 0.8, b.h - 0.8); }
      hits.push({ k: "photo", slot: b.slot, x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, rot: b.rot ?? 0 });
    } else if (b.k === "lyrics") drawLyrics(x, b, c, hits);
    else if (b.k === "flow") drawFlow(x, b, c, hits);
    else if (b.k === "cover") {
      // ảnh bìa riêng tràn trang; chưa có ảnh → ô xám "+ Tải ảnh bìa"
      x.save(); x.beginPath(); x.rect(b.x, b.y, b.w, b.h); x.clip(); x.translate(b.x + b.w / 2, b.y + b.h / 2);
      if (c.cover) drawPhoto(x, c.cover, b.w, b.h, c.coverAdj, "", false);
      else {
        x.fillStyle = print ? c.palette.bg : "#ececef"; x.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        if (!print) { x.fillStyle = "#71717a"; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `600 ${5}px "${c.bodyFont}"`; x.fillText("+ Tải ảnh bìa", 0, c.album.coverText !== false ? -b.h * 0.12 : 0); }
      }
      x.restore();
      if (c.album.coverText !== false) {
        const band = { y: b.y + b.h * 0.7, h: b.h * 0.3 };
        x.globalAlpha = 0.9; x.fillStyle = c.palette.bg; x.fillRect(b.x, band.y, b.w, band.h); x.globalAlpha = 1;
        const box = contentBox(1);
        x.fillStyle = c.palette.ink; x.textAlign = "left"; x.textBaseline = "alphabetic";
        const ts = fitText(x, c.album.title || "Tên album", "700", c.titleFont, 9, box.w);
        x.fillText(c.album.title || "Tên album", box.x, band.y + 6 + ts);
        x.font = `400 ${3.6}px "${c.bodyFont}"`; x.fillStyle = c.palette.accent;
        x.fillText(c.album.artist || "Tên nghệ sĩ", box.x, band.y + 12 + ts);
      }
      hits.push({ k: "cover", x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, rot: 0 });
    }
    x.restore();
  }
  if (!print && c.guides) {
    const box = contentBox(page.no);
    x.save(); x.setLineDash([1.2, 1]); x.lineWidth = 0.25; x.strokeStyle = "rgba(60,60,70,0.5)";
    x.strokeRect(box.x, box.y, box.w, box.h);
    x.setLineDash([]); x.strokeStyle = "rgba(255,95,162,0.8)"; x.lineWidth = 0.5;
    const gx = page.no % 2 === 1 ? 0.25 : P - 0.25; // đường gáy
    x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, P); x.stroke();
    x.restore();
  }
  return { canvas: cv, hits };
}

// ---------- bìa sau có tracklist (15 × 11.7 cm, 2 gáy 0.6 cm) ----------
const BW = BACK_W_CM * 10, BH = BACK_H_CM * 10, SP = BACK_SPINE_CM * 10;
export const BACK_MM = { w: BW, h: BH };
export function renderBack(style: BackId, c: Ctx, bgPhoto: Img | null, widthPx: number) {
  const k = widthPx / BW, W = Math.round(widthPx), H = Math.round(BH * k);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.scale(k, k);
  const dark = style === "photo" && !!bgPhoto;
  x.fillStyle = c.palette.bg; x.fillRect(0, 0, BW, BH);
  if (bgPhoto) {
    const s = Math.max(BW / bgPhoto.width, BH / bgPhoto.height);
    x.save(); if (style !== "photo") x.globalAlpha = 0.18;
    x.drawImage(bgPhoto, BW / 2 - (bgPhoto.width * s) / 2, BH / 2 - (bgPhoto.height * s) / 2, bgPhoto.width * s, bgPhoto.height * s);
    x.restore();
    if (dark) { x.fillStyle = "rgba(0,0,0,0.45)"; x.fillRect(0, 0, BW, BH); }
  }
  const ink = dark ? "#ffffff" : c.palette.ink, accent = dark ? "#ffffff" : c.palette.accent;
  // 2 gáy: chữ tên album · nghệ sĩ theo hướng chữ của gáy (lib/cdSpecs)
  const spineText = [c.album.title, c.album.artist].filter(Boolean).join(" · ") || "Tên album";
  for (const [x0, rot] of [[0, LEFT_SPINE_ROTATION], [BW - SP, RIGHT_SPINE_ROTATION]] as const) {
    x.save();
    x.fillStyle = accent; x.globalAlpha = dark ? 0.25 : 0.12; x.fillRect(x0, 0, SP, BH); x.globalAlpha = 1;
    x.translate(x0 + SP / 2, BH / 2); x.rotate(rad(rot));
    x.fillStyle = ink; x.textAlign = "center"; x.textBaseline = "middle";
    fitText(x, spineText, "700", c.titleFont, 2.6, BH - 10);
    x.fillText(spineText, 0, 0);
    x.restore();
  }
  if (c.mode !== "print" && c.guides) {
    x.save(); x.setLineDash([1.2, 1]); x.strokeStyle = "rgba(255,95,162,0.8)"; x.lineWidth = 0.3;
    for (const gx of [SP, BW - SP]) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, BH); x.stroke(); }
    x.restore();
  }
  // tracklist
  const list = c.songs.map((s, i) => ({ no: i + 1, t: s.title || `Bài ${i + 1}`, d: s.duration.trim() }));
  const area = { x: SP + 9, y: 12, w: BW - SP * 2 - 18, h: BH - 30 };
  const drawRows = (rows: typeof list, X: number, Y: number, w: number, size: number, align: "center" | "left") => {
    const lh = size * 1.55;
    rows.forEach((r, i) => {
      const y = Y + i * lh;
      x.font = `400 ${size}px "${c.bodyFont}"`; x.fillStyle = ink; x.textBaseline = "top";
      const label = `${r.no}. ${r.t}`;
      if (align === "center" && !r.d) { x.textAlign = "center"; x.fillText(label, X + w / 2, y); return; }
      x.textAlign = "left";
      let lw = x.measureText(label).width;
      const dw = r.d ? x.measureText(r.d).width : 0;
      let shown = label;
      while (lw > w - dw - 4 && shown.length > 3) { shown = shown.slice(0, -2) + "…"; lw = x.measureText(shown).width; }
      x.fillText(shown, X, y);
      if (r.d) {
        x.textAlign = "right"; x.fillText(r.d, X + w, y);
        x.globalAlpha = 0.45; x.setLineDash([0.4, 0.9]); x.strokeStyle = ink; x.lineWidth = 0.25;
        x.beginPath(); x.moveTo(X + lw + 1.2, y + size * 0.8); x.lineTo(X + w - dw - 1.2, y + size * 0.8); x.stroke();
        x.setLineDash([]); x.globalAlpha = 1;
      }
    });
  };
  const sizeFor = (rows: number, h: number, max: number) => Math.max(1.9, Math.min(max, h / (rows * 1.55)));
  x.textBaseline = "top";
  if (style === "corner") {
    x.fillStyle = accent; x.textAlign = "left";
    fitText(x, c.album.title || "Tên album", "700", c.titleFont, 4, area.w / 2);
    x.fillText(c.album.title || "Tên album", area.x, area.y);
    const sz = sizeFor(list.length, BH * 0.55, 2.6);
    drawRows(list, area.x, BH - 14 - list.length * sz * 1.55, Math.min(62, area.w), sz, "left");
  } else if (style === "twocol") {
    x.fillStyle = accent; x.textAlign = "center";
    fitText(x, c.album.title || "Tên album", "700", c.titleFont, 5.5, area.w);
    x.fillText(c.album.title || "Tên album", BW / 2, area.y);
    const half = Math.ceil(list.length / 2), top = area.y + 11, h = area.h - 11;
    const sz = sizeFor(half, h, 3.4), cw = (area.w - 8) / 2;
    drawRows(list.slice(0, half), area.x, top, cw, sz, "left");
    drawRows(list.slice(half), area.x + cw + 8, top, cw, sz, "left");
  } else {
    x.fillStyle = accent; x.textAlign = "center";
    fitText(x, c.album.title || "Tên album", "700", c.titleFont, 5.5, area.w);
    x.fillText(c.album.title || "Tên album", BW / 2, area.y);
    const top = area.y + 11, h = area.h - 11;
    const sz = sizeFor(list.length, h, 3.6), w = Math.min(92, area.w);
    drawRows(list, BW / 2 - w / 2, top + Math.max(0, (h - list.length * sz * 1.55) / 2), w, sz, style === "classic" ? "center" : "left");
  }
  return cv;
}

/** Màu chủ đạo dịu lấy từ ảnh bìa → bảng màu "Tự động" */
export function paletteFromImage(img: Img | null): Palette | null {
  if (!img) return null;
  const c = document.createElement("canvas"); c.width = c.height = 24;
  const x = c.getContext("2d")!; x.drawImage(img, 0, 0, 24, 24);
  const d = x.getImageData(0, 0, 24, 24).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4; r /= n; g /= n; b /= n;
  const mix = (a: number, t: number, k2: number) => Math.round(a + (t - a) * k2);
  const hex = (R: number, G: number, B: number) => `#${[R, G, B].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return { id: "auto", name: "Tự động", bg: hex(mix(r, 255, 0.8), mix(g, 255, 0.8), mix(b, 255, 0.8)), ink: hex(mix(r, 0, 0.78), mix(g, 0, 0.78), mix(b, 0, 0.78)), accent: hex(mix(r, 0, 0.35), mix(g, 0, 0.35), mix(b, 0, 0.35)) };
}
export const inBox = (px: number, py: number, b: { x: number; y: number; w: number; h: number; rot: number }) => {
  const a = -rad(b.rot), dx = px - b.x, dy = py - b.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= b.w / 2 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= b.h / 2;
};
