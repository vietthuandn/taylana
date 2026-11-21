"use client";

/* Scrapbook — vẽ 1 bề mặt (danh sách lớp, đơn vị mm): đĩa tròn 120 mm · trang 120 × 120 mm · cặp trang 240 × 120 mm.
   Hiệu ứng tạo bằng code: mép giấy xé (răng cưa ngẫu nhiên + viền xơ giấy trắng ngà), bóng đổ mềm cho mọi lớp dán,
   nền giấy có vân + grain. Ảnh khách phủ kín khung (cover), có thể dịch / phóng to theo chỉnh ô của khách.
   Ô ảnh có thể gắn khung PNG (ảnh nằm dưới khung, cắt theo vùng ảnh / mặt nạ). Khung lời chúc: chữ tự xuống dòng + tự co.
   Sticker khách thêm luôn vẽ trên cùng.
   mode "print": nền ngoài đĩa + lỗ giữa (Ø 23 mm) trong suốt, không guideline. */
import { rng } from "./generate";
import { drawCutout, layoutCutout, type LoadedFont } from "./cutout";
import { surfaceOf } from "./surface";
import { C, R_HOLE, R_HUB, R_OUT, R_PRINT_HOLE, R_SAFE, type Adjust, type DiscText, type Frame, type Layer, type ScrapAsset, type Template } from "./types";

type Img = CanvasImageSource & { width: number; height: number };
export type PhotoSrc = Img | null;
export type Hit = { slot: number; layer: number; x: number; y: number; w: number; h: number; rot: number; shape: string };
/** khung ảnh đã tải: ảnh khung + mặt nạ vùng ảnh (canvas alpha) nếu có */
export type LoadedFrame = { img: Img; mask: Img | null; frame: Frame };
export type TextHit = { role: "main" | "sub" | "custom"; layer: number; x: number; y: number; w: number; h: number; rot: number; size?: number; lh?: number };
export type RenderOpts = {
  template: Template; photos?: PhotoSrc[]; adjust?: Record<number, Adjust | undefined>; text: DiscText;
  photoMap?: Record<string, PhotoSrc | undefined>; adjustMap?: Record<string, Adjust | undefined>; // ảnh khách theo id (lớp ảnh có trường photo)
  frames?: Record<string, LoadedFrame | undefined>;
  editLayer?: number | null; // ô ảnh đang chỉnh (chỉ số lớp)
  hideLayer?: number | null; // lớp chữ đang sửa trực tiếp (ô nhập đè lên) — tạm ẩn khi vẽ
  bgImages?: Record<string, Img | undefined>; // ảnh nền theo khoá bg.image (link ảnh admin / "u:<id>" ảnh khách)
  assets?: Record<string, { img: Img; asset: ScrapAsset } | undefined>;
  size: number; mode?: "preview" | "print"; fullDisc?: boolean; // fullDisc: file in mặt đĩa phủ kín hình tròn 12 cm (không khoét lỗ / hub)
  guides?: boolean; editSlot?: number | null; hoverSlot?: number | null;
  cutoutFonts?: Record<string, LoadedFont | undefined>; // font cut-out đã tải ảnh
};

export const FONTS: Record<"hand" | "marker" | "label", string> = { hand: '"Dancing Script", cursive', marker: '"Patrick Hand", "Itim", cursive', label: '"Pangolin", "Itim", sans-serif' } as const;
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
function background(x: X, t: Template, o: RenderOpts, W: number, H: number) {
  // cặp trang có nền riêng trang phải → vẽ 2 nửa
  if (t.bg2 && W > 200) {
    x.save(); x.beginPath(); x.rect(0, 0, W / 2, H); x.clip(); paintBg(x, t.bg, t.seed, o, W / 2, H, 0); x.restore();
    x.save(); x.beginPath(); x.rect(W / 2, 0, W / 2, H); x.clip(); x.translate(W / 2, 0); paintBg(x, t.bg2, t.seed + 7, o, W / 2, H, 0); x.restore();
    return;
  }
  paintBg(x, t.bg, t.seed, o, W, H, 0);
}
function paintBg(x: X, bg: Template["bg"], seed: number, o: RenderOpts, W: number, H: number, _o: number) {
  void _o;
  const assets = o.assets;
  x.fillStyle = bg.color; x.fillRect(0, 0, W, H);
  const tex = bg.asset ? assets?.[bg.asset] : undefined;
  if (tex) {
    const s = Math.max(W / tex.img.width, H / tex.img.height);
    x.save(); x.globalAlpha = 0.55; x.globalCompositeOperation = "multiply";
    x.drawImage(tex.img, W / 2 - (tex.img.width * s) / 2, H / 2 - (tex.img.height * s) / 2, tex.img.width * s, tex.img.height * s);
    x.restore();
  }
  // ảnh nền (khách / admin tải lên): phủ kín bề mặt, có độ mờ (đĩa: tự cắt theo hình tròn)
  const img = bg.image ? o.bgImages?.[bg.image] : undefined;
  if (img) {
    const s = Math.max(W / img.width, H / img.height);
    x.save(); x.globalAlpha = bg.imageOpacity ?? 1;
    x.drawImage(img, W / 2 - (img.width * s) / 2, H / 2 - (img.height * s) / 2, img.width * s, img.height * s);
    x.restore();
  }
  x.save(); x.strokeStyle = bg.ink; x.fillStyle = bg.ink; x.lineWidth = 0.25;
  if (bg.pattern === "dots") for (let i = 3; i < W; i += 5) for (let j = 3; j < H; j += 5) { x.beginPath(); x.arc(i, j, 0.35, 0, Math.PI * 2); x.fill(); }
  if (bg.pattern === "grid") { for (let i = 0; i <= W; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let i = 0; i <= H; i += 5) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); } }
  if (bg.pattern === "lines") for (let i = 2; i <= H; i += 6) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
  x.restore();
  // vân giấy: sợi mảnh ngẫu nhiên (cố định theo seed)
  const r = rng(seed + 99);
  x.save(); x.lineWidth = 0.12;
  for (let i = 0; i < Math.round((160 * W * H) / 14400); i++) {
    const X0 = r() * W, Y0 = r() * H, a = r() * Math.PI * 2, l = 1 + r() * 3;
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
  const a = l.asset ? assets?.[l.asset] : undefined;
  // mảnh giấy từ thư viện (PNG trong suốt): vẽ y như sticker — giữ alpha, bóng đổ nhẹ theo hình dạng thật (canvas tự đổ bóng theo alpha),
  // KHÔNG tô nền / khung chữ nhật bên dưới, không cắt ảnh. (Lỗi cũ: tô màu giấy l.color cả khung + cắt ảnh kiểu "cover" → nền trắng đặc.)
  if (a) {
    const s = Math.min(l.w / a.img.width, l.h / a.img.height), w = a.img.width * s, h = a.img.height * s;
    shadow(x, 1.2, 0.5, 0.2); x.drawImage(a.img, -w / 2, -h / 2, w, h); noShadow(x);
    return;
  }
  const p = l.torn ? tornPath(l.w, l.h, l.seed, 0.9) : (() => { const q = new Path2D(); q.rect(-l.w / 2, -l.h / 2, l.w, l.h); return q; })();
  shadow(x, 1.4, 0.6, 0.18);
  x.fillStyle = l.paper === "kraft" ? "#d9c3a0" : l.color; x.fill(p);
  noShadow(x);
  x.save(); x.clip(p);
  if (l.paper === "grid") { x.strokeStyle = "rgba(90,140,210,0.35)"; x.lineWidth = 0.18; for (let i = -l.w / 2; i < l.w / 2; i += 2.5) { x.beginPath(); x.moveTo(i, -l.h); x.lineTo(i, l.h); x.stroke(); } for (let j = -l.h / 2; j < l.h / 2; j += 2.5) { x.beginPath(); x.moveTo(-l.w, j); x.lineTo(l.w, j); x.stroke(); } }
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
  const align = l.align ?? "center", lhK = l.lh ?? 1.25;
  // chữ cắt dán: mỗi ký tự 1 mảnh giấy (bóng đổ nhẹ); xuống dòng theo độ rộng khung, mỗi dòng thẳng hoặc cong theo cung
  if (l.cutout && !l.arc) {
    const f = fonts?.[l.cutout.font] ?? null, cu = l.cutout;
    // đếm lần xuất hiện dùng chung → mảnh của từng ký tự không đổi khi đổi chỗ xuống dòng
    const lay = (t: string, occ?: Map<string, number>) => layoutCutout(t, f, { size: l.size, curve: cu.curve, chaos: cu.chaos, spacing: cu.spacing, seed: cu.seed, occ });
    const wrapped: string[] = [];
    for (const para of v.split("\n")) {
      let line = "";
      for (const wd of para.split(/\s+/).filter(Boolean)) {
        const t = line ? `${line} ${wd}` : wd, b = lay(t).bounds;
        if (!l.w || b.x1 - b.x0 <= l.w || !line) line = t; else { wrapped.push(line); line = wd; }
      }
      wrapped.push(line);
    }
    const occ = new Map<string, number>(), lh = l.size * lhK * (1 + Math.abs(cu.curve) * 0.5);
    const laid = wrapped.map((t) => lay(t, occ));
    const H = (laid.length - 1) * lh + l.size * 1.3;
    const W = l.w || Math.max(...laid.map((L) => L.bounds.x1 - L.bounds.x0));
    x.save(); x.translate(l.x, l.y); x.rotate(rad(l.rot));
    laid.forEach((L, i) => {
      const dx = align === "left" ? -W / 2 - L.bounds.x0 : align === "right" ? W / 2 - L.bounds.x1 : 0;
      x.save(); x.translate(dx, (i - (laid.length - 1) / 2) * lh); drawCutout(x, L.pieces, px); x.restore();
    });
    x.restore();
    return { role: l.role, layer: idx, x: l.x, y: l.y, w: W, h: H, rot: l.rot, size: l.size, lh: lhK };
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
  // chữ thường: tự xuống dòng theo từ trong độ rộng khung (cỡ chữ không đổi), khoảng cách dòng / chữ, căn lề
  const size = l.size;
  x.font = fontOf(l, size);
  const ls = l.ls ?? 0;
  const ctxLS = x as X & { letterSpacing?: string };
  if ("letterSpacing" in x) ctxLS.letterSpacing = `${ls}px`;
  const lines = l.w > 0 ? wrapWords(x, v, l.w) : v.split("\n");
  const widest = Math.max(...lines.map((ln) => x.measureText(ln).width)), lh = size * lhK;
  const W = l.w > 0 ? l.w : widest, H = size * 1.3 + lh * (lines.length - 1);
  x.save(); x.translate(l.x, l.y); x.rotate(rad(l.rot));
  if (l.font === "label" && !l.family) {
    // nhãn dán: nền trắng bo tròn, viền màu
    const pw = widest + size * 1.1, ph = size * 1.5 + lh * (lines.length - 1);
    shadow(x, 0.9, 0.35, 0.2);
    x.beginPath(); x.roundRect(-pw / 2, -ph / 2, pw, ph, Math.min(ph / 2, size)); x.fillStyle = "#ffffff"; x.fill();
    noShadow(x); x.lineWidth = 0.5; x.strokeStyle = l.color; x.stroke();
  }
  x.fillStyle = l.color; x.textAlign = align;
  const ax = align === "left" ? -W / 2 : align === "right" ? W / 2 : 0;
  lines.forEach((ln, i) => {
    const y = (i - (lines.length - 1) / 2) * lh + (l.font === "label" && !l.family ? size * 0.04 : 0);
    if (l.stroke) { x.lineWidth = size * 0.22; x.strokeStyle = "#ffffff"; x.lineJoin = "round"; x.strokeText(ln, ax, y); }
    x.fillText(ln, ax, y);
  });
  x.restore();
  if ("letterSpacing" in x) ctxLS.letterSpacing = "0px";
  return { role: l.role, layer: idx, x: l.x, y: l.y, w: W, h: H, rot: l.rot, size, lh: lhK };
}

// ---------- khung lời chúc ----------
function wrapWords(x: X, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (x.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
function cardPath(l: Extract<Layer, { k: "wish" }>) {
  const p = new Path2D(), w = l.w, h = l.h;
  if (l.card === "label") p.roundRect(-w / 2, -h / 2, w, h, Math.min(h / 2, 4));
  else if (l.card === "lined") return tornPath(w, h, l.seed, 0.45);
  else p.roundRect(-w / 2, -h / 2, w, h, l.card === "card" ? 1.2 : 0.3);
  return p;
}
export const WISH_FONT = "Patrick Hand";
function drawWish(x: X, l: Extract<Layer, { k: "wish" }>, fonts?: RenderOpts["cutoutFonts"]) {
  const w = l.w, h = l.h, p = cardPath(l);
  shadow(x, 1.4, 0.6, 0.2); x.fillStyle = l.color; x.fill(p); noShadow(x);
  x.save(); x.clip(p);
  if (l.card === "lined") {
    x.strokeStyle = "rgba(90,130,200,0.35)"; x.lineWidth = 0.2;
    for (let j = -h / 2 + 5; j < h / 2; j += 4) { x.beginPath(); x.moveTo(-w / 2, j); x.lineTo(w / 2, j); x.stroke(); }
    x.strokeStyle = "rgba(230,90,90,0.5)"; x.beginPath(); x.moveTo(-w / 2 + 5, -h / 2); x.lineTo(-w / 2 + 5, h / 2); x.stroke();
  } else if (l.card === "card") {
    x.setLineDash([0.9, 0.7]); x.strokeStyle = l.ink; x.globalAlpha = 0.45; x.lineWidth = 0.25; x.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4); x.setLineDash([]); x.globalAlpha = 1;
  } else if (l.card === "note") {
    const g = x.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, "rgba(255,255,255,0.18)"); g.addColorStop(1, "rgba(0,0,0,0.05)"); x.fillStyle = g; x.fillRect(-w / 2, -h / 2, w, h);
  }
  x.restore();
  if (l.card === "label") { x.lineWidth = 0.45; x.strokeStyle = l.ink; x.stroke(p); }
  if (l.card === "note") { x.save(); x.globalAlpha = 0.7; x.fillStyle = "#f5e6b8"; x.translate(0, -h / 2); x.rotate(rad(-3)); x.fillRect(-Math.min(14, w * 0.3) / 2, -2, Math.min(14, w * 0.3), 4); x.restore(); }
  // chữ: tự xuống dòng + tự co cho vừa khung (chừa lề)
  const v = l.value.trim();
  if (!v) return;
  const pad = Math.max(2.2, Math.min(w, h) * 0.1), aw = w - pad * 2 - (l.card === "lined" ? 4 : 0), ah = h - pad * 2, ox = l.card === "lined" ? 2 : 0;
  if (l.cutout) {
    const f = fonts?.[l.cutout.font] ?? null, cu = l.cutout;
    for (let size = Math.min(9, ah); size >= 1.6; size -= 0.4) {
      const lh = size * 1.3, lines: { pieces: ReturnType<typeof layoutCutout>["pieces"]; bounds: ReturnType<typeof layoutCutout>["bounds"] }[] = [];
      const lay = (t: string, i: number) => layoutCutout(t, f, { size, curve: 0, chaos: cu.chaos, spacing: cu.spacing, seed: cu.seed + i * 7919 });
      let ok = true;
      for (const para of v.split("\n")) {
        let line = "";
        for (const wd of para.split(/\s+/).filter(Boolean)) {
          const t = line ? `${line} ${wd}` : wd, b = lay(t, lines.length).bounds;
          if (b.x1 - b.x0 <= aw || !line) line = t; else { lines.push(lay(line, lines.length)); line = wd; }
        }
        lines.push(lay(line, lines.length));
      }
      if (lines.some((L) => L.bounds.x1 - L.bounds.x0 > aw)) ok = false;
      if ((ok && lines.length * lh <= ah) || size <= 1.7) {
        lines.forEach((L, i) => { x.save(); x.translate(ox, (i - (lines.length - 1) / 2) * lh); drawCutout(x, L.pieces, px); x.restore(); });
        return;
      }
    }
    return;
  }
  const fam = l.family ?? WISH_FONT;
  x.fillStyle = l.ink; x.textAlign = "center"; x.textBaseline = "middle";
  for (let size = Math.min(8, ah); size >= 1.4; size -= 0.2) {
    x.font = `400 ${size}px "${fam}", "Itim", sans-serif`;
    const lines = wrapWords(x, v, aw), lh = size * 1.3;
    if ((lines.length * lh <= ah && lines.every((t) => x.measureText(t).width <= aw)) || size <= 1.5) {
      lines.forEach((t, i) => x.fillText(t, ox, (i - (lines.length - 1) / 2) * lh));
      return;
    }
  }
}
// ảnh trong khung PNG: ảnh vào vùng ảnh (hình chữ nhật hoặc mặt nạ), khung vẽ đè lên
function drawFramed(x: X, l: Extract<Layer, { k: "photo" }>, fr: LoadedFrame, img: PhotoSrc, adj: Adjust | undefined, label: string | undefined) {
  const w = l.w, h = l.h, g = fr.frame.region ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  const ix = -w / 2 + g.x0 * w, iy = -h / 2 + g.y0 * h, iw = (g.x1 - g.x0) * w, ih = (g.y1 - g.y0) * h;
  if (fr.mask) {
    // mặt nạ: dựng riêng ảnh ở độ phân giải hiện tại rồi giữ phần nằm trong mặt nạ
    const W = Math.max(1, Math.round(w * px)), H = Math.max(1, Math.round(h * px));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const y = c.getContext("2d")!; y.scale(W / w, H / h); y.translate(ix + iw / 2 + w / 2, iy + ih / 2 + h / 2);
    drawPhoto(y, img, iw, ih, adj, label);
    y.setTransform(1, 0, 0, 1, 0, 0); y.globalCompositeOperation = "destination-in"; y.drawImage(fr.mask, 0, 0, W, H);
    x.drawImage(c, -w / 2, -h / 2, w, h);
  } else { x.save(); x.beginPath(); x.rect(ix, iy, iw, ih); x.clip(); x.translate(ix + iw / 2, iy + ih / 2); drawPhoto(x, img, iw, ih, adj, label); x.restore(); }
  shadow(x, 1.3, 0.6, 0.22); x.drawImage(fr.img, -w / 2, -h / 2, w, h); noShadow(x);
}

/** Vẽ 1 bề mặt (đĩa / trang / cặp trang). size = px bề ngang. Trả về canvas + vị trí các ô ảnh / chữ (mm) để bấm chọn. */
export function renderSurface(o: RenderOpts) {
  const S = surfaceOf(o.template);
  const N = Math.round(o.size), k = N / S.w, NH = Math.round(S.h * k);
  px = k;
  const c = document.createElement("canvas"); c.width = N; c.height = NH;
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.scale(k, k);
  x.save();
  x.beginPath(); if (S.round) x.arc(C, C, R_OUT, 0, Math.PI * 2); else x.rect(0, 0, S.w, S.h); x.clip(); // trang trí được tràn ra mép, cắt theo bề mặt
  background(x, o.template, o, S.w, S.h);
  const hits: Hit[] = [], texts: TextHit[] = [];
  // sticker khách thêm luôn nằm trên cùng
  const order = o.template.layers.map((l, i) => i);
  order.sort((a, b) => Number(isTopSticker(o.template.layers[a])) - Number(isTopSticker(o.template.layers[b])) || a - b);

  for (const li of order) {
    const l = o.template.layers[li];
    if (l.hidden) continue;
    x.save();
    if (o.hideLayer === li) x.globalAlpha = 0;
    if (l.k === "text") { const h = drawText(x, l, textOf(l, o.text), li, o.cutoutFonts); if (h) texts.push(h); x.restore(); continue; }
    x.translate(l.x, l.y); x.rotate(rad(l.rot));
    if (l.k === "wish") drawWish(x, l, o.cutoutFonts);
    else if (l.k === "photo") {
      const byId = l.photo !== undefined;
      const img = byId ? (l.photo ? o.photoMap?.[l.photo] ?? null : null) : o.photos?.[l.slot] ?? null;
      const adj = byId ? (l.photo ? o.adjustMap?.[l.photo] : undefined) : o.adjust?.[l.slot];
      const fa = l.asset ? o.assets?.[l.asset] : undefined;
      const label = o.mode === "print" ? undefined : byId ? "+" : String(l.slot + 1);
      const fr = l.frame ? o.frames?.[l.frame] : undefined;
      if (fr) drawFramed(x, l, fr, img, adj, label);
      else if (l.shape === "frame" && fa?.asset.region) {
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
      if (o.editLayer === li || (!byId && (o.editSlot === l.slot || o.hoverSlot === l.slot))) {
        x.save(); x.setLineDash([1.2, 0.9]); x.lineWidth = 0.6; x.strokeStyle = "#ff5fa2"; x.stroke(shapePath(l.shape === "heart" || l.shape === "circle" ? l.shape : "rect", l.w + 1, l.h + 1, l.seed)); x.restore();
      }
      hits.push({ slot: l.slot, layer: li, x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot, shape: l.shape });
    } else if (l.k === "tape") {
      const a = l.asset ? o.assets?.[l.asset] : undefined;
      if (a) { const h = l.w * (a.img.height / a.img.width); shadow(x, 0.8, 0.3, 0.14); x.globalAlpha = 0.92; x.drawImage(a.img, -l.w / 2, -h / 2, l.w, h); }
      else drawTape(x, l);
    } else if (l.k === "sticker") {
      const a = l.asset ? o.assets?.[l.asset] : undefined;
      if (a) {
        const s = fitS(l, a.img) / Math.max(a.img.width, a.img.height), w = a.img.width * s, h = a.img.height * s;
        if (l.ol && l.ol.w > 0) {
          // viền: nở kênh alpha theo độ dày (px ở 300 DPI → mm), tô màu, đặt dưới ảnh — vẽ theo đúng độ phân giải đang dựng
          const t = x.getTransform(), ppm = Math.hypot(t.a, t.b), rMM = (l.ol.w * 25.4) / 300;
          const oc = outlined(a.img, Math.max(1, Math.round(w * ppm)), Math.max(1, Math.round(h * ppm)), Math.max(1, Math.round(rMM * ppm)), l.ol.c);
          x.save(); if (l.ol.sh) shadow(x, 1, 0.4, 0.22); x.drawImage(oc, -w / 2 - rMM, -h / 2 - rMM, w + rMM * 2, h + rMM * 2); x.restore();
          x.drawImage(a.img, -w / 2, -h / 2, w, h);
        } else { shadow(x, 1, 0.4, 0.22); x.drawImage(a.img, -w / 2, -h / 2, w, h); }
      }
      else drawSticker(x, l.shape, l.s, l.color);
    } else if (l.k === "doodle") {
      const a = l.asset ? o.assets?.[l.asset] : undefined;
      if (a) { const s = fitS(l, a.img) / Math.max(a.img.width, a.img.height); x.drawImage(a.img, (-a.img.width * s) / 2, (-a.img.height * s) / 2, a.img.width * s, a.img.height * s); }
      else drawDoodle(x, l);
    } else if (l.k === "paper") drawPaper(x, l, o.assets);
    x.restore();
  }

  // grain toàn bề mặt
  x.save(); x.globalAlpha = 0.05; x.globalCompositeOperation = "overlay";
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = x.createPattern(grainTile(), "repeat")!; x.fillRect(0, 0, N, NH);
  x.restore();
  x.restore();
  if (!S.round) {
    if (o.mode !== "print" && o.guides) {
      x.save(); x.lineWidth = 0.3; x.setLineDash([1.4, 1.2]); x.strokeStyle = "rgba(60,60,70,0.45)";
      if (S.kind === "spread") { x.strokeRect(5, 5, 110 - 2, 110); x.strokeRect(127, 5, 108, 110); }
      else x.strokeRect(S.safe.x0, S.safe.y0, S.safe.x1 - S.safe.x0, S.safe.y1 - S.safe.y0);
      if (S.gutter !== null) { x.setLineDash([]); x.strokeStyle = "rgba(255,95,162,0.7)"; x.beginPath(); x.moveTo(S.gutter, 0); x.lineTo(S.gutter, S.h); x.stroke(); }
      for (const f of S.folds ?? []) { x.setLineDash([]); x.strokeStyle = "rgba(255,95,162,0.7)"; x.beginPath(); x.moveTo(f, 0); x.lineTo(f, S.h); x.stroke(); }
      x.restore();
    }
    return { canvas: c, hits, texts };
  }

  // lỗ giữa + vùng nhựa trong quanh lỗ (file in đầy đủ — fullDisc: bỏ qua, chỉ phần ngoài hình tròn trong suốt)
  if (o.fullDisc) return { canvas: c, hits, texts };
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

/** (tên cũ) vẽ mặt đĩa */
export const renderDisc = renderSurface;
/** sticker tự rải: không phóng quá 2× cỡ gốc ở 300 DPI (tránh mờ khi in); sticker khách tự kéo to thì giữ nguyên */
/** viền sticker / ảnh nền trong suốt: ảnh nở alpha r px (vẽ ảnh lệch theo vòng tròn) rồi tô 1 màu. Cache theo (ảnh, cỡ, độ dày, màu). */
const olCache = new WeakMap<object, Map<string, HTMLCanvasElement>>();
function outlined(img: Img, w: number, h: number, r: number, color: string) {
  const sc = Math.min(1, 2400 / Math.max(w, h)); // giới hạn cỡ canvas
  w = Math.round(w * sc); h = Math.round(h * sc); r = Math.max(1, Math.round(r * sc));
  const key = `${w}x${h}|${r}|${color}`;
  let m = olCache.get(img as object);
  if (!m) { m = new Map(); olCache.set(img as object, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas"); c.width = w + r * 2; c.height = h + r * 2;
  const x = c.getContext("2d")!, n = Math.min(64, Math.max(16, Math.round(r * 2.5)));
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; x.drawImage(img, r + Math.cos(a) * r, r + Math.sin(a) * r, w, h); }
  for (let rr = r * 0.5; rr >= 1; rr *= 0.5) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; x.drawImage(img, r + Math.cos(a) * rr, r + Math.sin(a) * rr, w, h); } // lấp kín phía trong
  x.drawImage(img, r, r, w, h);
  x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  if (m.size > 12) m.delete(m.keys().next().value!);
  m.set(key, c);
  return c;
}
const fitS = (l: { s: number; auto?: boolean }, img: Img) => (l.auto ? Math.min(l.s, (2 * Math.max(img.width, img.height) * 25.4) / 300) : l.s);
const isTopSticker = (l: Layer) => l.k === "sticker" && !!l.user;

/** Điểm (mm) có nằm trong ô (hình chữ nhật xoay) không */
export function inBox(px0: number, py0: number, b: { x: number; y: number; w: number; h: number; rot: number }) {
  const a = -rad(b.rot), dx = px0 - b.x, dy = py0 - b.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
}
