"use client";

/* Ảnh hộp CD thật cho Mẫu hệ thống (Auto): sprite cắt từ public/mockup/system/cd-sheet.png bằng scripts/slice-cd-sheet.mjs.
   Toạ độ (0..1 trong từng sprite) đọc từ sheet.json. Ảnh khách vẽ vào các ô trong suốt rồi sprite vẽ ĐÈ lên. */
import { coverCrop } from "@/lib/mockup/coverCrop";
import { BACK_H_CM, BACK_SPINE_CM, BACK_W_CM } from "@/lib/cdSpecs";
import type { GlassSettings } from "@/lib/mockup/types";

type Rect = { x0: number; y0: number; x1: number; y1: number };
type DiscGeo = { cx: number; cy: number; r: number; printIn: number; hub: number };
export type Sheet = {
  closed: { width: number; height: number; case: Rect; cover: Rect };
  open: { width: number; height: number; case: Rect; lid: Rect; tray: Rect; disc: DiscGeo };
  disc: { width: number; height: number } & DiscGeo;
};
export type Sprites = { sheet: Sheet; closed: HTMLImageElement; open: HTMLImageElement; disc: HTMLImageElement };
type Src = HTMLImageElement | null | undefined;

const BASE = "/mockup/system/";
let loading: Promise<Sprites | null> | null = null;
let ready: Sprites | null = null;
const img = (u: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
/** Tải sprite 1 lần (lỗi → null, bộ vẽ quay về hộp tự vẽ bằng code) */
export function loadSprites() {
  if (!loading) loading = Promise.all([fetch(`${BASE}sheet.json`).then((r) => r.json()), img(`${BASE}closed.png`), img(`${BASE}open.png`), img(`${BASE}disc.png`)])
    .then(([sheet, closed, open, disc]) => (ready = { sheet, closed, open, disc }))
    .catch(() => null);
  return loading;
}
export const sprites = () => ready;

// ---------- tiện ích (đơn vị px của canvas đầu ra) ----------
const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); const x = c.getContext("2d")!; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; return { c, x }; };
const R = (r: Rect, W: number, H: number) => ({ x: r.x0 * W, y: r.y0 * H, w: (r.x1 - r.x0) * W, h: (r.y1 - r.y0) * H });
const flipRect = (r: Rect): Rect => ({ x0: 1 - r.x1, y0: r.y0, x1: 1 - r.x0, y1: r.y1 });
const NUDGE = 2; // nới ô bìa 2px mỗi cạnh (phần thừa nằm dưới nhựa)

// Bìa 12 × 12 (phủ kín ô)
function cover(x: CanvasRenderingContext2D, im: Src, r: { x: number; y: number; w: number; h: number }) {
  const n = NUDGE;
  if (im === undefined) { x.fillStyle = "rgba(255,255,255,0.04)"; x.fillRect(r.x, r.y, r.w, r.h); return; } // không có bìa: nhựa hơi đục
  if (!im) { x.fillStyle = "#fbfbfa"; x.fillRect(r.x - n, r.y - n, r.w + n * 2, r.h + n * 2); return; }
  x.drawImage(coverCrop(im, (r.w + n * 2) / (r.h + n * 2), 2400), r.x - n, r.y - n, r.w + n * 2, r.h + n * 2);
}
// Tray card 15 × 11.7: phủ kín ô theo đúng tỉ lệ ảnh (không méo), phần dư 2 bên (gáy) nằm dưới mép nhựa
function card(x: CanvasRenderingContext2D, im: Src, r: { x: number; y: number; w: number; h: number }) {
  x.fillStyle = "rgba(255,255,255,0.04)"; x.fillRect(r.x, r.y, r.w, r.h);
  if (im === undefined) return;
  const n = NUDGE, X = r.x - n, Y = r.y - n, w = r.w + n * 2, h = r.h + n * 2;
  if (!im) { x.fillStyle = "#fbfbfa"; x.fillRect(X, Y, w, h); return; }
  const ar = BACK_W_CM / BACK_H_CM, sc = Math.max(w / ar, h); // cao của tray card khi phủ kín ô
  const ch = sc, cw = ch * ar;
  x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip();
  x.drawImage(coverCrop(im, ar, 2400), X + w / 2 - cw / 2, Y + h / 2 - ch / 2, cw, ch);
  x.restore();
}
// Bìa trước thật 12 × 12 trong ô hộp đóng (ô rộng hơn ~128 × 120 mm): bìa vuông theo chiều cao ô, căn giữa,
// 2 mép còn lại lộ tray card mặt trong phía sau (như nhìn xuyên hộp thật)
function squareCover(x: CanvasRenderingContext2D, im: Src, r: { x: number; y: number; w: number; h: number }) {
  if (im === undefined) return;
  const n = NUDGE, h = r.h + n * 2, w = Math.min(r.w + n * 2, h);
  const X = r.x + r.w / 2 - w / 2, Y = r.y - n;
  if (!im) { x.fillStyle = "#fbfbfa"; x.fillRect(X, Y, w, h); return; }
  x.drawImage(coverCrop(im, w / h, 2400), X, Y, w, h);
}
// Mặt đĩa: ảnh khách cắt vành khuyên (lỗ in 2,3 cm trên đĩa 12 cm → bán kính ngoài − 1.5%), che luôn vòng hub đen của PNG,
// giữ viền ngoài, phủ highlight cầu vồng mờ
const HOLE_RATIO = 2.3 / 12;
function printDisc(x: CanvasRenderingContext2D, im: Src, cx: number, cy: number, r: number, _rIn: number, sp: Sprites) {
  const rIn = r * HOLE_RATIO;
  const hubOut = sp.sheet.disc.printIn / sp.sheet.disc.r * r + 1; // mép ngoài vòng hub xám đậm của PNG
  if (!im) {
    // chưa có ảnh: giữ đĩa bạc của PNG, chỉ phủ vòng hub đen bằng màu bạc nhạt
    const g = x.createRadialGradient(cx, cy, rIn, cx, cy, hubOut);
    g.addColorStop(0, "#e6e8ec"); g.addColorStop(1, "#cfd3da");
    x.beginPath(); x.arc(cx, cy, hubOut, 0, Math.PI * 2); x.arc(cx, cy, rIn, 0, Math.PI * 2, true);
    x.fillStyle = g; x.fill("evenodd");
    return;
  }
  x.save();
  x.beginPath(); x.arc(cx, cy, r * 0.985, 0, Math.PI * 2); x.arc(cx, cy, rIn, 0, Math.PI * 2, true); x.clip("evenodd");
  x.drawImage(coverCrop(im, 1, 2400), cx - r, cy - r, r * 2, r * 2);
  const d = sp.sheet.disc, k = r / (d.r * d.width);
  x.globalAlpha = 0.12; x.globalCompositeOperation = "screen";
  x.drawImage(sp.disc, cx - d.cx * d.width * k, cy - d.cy * d.height * k, d.width * k, d.height * k);
  x.restore();
}
// lớp kính (cùng cài đặt với mẫu khung), cắt theo thân hộp
function glass(x: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, g: GlassSettings) {
  const k = Math.max(0, Math.min(100, g.strength)) / 100;
  if (!k) return;
  x.save();
  x.beginPath(); x.rect(r.x, r.y, r.w, r.h); x.clip();
  x.translate(r.x + r.w / 2, r.y + r.h / 2); x.rotate((g.angle * Math.PI) / 180);
  const d = Math.hypot(r.w, r.h), band = d * 0.32;
  const lg = x.createLinearGradient(-band, 0, band, 0);
  lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(255,255,255,${0.1 + 0.1 * k})`); lg.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = lg; x.fillRect(-d * 0.15 - band, -d, band * 2, d * 2);
  x.restore();
}

export type SpriteOut = { c: HTMLCanvasElement; ax: number; ay: number }; // ax, ay = tâm thân hộp trong canvas (để căn bố cục)
const anchor = (cs: Rect, W: number, H: number) => ({ ax: ((cs.x0 + cs.x1) / 2) * W, ay: ((cs.y0 + cs.y1) / 2) * H });

/** k = px đầu ra / px sprite */
export function spriteClosed(sp: Sprites, k: number, front: Src, backIn: Src, g: GlassSettings): SpriteOut {
  const s = sp.sheet.closed, W = s.width * k, H = s.height * k;
  const { c, x } = canvas(W, H);
  const win = R(s.cover, W, H), cs = R(s.case, W, H);
  // tray card mặt trong kéo sang trái tới hết vùng bản lề (không để trống), bìa trước 12 × 12 đặt lên trên
  const behind = { x: cs.x + 3 * k, y: win.y, w: win.x + win.w - (cs.x + 3 * k), h: win.h };
  if (front === undefined) cover(x, undefined, win); // không có bìa: nhựa hơi đục
  else { card(x, backIn, behind); squareCover(x, front, win); }
  x.drawImage(sp.closed, 0, 0, W, H);
  glass(x, R(s.case, W, H), g);
  return { c, ...anchor(s.case, W, H) };
}
/** Mặt sau: cùng sprite hộp đóng, lật ngang (bản lề bên phải) */
export function spriteBack(sp: Sprites, k: number, back: Src, g: GlassSettings): SpriteOut {
  const s = sp.sheet.closed, W = s.width * k, H = s.height * k;
  const { c, x } = canvas(W, H);
  const cs = flipRect(s.case), win = R(flipRect(s.cover), W, H), cr = R(cs, W, H);
  // tray card mặt ngoài kéo sang phải tới hết vùng bản lề
  const full = { x: win.x, y: win.y, w: cr.x + cr.w - 2 * k - win.x, h: win.h };
  card(x, back, full);
  x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage(sp.closed, 0, 0, W, H); x.restore();
  // vùng bản lề bên phải: vẽ lại tray card ĐÈ lên nhựa để ảnh liền mạch, không vạch nào đè lên
  if (back !== undefined) {
    x.save(); x.beginPath(); x.rect(win.x + win.w, full.y - NUDGE, full.x + full.w - (win.x + win.w), full.h + NUDGE * 2); x.clip();
    card(x, back, full);
    x.restore();
  }
  glass(x, R(cs, W, H), g);
  return { c, ...anchor(cs, W, H) };
}
export function spriteOpen(sp: Sprites, k: number, frontIn: Src, backIn: Src, disc: Src, g: GlassSettings): SpriteOut {
  const s = sp.sheet.open, W = s.width * k, H = s.height * k;
  const { c, x } = canvas(W, H);
  const lid = R(s.lid, W, H), tray = R(s.tray, W, H);
  cover(x, frontIn, lid);
  // tray card mặt trong kéo sang trái tới hết vùng bản lề giữa 2 nửa (không để trống)
  card(x, backIn, { x: lid.x + lid.w + 2 * k, y: tray.y, w: tray.x + tray.w - (lid.x + lid.w + 2 * k), h: tray.h });
  x.drawImage(sp.open, 0, 0, W, H);
  printDisc(x, disc, s.disc.cx * W, s.disc.cy * H, s.disc.r * W, s.disc.printIn * W, sp);
  glass(x, R(s.case, W, H), g);
  return { c, ...anchor(s.case, W, H) };
}
export function spriteDisc(sp: Sprites, k: number, disc: Src): SpriteOut {
  const d = sp.sheet.disc, W = d.width * k, H = d.height * k;
  const { c, x } = canvas(W, H);
  x.drawImage(sp.disc, 0, 0, W, H);
  printDisc(x, disc, d.cx * W, d.cy * H, d.r * W, d.printIn * W, sp);
  return { c, ax: d.cx * W, ay: d.cy * H };
}
/** mm của 1 px sprite: hộp thật rộng 142 mm = chiều rộng thân hộp trong closed.png */
export const mmPerPx = (sp: Sprites, caseMm: number) => caseMm / ((sp.sheet.closed.case.x1 - sp.sheet.closed.case.x0) * sp.sheet.closed.width);
