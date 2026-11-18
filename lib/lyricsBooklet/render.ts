"use client";

/* Booklet Lyrics — vẽ 1 trang booklet (120 × 120 mm) và bìa sau có tracklist (150 × 117 mm, 2 gáy 6 mm).
   Lyrics chia 3 cột (khoảng cách 4 mm), cỡ chữ tự co 7.5pt → tối thiểu (mặc định 6.5pt), line-height 1.3, không tràn khung. */
import { BACK_H_CM, BACK_SPINE_CM, BACK_W_CM, LEFT_SPINE_ROTATION, RIGHT_SPINE_ROTATION } from "@/lib/cdSpecs";
import { contentBox } from "./layout";
import { PAGE_MM as P, PT, type Adjust, type Album, type BackId, type Block, type Page, type Palette, type Song } from "./types";

type Img = CanvasImageSource & { width: number; height: number };
export type Ctx = {
  songs: Song[]; album: Album; photos: (Img | null)[]; adjust?: Record<number, Adjust | undefined>; palette: Palette;
  titleFont: string; bodyFont: string; minPt: number; mode?: "preview" | "print"; guides?: boolean; editSlot?: number | null; hoverSlot?: number | null;
};
export type PageHit = { k: "photo"; slot: number; x: number; y: number; w: number; h: number; rot: number } | { k: "song"; song: number; x: number; y: number; w: number; h: number; rot: number };

export async function loadBookletFonts(title: string, body: string) {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([`700 20px "${title}"`, `400 20px "${body}"`, `600 20px "${body}"`, `italic 400 20px "${body}"`].map((f) => document.fonts.load(f, "Aăâđêôơư").catch(() => null)));
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
type Laid = { lines: string[]; size: number; lh: number; perCol: number; fits: boolean };
function layLyrics(x: CanvasRenderingContext2D, lyrics: string, font: string, colW: number, bodyH: number, minPt: number): Laid {
  const raw = lyrics.split("\n");
  let last: Laid | null = null;
  for (let pt = 7.5; pt >= minPt - 1e-6; pt -= 0.25) {
    const size = pt * PT, lh = size * 1.3;
    x.font = `400 ${size}px "${font}"`;
    const lines = raw.flatMap((l) => (l.trim() ? wrap(x, l, colW) : [""]));
    const perCol = Math.max(1, Math.floor(bodyH / lh));
    last = { lines, size, lh, perCol, fits: lines.length <= perCol * 3 };
    if (last.fits) return last;
  }
  return last!;
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
    // tên bài + số thứ tự
    const tSize = 11 * PT;
    x.fillStyle = c.palette.accent; x.textAlign = "left"; x.textBaseline = "top";
    fitText(x, `${si + 1}. ${s.title || `Bài ${si + 1}`}`, "700", c.titleFont, tSize, b.w);
    x.fillText(`${si + 1}. ${s.title || `Bài ${si + 1}`}`, b.x, top);
    const noteH = s.note.trim() ? 3.4 : 0;
    const bodyTop = top + tSize * 1.5, bodyH = h - tSize * 1.5 - noteH;
    if (!s.titleOnly && s.lyrics.trim()) {
      const L = layLyrics(x, s.lyrics, c.bodyFont, colW, bodyH, c.minPt);
      x.font = `400 ${L.size}px "${c.bodyFont}"`; x.fillStyle = c.palette.ink;
      const max = L.perCol * 3;
      L.lines.slice(0, max).forEach((ln, i) => {
        const col = Math.floor(i / L.perCol), row = i % L.perCol;
        let t = ln;
        if (!L.fits && i === max - 1) t = `${ln.replace(/.{0,2}$/, "")}…`;
        x.fillText(t, b.x + col * (colW + colGap), bodyTop + row * L.lh);
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
    else if (b.k === "cover") {
      x.globalAlpha = 0.9; x.fillStyle = c.palette.bg; x.fillRect(b.x, b.y, b.w, b.h); x.globalAlpha = 1;
      const box = contentBox(1);
      x.fillStyle = c.palette.ink; x.textAlign = "left"; x.textBaseline = "alphabetic";
      const ts = fitText(x, c.album.title || "Tên album", "700", c.titleFont, 9, box.w);
      x.fillText(c.album.title || "Tên album", box.x, b.y + 6 + ts);
      x.font = `400 ${3.6}px "${c.bodyFont}"`; x.fillStyle = c.palette.accent;
      x.fillText([c.album.artist, c.album.year].filter(Boolean).join(" · ") || "Tên nghệ sĩ", box.x, b.y + 12 + ts);
    } else if (b.k === "credit") {
      x.fillStyle = c.palette.accent; x.textAlign = "center"; x.textBaseline = "top";
      fitText(x, "Lời cảm ơn", "700", c.titleFont, 6, b.w);
      x.fillText("Lời cảm ơn", b.x + b.w / 2, b.y + 14);
      x.font = `400 ${3.1}px "${c.bodyFont}"`; x.fillStyle = c.palette.ink;
      const lines = c.album.credit.split("\n").flatMap((l) => wrap(x, l, b.w - 10));
      const lh = 3.1 * 1.45;
      lines.slice(0, Math.floor((b.h - 30) / lh)).forEach((l, i) => x.fillText(l, b.x + b.w / 2, b.y + 26 + i * lh));
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
  const foot = [c.album.year, c.album.credit.split("\n")[0]].filter((v) => v && v.trim()).join(" · ");
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
  if (foot) { x.font = `400 ${2.2}px "${c.bodyFont}"`; x.fillStyle = ink; x.globalAlpha = 0.75; x.textAlign = "center"; x.fillText(foot, BW / 2, BH - 9); x.globalAlpha = 1; }
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
