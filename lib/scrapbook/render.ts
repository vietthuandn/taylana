"use client";

/* CD Scrapbook — vẽ 1 mẫu (danh sách lớp, đơn vị mm) lên canvas tròn.
   Hiệu ứng tạo bằng code: mép giấy xé (răng cưa ngẫu nhiên + viền xơ giấy trắng ngà), bóng đổ mềm cho mọi lớp dán,
   nền giấy có vân + grain. Ảnh khách phủ kín khung (cover), có thể dịch / phóng to theo chỉnh ô của khách.
   mode "print": nền ngoài đĩa + lỗ giữa (Ø 23 mm) trong suốt, không guideline. */
import { rng } from "./generate";
import { drawCutout, layoutCutout, type LoadedFont } from "./cutout";
import { C, R_HOLE, R_HUB, R_OUT, R_PRINT_HOLE, R_SAFE, type Adjust, type DiscText, type Layer, type ScrapAsset, type Template } from "./types";

type Img = CanvasImageSource & { width: number; height: number };
export type PhotoSrc = Img | null;
export type Hit = { slot: number; x: number; y: number; w: number; h: number; rot: number; shape: string };
export type TextHit = { role: "main" | "sub" | "custom"; layer: number; x: number; y: number; w: number; h: number; rot: number };
export type RenderOpts = {
  template: Template; photos: PhotoSrc[]; adjust?: Record<number, Adjust | undefined>; text: DiscText;
  assets?: Record<string, { img: Img; asset: ScrapAsset } | undefined>;
  size: number; mode?: "preview" | "print"; guides?: boolean; editSlot?: number | null; hoverSlot?: number | null;
  cutoutFonts?: Record<string, LoadedFont | undefined>; // font cut-out đã tải ảnh
};

export const FONTS = { hand: '"Dancing Script", cursive', marker: '"Patrick Hand", "Itim", cursive', label: '"Pangolin", "Itim", sans-serif' } as const;
/** Đợi font chữ viết tay tải xong (canvas không tự chờ font) */
export async function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(["700 20px \"Dancing Script\"", "20px \"Patrick Hand\"", "20px \"Pangolin\""].map((f) => document.fonts.load(f, "Aăâđêôơư").catch(() => null)));
}

type X = CanvasRenderingContext2D;
const rad = (d: number) => (d * Math.PI) / 180;
let px = 1; // px / mm của lần vẽ hiện tại (cho shadowBlur — không bị ảnh hưởng bởi scale)
function shadow(x: X, blur = 1.4, oy = 0.6, a = 0.2) { x.shadowColor = `rgba(40,30,20,${a})`; x.shadowBlur = blur * px; x.shadowOffsetX = 0.25 * px; x.shadowOffsetY = oy * px; }
function noShadow(x: X) { x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetX = 0; x.shadowOffsetY = 0; }

// ---------- đường viền ----------
/** mép giấy xé: hình chữ nhật có mép răng cưa ngẫu nhiên (cùng seed → cùng hình) */
function tornPath(w: number, h: number, seed: number, amp = 0.7) {
  const r = rng(seed), p = new Path2D(), step = 1.1;
  const pts: [number, number][] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / step));
    let drift = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      drift = drift * 0.6 + (r() - 0.5) * amp;
      const j = drift + (r() - 0.5) * amp * 0.6;
      pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
    }
  };
  const a = -w / 2, b = -h / 2;
  edge(a, b, -a, b, 0, -1); edge(-a, b, -a, -b, 1, 0); edge(-a, -b, a, -b, 0, 1); edge(a, -b, a, b, -1, 0);
  pts.forEach(([X, Y], i) => (i ? p.lineTo(X, Y) : p.moveTo(X, Y)));
  p.closePath();
  return p;
}
function heartPath(w: number, h: number) {
  const p = new Path2D(), s = w / 2;
  p.moveTo(0, h * 0.42);
  p.bezierCurveTo(-s * 1.15, -h * 0.05, -s * 0.75, -h * 0.62, 0, -h * 0.25);
  p.bezierCurveTo(s * 0.75, -h * 0.62, s * 1.15, -h * 0.05, 0, h * 0.42);
  p.closePath();
  return p;
}
function shapePath(shape: string, w: number, h: number, seed: number) {
  const p = new Path2D();
  if (shape === "circle") p.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (shape === "heart") return heartPath(w, h);
  else if (shape === "torn") return tornPath(w, h, seed);
  else p.roundRect(-w / 2, -h / 2, w, h, 0.5);
  return p;
}

// ảnh phủ kín khung w×h (tâm 0,0) + chỉnh của khách (dịch mm, phóng to ≥ 1); kẹp để không bao giờ hở
function drawPhoto(x: X, img: PhotoSrc, w: number, h: number, adj?: Adjust, label?: string) {
  if (!img) {
    x.fillStyle = "#ececef"; x.fillRect(-w / 2, -h / 2, w, h);
    if (label) { x.fillStyle = "#a1a1aa"; x.font = `600 ${Math.min(w, h) * 0.28}px Inter, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(label, 0, 0); }
    return;
  }
  const z = Math.max(1, adj?.zoom ?? 1);
  const s = Math.max(w / img.width, h / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  const mx = (dw - w) / 2, my = (dh - h) / 2;
  const dx = Math.max(-mx, Math.min(mx, adj?.dx ?? 0)), dy = Math.max(-my, Math.min(my, adj?.dy ?? 0));
  x.drawImage(img, -dw / 2 + dx, -dh / 2 + dy, dw, dh);
}

// ---------- nền giấy ----------
let grain: HTMLCanvasElement | null = null;
function grainTile() {
  if (grain) return grain;
  grain = document.createElement("canvas"); grain.width = grain.height = 256;
  const g = grain.getContext("2d")!, d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + Math.random() * 145; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return grain;
}
function background(x: X, t: Template, assets: RenderOpts["assets"]) {
  x.fillStyle = t.bg.color; x.fillRect(0, 0, 120, 120);
  const tex = t.bg.asset ? assets?.[t.bg.asset] : undefined;
  if (tex) {
    const s = Math.max(120 / tex.img.width, 120 / tex.img.height);
    x.save(); x.globalAlpha = 0.55; x.globalCompositeOperation = "multiply";
    x.drawImage(tex.img, 60 - (tex.img.width * s) / 2, 60 - (tex.img.height * s) / 2, tex.img.width * s, tex.img.height * s);
    x.restore();
  }
  x.save(); x.strokeStyle = t.bg.ink; x.fillStyle = t.bg.ink; x.lineWidth = 0.25;
  if (t.bg.pattern === "dots") for (let i = 3; i < 120; i += 5) for (let j = 3; j < 120; j += 5) { x.beginPath(); x.arc(i, j, 0.35, 0, Math.PI * 2); x.fill(); }
  if (t.bg.pattern === "grid") for (let i = 0; i <= 120; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 120); x.moveTo(0, i); x.lineTo(120, i); x.stroke(); }
  if (t.bg.pattern === "lines") for (let i = 2; i <= 120; i += 6) { x.beginPath(); x.moveTo(0, i); x.lineTo(120, i); x.stroke(); }
  x.restore();
  // vân giấy: sợi mảnh ngẫu nhiên (cố định theo seed)
  const r = rng(t.seed + 99);
  x.save(); x.lineWidth = 0.12;
  for (let i = 0; i < 160; i++) {
    const X0 = r() * 120, Y0 = r() * 120, a = r() * Math.PI * 2, l = 1 + r() * 3;
    x.strokeStyle = r() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(120,100,70,0.1)";
    x.beginPath(); x.moveTo(X0, Y0); x.lineTo(X0 + Math.cos(a) * l, Y0 + Math.sin(a) * l); x.stroke();
  }
  x.restore();
}

// ---------- trang trí mặc định (vẽ bằng code khi chưa có chất liệu admin) ----------
function starPath(r: number, pts = 5, inner = 0.45) {
  const p = new Path2D();
  for (let i = 0; i < pts * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / pts, d = i % 2 ? r * inner : r; i ? p.lineTo(Math.cos(a) * d, Math.sin(a) * d) : p.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
  p.closePath(); return p;
}
function drawSticker(x: X, shape: string, s: number, color: string) {
  const fillDie = (p: Path2D) => { // viền trắng kiểu sticker cắt sẵn + bóng
    shadow(x, 1, 0.4, 0.22); x.lineJoin = "round"; x.lineWidth = 1.1; x.strokeStyle = "#ffffff"; x.stroke(p); x.fillStyle = "#ffffff"; x.fill(p);
    noShadow(x); x.fillStyle = color; x.fill(p);
  };
  if (shape === "star") fillDie(starPath(s / 2));
  else if (shape === "sparkle") fillDie(starPath(s / 2, 4, 0.28));
  else if (shape === "heart") { const p = heartPath(s, s); fillDie(p); }
  else if (shape === "flower") {
    const p = new Path2D();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; p.moveTo(Math.cos(a) * s * 0.28 + s * 0.2, Math.sin(a) * s * 0.28); p.arc(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, s * 0.2, 0, Math.PI * 2); }
    fillDie(p);
    x.fillStyle = "#ffe066"; x.beginPath(); x.arc(0, 0, s * 0.15, 0, Math.PI * 2); x.fill();
  } else if (shape === "bow") {
    const p = new Path2D();
    p.moveTo(0, 0); p.bezierCurveTo(-s * 0.55, -s * 0.45, -s * 0.6, s * 0.4, 0, 0);
    p.moveTo(0, 0); p.bezierCurveTo(s * 0.55, -s * 0.45, s * 0.6, s * 0.4, 0, 0);
    p.moveTo(-s * 0.06, 0); p.lineTo(-s * 0.22, s * 0.5); p.lineTo(-s * 0.08, s * 0.44); p.lineTo(0, 0.1);
    p.moveTo(s * 0.06, 0); p.lineTo(s * 0.22, s * 0.5); p.lineTo(s * 0.08, s * 0.44); p.lineTo(0, 0.1);
    fillDie(p);
    x.fillStyle = "rgba(0,0,0,0.15)"; x.beginPath(); x.arc(0, 0, s * 0.09, 0, Math.PI * 2); x.fill();
  }
}
function drawTape(x: X, l: Extract<Layer, { k: "tape" }>) {
  const r = rng(l.seed), w = l.w, h = l.h;
  const p = new Path2D(), zig = 6;
  p.moveTo(-w / 2, -h / 2); p.lineTo(w / 2, -h / 2);
  for (let i = 1; i <= zig; i++) p.lineTo(w / 2 + (i % 2 ? 0.6 : 0) * (0.5 + r()), -h / 2 + (h * i) / zig);
  p.lineTo(-w / 2, h / 2);
  for (let i = zig - 1; i >= 0; i--) p.lineTo(-w / 2 - (i % 2 ? 0.6 : 0) * (0.5 + r()), -h / 2 + (h * i) / zig);
  p.closePath();
  shadow(x, 0.8, 0.3, 0.14);
  x.globalAlpha = 0.82; x.fillStyle = l.color; x.fill(p);
  noShadow(x); x.save(); x.clip(p);
  x.globalAlpha = 0.35; x.strokeStyle = "#ffffff"; x.fillStyle = "#ffffff"; x.lineWidth = 0.9;
  if (l.pattern === "stripe") for (let i = -w; i < w; i += 2.4) { x.beginPath(); x.moveTo(i, -h); x.lineTo(i + h * 1.5, h); x.stroke(); }
  if (l.pattern === "dots") for (let i = -w / 2 + 1; i < w / 2; i += 2.2) for (let j = -h / 2 + 1; j < h / 2; j += 2) { x.beginPath(); x.arc(i, j, 0.35, 0, Math.PI * 2); x.fill(); }
  x.restore(); x.globalAlpha = 1;
}
function drawPaper(x: X, l: Extract<Layer, { k: "paper" }>, assets: RenderOpts["assets"]) {
  const p = l.torn ? tornPath(l.w, l.h, l.seed, 0.9) : (() => { const q = new Path2D(); q.rect(-l.w / 2, -l.h / 2, l.w, l.h); return q; })();
  const a = l.asset ? assets?.[l.asset] : undefined;
  shadow(x, 1.4, 0.6, 0.18);
  x.fillStyle = l.paper === "kraft" ? "#d9c3a0" : l.color; x.fill(p);
  noShadow(x);
  x.save(); x.clip(p);
  if (a) { const s = Math.max(l.w / a.img.width, l.h / a.img.height); x.drawImage(a.img, -(a.img.width * s) / 2, -(a.img.height * s) / 2, a.img.width * s, a.img.height * s); }
  else if (l.paper === "grid") { x.strokeStyle = "rgba(90,140,210,0.35)"; x.lineWidth = 0.18; for (let i = -l.w / 2; i < l.w / 2; i += 2.5) { x.beginPath(); x.moveTo(i, -l.h); x.lineTo(i, l.h); x.stroke(); } for (let j = -l.h / 2; j < l.h / 2; j += 2.5) { x.beginPath(); x.moveTo(-l.w, j); x.lineTo(l.w, j); x.stroke(); } }
  else if (l.paper === "note") { x.strokeStyle = "rgba(120,150,200,0.35)"; x.lineWidth = 0.18; for (let j = -l.h / 2 + 3; j < l.h / 2; j += 3) { x.beginPath(); x.moveTo(-l.w, j); x.lineTo(l.w, j); x.stroke(); } x.strokeStyle = "rgba(230,90,90,0.45)"; x.beginPath(); x.moveTo(-l.w / 2 + 4, -l.h); x.lineTo(-l.w / 2 + 4, l.h); x.stroke(); }
  else if (l.paper === "ticket") { x.fillStyle = "rgba(255,255,255,0.85)"; x.font = `600 ${l.h * 0.16}px Pangolin, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("ADMIT ONE", 0, 0); x.setLineDash([0.8, 0.8]); x.strokeStyle = "rgba(255,255,255,0.7)"; x.lineWidth = 0.25; x.strokeRect(-l.w / 2 + 1.5, -l.h / 2 + 1.5, l.w - 3, l.h - 3); x.setLineDash([]); }
  else { x.strokeStyle = "rgba(110,80,40,0.25)"; x.lineWidth = 0.15; const r = rng(l.seed); for (let i = 0; i < 40; i++) { const X0 = (r() - 0.5) * l.w, Y0 = (r() - 0.5) * l.h; x.beginPath(); x.moveTo(X0, Y0); x.lineTo(X0 + r() * 3, Y0 + (r() - 0.5)); x.stroke(); } }
  x.restore();
  if (l.paper === "ticket") { x.save(); x.globalCompositeOperation = "destination-out"; for (const s of [-1, 1]) { x.beginPath(); x.arc((s * l.w) / 2, 0, l.h * 0.14, 0, Math.PI * 2); x.fill(); } x.restore(); }
}
function drawDoodle(x: X, l: Extract<Layer, { k: "doodle" }>) {
  x.strokeStyle = l.color; x.lineWidth = 0.55; x.lineCap = "round"; x.lineJoin = "round";
  const s = l.s;
  if (l.shape === "arrow") {
    x.beginPath(); x.moveTo(-s / 2, s * 0.3); x.bezierCurveTo(-s * 0.1, -s * 0.5, s * 0.2, s * 0.4, s / 2, -s * 0.2); x.stroke();
    x.beginPath(); x.moveTo(s / 2 - s * 0.22, -s * 0.24); x.lineTo(s / 2, -s * 0.2); x.lineTo(s / 2 - s * 0.06, s * 0.02); x.stroke();
  } else if (l.shape === "swirl") {
    x.beginPath(); for (let t = 0; t < 14; t += 0.2) { const r = (t / 14) * s / 2; t ? x.lineTo(Math.cos(t) * r, Math.sin(t) * r) : x.moveTo(0, 0); } x.stroke();
  } else { x.setLineDash([1.2, 1]); x.beginPath(); x.ellipse(0, 0, s / 2, s / 3, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
}

// ---------- chữ ----------
function fontOf(l: Extract<Layer, { k: "text" }>, size: number) {
  if (l.family) return `${l.italic ? "italic " : ""}${l.bold ? "700" : "400"} ${size}px "${l.family}", "Be Vietnam Pro", sans-serif`;
  return `${l.font === "hand" ? "700 " : ""}${size}px ${FONTS[l.font]}`;
}
/** nội dung của lớp chữ: main / sub = "Chữ trên đĩa", custom = nội dung riêng */
export const textOf = (l: Extract<Layer, { k: "text" }>, t: DiscText) => (l.role === "main" ? t.main : l.role === "sub" ? t.sub : l.value ?? "");
function drawText(x: X, l: Extract<Layer, { k: "text" }>, value: string, idx: number, fonts?: RenderOpts["cutoutFonts"]): TextHit | null {
  const v = value.replace(/\s+$/, "");
  if (!v.trim()) return null;
  x.textAlign = "center"; x.textBaseline = "middle";
  // chữ cắt dán: mỗi ký tự 1 mảnh giấy (bóng đổ nhẹ), thẳng hàng hoặc cong theo cung
  if (l.cutout) {
    const lines = v.split("\n");
    const lh = l.size * 1.25;
    x.save(); x.translate(l.x, l.y); x.rotate(rad(l.rot));
    let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
    lines.forEach((ln, i) => {
      const { pieces, bounds } = layoutCutout(ln, fonts?.[l.cutout!.font] ?? null, { size: l.size, curve: l.cutout!.curve, chaos: l.cutout!.chaos, spacing: l.cutout!.spacing, seed: l.cutout!.seed + i * 7919 });
      const oy = (i - (lines.length - 1) / 2) * lh;
      x.save(); x.translate(0, oy); drawCutout(x, pieces, px); x.restore();
      X0 = Math.min(X0, bounds.x0); X1 = Math.max(X1, bounds.x1); Y0 = Math.min(Y0, bounds.y0 + oy); Y1 = Math.max(Y1, bounds.y1 + oy);
    });
    x.restore();
    return { role: l.role, layer: idx, x: l.x + ((X0 + X1) / 2) * Math.cos(rad(l.rot)) - ((Y0 + Y1) / 2) * Math.sin(rad(l.rot)), y: l.y + ((X0 + X1) / 2) * Math.sin(rad(l.rot)) + ((Y0 + Y1) / 2) * Math.cos(rad(l.rot)), w: X1 - X0, h: Y1 - Y0, rot: l.rot };
  }
  if (l.arc) {
    // chạy cong theo vòng tròn: phía trên đọc trái → phải theo chiều kim đồng hồ, phía dưới ngược lại (chữ luôn đứng)
    let size = l.size;
    const one = v.replace(/\n/g, " ");
    x.font = fontOf(l, size);
    const maxArc = Math.PI * l.arc.r * 0.62;
    if (x.measureText(one).width > maxArc) { size *= maxArc / x.measureText(one).width; x.font = fontOf(l, size); }
    const top = l.arc.mid > 180, total = x.measureText(one).width, R0 = top ? l.arc.r : l.arc.r + size * 0.35;
    let a = rad(l.arc.mid) + ((top ? -1 : 1) * total) / (2 * R0);
    x.fillStyle = l.color;
    for (const ch of one) {
      const cw = x.measureText(ch).width, half = cw / (2 * R0);
      a += top ? half : -half;
      x.save(); x.translate(C + Math.cos(a) * R0, C + Math.sin(a) * R0); x.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2));
      if (l.stroke) { x.lineWidth = size * 0.22; x.strokeStyle = "#ffffff"; x.lineJoin = "round"; x.strokeText(ch, 0, 0); }
      x.fillText(ch, 0, 0); x.restore();
      a += top ? half : -half;
    }
    const mx = C + Math.cos(rad(l.arc.mid)) * l.arc.r, my = C + Math.sin(rad(l.arc.mid)) * l.arc.r;
    return { role: l.role, layer: idx, x: mx, y: my, w: Math.min(total, 90), h: size * 1.6, rot: 0 };
  }
  // chữ thường (nhiều dòng): tự co cho vừa bề ngang khung
  const lines = v.split("\n");
  let size = l.size;
  x.font = fontOf(l, size);
  const widest = Math.max(...lines.map((ln) => x.measureText(ln).width));
  if (l.w > 0 && widest > l.w) { size *= l.w / widest; x.font = fontOf(l, size); }
  const w = Math.max(...lines.map((ln) => x.measureText(ln).width)), lh = size * 1.25;
  x.save(); x.translate(l.x, l.y); x.rotate(rad(l.rot));
  if (l.font === "label" && !l.family) {
    // nhãn dán: nền trắng bo tròn, viền màu
    const pw = w + size * 1.1, ph = size * 1.5 + lh * (lines.length - 1);
    shadow(x, 0.9, 0.35, 0.2);
    x.beginPath(); x.roundRect(-pw / 2, -ph / 2, pw, ph, Math.min(ph / 2, size)); x.fillStyle = "#ffffff"; x.fill();
    noShadow(x); x.lineWidth = 0.5; x.strokeStyle = l.color; x.stroke();
  }
  x.fillStyle = l.color;
  lines.forEach((ln, i) => {
    const y = (i - (lines.length - 1) / 2) * lh + (l.font === "label" && !l.family ? size * 0.04 : 0);
    if (l.stroke) { x.lineWidth = size * 0.22; x.strokeStyle = "#ffffff"; x.lineJoin = "round"; x.strokeText(ln, 0, y); }
    x.fillText(ln, 0, y);
  });
  x.restore();
  return { role: l.role, layer: idx, x: l.x, y: l.y, w: w + size, h: size * 1.6 + lh * (lines.length - 1), rot: l.rot };
}

/** Vẽ mặt đĩa. Trả về canvas + vị trí các ô ảnh / chữ (mm) để bấm chọn trên trang. */
export function renderDisc(o: RenderOpts) {
  const N = Math.round(o.size), k = N / 120;
  px = k;
  const c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.scale(k, k);
  x.save();
  x.beginPath(); x.arc(C, C, R_OUT, 0, Math.PI * 2); x.clip(); // trang trí được tràn ra mép, cắt theo hình tròn
  background(x, o.template, o.assets);
  const hits: Hit[] = [], texts: TextHit[] = [];

  for (const [li, l] of o.template.layers.entries()) {
    x.save();
    if (l.k === "text") { const h = drawText(x, l, textOf(l, o.text), li, o.cutoutFonts); if (h) texts.push(h); x.restore(); continue; }
    x.translate(l.x, l.y); x.rotate(rad(l.rot));
    if (l.k === "photo") {
      const img = o.photos[l.slot] ?? null, adj = o.adjust?.[l.slot];
      const fa = l.asset ? o.assets?.[l.asset] : undefined;
      const label = o.mode === "print" ? undefined : String(l.slot + 1);
      if (l.shape === "frame" && fa?.asset.region) {
        // khung ảnh của admin: ảnh vào vùng đặt ảnh, khung vẽ đè lên
        const g = fa.asset.region, fw = l.w / (g.x1 - g.x0), fh = fw * (fa.img.height / fa.img.width);
        const ix = -fw / 2 + g.x0 * fw, iy = -fh / 2 + g.y0 * fh, iw = (g.x1 - g.x0) * fw, ih = (g.y1 - g.y0) * fh;
        x.save(); x.beginPath(); x.rect(ix, iy, iw, ih); x.clip(); x.translate(ix + iw / 2, iy + ih / 2); drawPhoto(x, img, iw, ih, adj, label); x.restore();
        shadow(x, 1.3, 0.6, 0.22); x.drawImage(fa.img, -fw / 2, -fh / 2, fw, fh); noShadow(x);
      } else if (l.shape === "polaroid" || l.shape === "frame") {
        const b = Math.max(1.4, l.w * 0.06), bb = l.w * 0.26;
        shadow(x, 1.6, 0.7, 0.22);
        x.fillStyle = "#fffdf8"; x.fillRect(-l.w / 2 - b, -l.h / 2 - b, l.w + b * 2, l.h + b + bb);
        noShadow(x);
        x.save(); x.beginPath(); x.rect(-l.w / 2, -l.h / 2, l.w, l.h); x.clip(); drawPhoto(x, img, l.w, l.h, adj, label); x.restore();
      } else if (l.shape === "torn") {
        // viền xơ giấy trắng ngà mảnh bên dưới, ảnh cắt mép xé bên trên
        shadow(x, 1.5, 0.7, 0.22);
        x.fillStyle = "#fbf6ea"; x.fill(tornPath(l.w + 1.6, l.h + 1.6, l.seed + 1, 0.9));
        noShadow(x);
        x.save(); x.clip(tornPath(l.w, l.h, l.seed, 0.7)); drawPhoto(x, img, l.w, l.h, adj, label); x.restore();
      } else {
        const inner = shapePath(l.shape, l.w, l.h, l.seed);
        shadow(x, 1.5, 0.7, 0.22);
        if (l.border) { x.fillStyle = l.border; x.fill(shapePath(l.shape, l.w + 2.2, l.h + 2.2, l.seed)); } else { x.fillStyle = "#fff"; x.fill(inner); }
        noShadow(x);
        x.save(); x.clip(inner); drawPhoto(x, img, l.w, l.h, adj, label); x.restore();
      }
      if (o.editSlot === l.slot || o.hoverSlot === l.slot) {
        x.save(); x.setLineDash([1.2, 0.9]); x.lineWidth = 0.6; x.strokeStyle = "#ff5fa2"; x.stroke(shapePath(l.shape === "heart" || l.shape === "circle" ? l.shape : "rect", l.w + 1, l.h + 1, l.seed)); x.restore();
      }
      hits.push({ slot: l.slot, x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot, shape: l.shape });
    } else if (l.k === "tape") {
      const a = l.asset ? o.assets?.[l.asset] : undefined;
      if (a) { const h = l.w * (a.img.height / a.img.width); shadow(x, 0.8, 0.3, 0.14); x.globalAlpha = 0.92; x.drawImage(a.img, -l.w / 2, -h / 2, l.w, h); }
      else drawTape(x, l);
    } else if (l.k === "sticker") {
      const a = l.asset ? o.assets?.[l.asset] : undefined;
      if (a) { const s = l.s / Math.max(a.img.width, a.img.height); shadow(x, 1, 0.4, 0.22); x.drawImage(a.img, (-a.img.width * s) / 2, (-a.img.height * s) / 2, a.img.width * s, a.img.height * s); }
      else drawSticker(x, l.shape, l.s, l.color);
    } else if (l.k === "doodle") {
      const a = l.asset ? o.assets?.[l.asset] : undefined;
      if (a) { const s = l.s / Math.max(a.img.width, a.img.height); x.drawImage(a.img, (-a.img.width * s) / 2, (-a.img.height * s) / 2, a.img.width * s, a.img.height * s); }
      else drawDoodle(x, l);
    } else if (l.k === "paper") drawPaper(x, l, o.assets);
    x.restore();
  }

  // grain toàn mặt đĩa
  x.save(); x.globalAlpha = 0.05; x.globalCompositeOperation = "overlay";
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = x.createPattern(grainTile(), "repeat")!; x.fillRect(0, 0, N, N);
  x.restore();
  x.restore();

  // lỗ giữa + vùng nhựa trong quanh lỗ
  x.save(); x.globalCompositeOperation = "destination-out";
  x.beginPath(); x.arc(C, C, o.mode === "print" ? R_PRINT_HOLE : R_HOLE, 0, Math.PI * 2); x.fill();
  if (o.mode !== "print") { x.globalAlpha = 0.55; x.beginPath(); x.arc(C, C, R_PRINT_HOLE, 0, Math.PI * 2); x.arc(C, C, R_HOLE, 0, Math.PI * 2, true); x.fill("evenodd"); }
  x.restore();
  if (o.mode !== "print") {
    x.save(); x.lineWidth = 0.35; x.strokeStyle = "rgba(255,255,255,0.8)";
    x.beginPath(); x.arc(C, C, R_PRINT_HOLE, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = "rgba(0,0,0,0.18)"; x.beginPath(); x.arc(C, C, R_HOLE, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  // guideline: đường cắt (hồng), vùng an toàn + vùng hub (xám) — chỉ ở bản xem trước
  if (o.mode !== "print" && o.guides) {
    x.save(); x.lineWidth = 0.3; x.setLineDash([1.4, 1.2]);
    x.strokeStyle = "rgba(255,95,162,0.75)"; x.beginPath(); x.arc(C, C, R_OUT - 0.2, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = "rgba(60,60,70,0.45)"; x.beginPath(); x.arc(C, C, R_SAFE, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(C, C, R_HUB, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  return { canvas: c, hits, texts };
}

/** Điểm (mm) có nằm trong ô (hình chữ nhật xoay) không */
export function inBox(px0: number, py0: number, b: { x: number; y: number; w: number; h: number; rot: number }) {
  const a = -rad(b.rot), dx = px0 - b.x, dy = py0 - b.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
}
