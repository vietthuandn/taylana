"use client";

/* Mẫu hệ thống — vẽ từng đồ vật CD bằng canvas 2D theo kích thước thật (mm, lib/cdSpecs), 1 tỉ lệ px/mm chung.
   Mỗi hàm nhận s (px/mm) và trả về 1 canvas trong suốt chỉ chứa đồ vật (bóng đổ vẽ lúc ghép cảnh).
   Ảnh khách dán bằng coverCrop (phủ kín). undefined = không có giấy · null = giấy trắng. */
import {
  BACK_H_CM, BACK_SPINE_CM, BACK_W_CM, CASE_H_MM, CASE_W_MM, COVER3D_MM, DISC3D_D_MM, DISC3D_HOLE_MM,
} from "@/lib/cdSpecs";
import { coverCrop } from "@/lib/mockup/coverCrop";
import type { GlassSettings, TrayStyle } from "@/lib/mockup/types";

export type Src = HTMLImageElement | null | undefined;
export const CASE_W = CASE_W_MM, CASE_H = CASE_H_MM, COVER = COVER3D_MM;
export const CARD_W = BACK_W_CM * 10, CARD_H = BACK_H_CM * 10, CARD_SPINE = BACK_SPINE_CM * 10;
export const DISC_R = DISC3D_D_MM / 2, HOLE_R = DISC3D_HOLE_MM / 2;
const HINGE = 6; // dải bản lề
const COVER_X = HINGE + (CASE_W - HINGE - COVER) / 2, COVER_Y = (CASE_H - COVER) / 2;

// ---------- tiện ích ----------
type Ctx = CanvasRenderingContext2D;
export function surface(wmm: number, hmm: number, s: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(wmm * s)); c.height = Math.max(1, Math.ceil(hmm * s));
  const x = c.getContext("2d")!;
  x.scale(s, s);
  x.imageSmoothingQuality = "high";
  return { c, x };
}
function rr(x: Ctx, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath(); x.roundRect(X, Y, w, h, r);
}
// coverCrop có cache theo ảnh + tỉ lệ (ảnh không đổi thì không cắt lại)
const ids = new WeakMap<object, number>();
let nextId = 1;
export const idOf = (o: Src) => (o ? (ids.get(o) ?? (ids.set(o, nextId++), nextId - 1)) : o === null ? 0 : -1);
const crops = new Map<string, HTMLCanvasElement>();
function cropped(img: HTMLImageElement, aspect: number) {
  const k = `${idOf(img)}|${aspect.toFixed(4)}`;
  let c = crops.get(k);
  if (!c) { c = coverCrop(img, aspect, 2400); if (crops.size > 60) crops.clear(); crops.set(k, c); }
  return c;
}
/** Giấy in: ảnh phủ kín hoặc giấy trắng; vân giấy rất nhẹ */
function paper(x: Ctx, img: Src, X: number, Y: number, w: number, h: number) {
  if (img === undefined) return;
  if (img) x.drawImage(cropped(img, w / h), X, Y, w, h);
  else { x.fillStyle = "#fbfbfa"; x.fillRect(X, Y, w, h); }
}
// mảnh giấy cắt từ ảnh (vd. gáy / đáy của tray card), u0..u1 theo chiều ngang 0..1
function paperPart(x: Ctx, img: Src, aspect: number, u0: number, u1: number, X: number, Y: number, w: number, h: number) {
  if (img === undefined) return;
  if (!img) { x.fillStyle = "#fbfbfa"; x.fillRect(X, Y, w, h); return; }
  const c = cropped(img, aspect);
  x.drawImage(c, u0 * c.width, 0, (u1 - u0) * c.width, c.height, X, Y, w, h);
}
// lớp kính: dải phản chiếu chéo mờ (cùng cài đặt kính của mẫu khung)
function glassBand(x: Ctx, w: number, h: number, g: GlassSettings) {
  const k = Math.max(0, Math.min(100, g.strength)) / 100;
  if (!k) return;
  x.save();
  rr(x, 0, 0, w, h, 2); x.clip();
  x.translate(w / 2, h / 2); x.rotate((g.angle * Math.PI) / 180);
  const d = Math.hypot(w, h), band = d * 0.32;
  const lg = x.createLinearGradient(-band, 0, band, 0);
  lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(255,255,255,${0.1 + 0.1 * k})`); lg.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = lg; x.fillRect(-d * 0.15 - band, -d, band * 2, d * 2);
  x.restore();
}
// khung nhựa: tấm hơi đục + viền mỏng highlight trắng trên/trái, bóng tối dưới/phải
function plasticSlab(x: Ctx, w: number, h: number) {
  rr(x, 0, 0, w, h, 2);
  x.fillStyle = "rgba(232,238,243,0.42)"; x.fill();
  x.lineWidth = 0.6; x.strokeStyle = "rgba(255,255,255,0.55)"; rr(x, 1.2, 1.2, w - 2.4, h - 2.4, 1.4); x.stroke();
}
function plasticEdges(x: Ctx, w: number, h: number) {
  x.lineCap = "round";
  x.lineWidth = 0.9; x.strokeStyle = "rgba(255,255,255,0.95)";
  x.beginPath(); x.moveTo(1.5, h - 2); x.lineTo(1.5, 1.5); x.lineTo(w - 2, 1.5); x.stroke();
  x.lineWidth = 0.9; x.strokeStyle = "rgba(0,0,0,0.2)";
  x.beginPath(); x.moveTo(w - 1.2, 2); x.lineTo(w - 1.2, h - 1.2); x.lineTo(2, h - 1.2); x.stroke();
  x.lineWidth = 0.35; x.strokeStyle = "rgba(60,70,80,0.35)"; rr(x, 0.2, 0.2, w - 0.4, h - 0.4, 2); x.stroke();
}
// dải bản lề (nhựa hơi đục) + 2 khớp nhỏ trên / dưới
function hinge(x: Ctx, X: number, h: number, w = HINGE) {
  const g = x.createLinearGradient(X, 0, X + w, 0);
  g.addColorStop(0, "rgba(255,255,255,0.75)"); g.addColorStop(0.5, "rgba(225,232,238,0.6)"); g.addColorStop(1, "rgba(255,255,255,0.7)");
  x.fillStyle = g; x.fillRect(X, 0.8, w, h - 1.6);
  for (const y of [8, h - 22]) {
    rr(x, X + 0.9, y, w - 1.8, 14, 1.4);
    x.fillStyle = "rgba(255,255,255,0.8)"; x.fill();
    x.lineWidth = 0.3; x.strokeStyle = "rgba(0,0,0,0.18)"; x.stroke();
  }
}
function tabs(x: Ctx, X: number) {
  for (const y of [16, 30, CASE_H - 34, CASE_H - 20]) { rr(x, X, y, 3.5, 6, 1); x.fillStyle = "rgba(255,255,255,0.4)"; x.fill(); x.lineWidth = 0.25; x.strokeStyle = "rgba(0,0,0,0.12)"; x.stroke(); }
}

// ---------- đĩa ----------
function discArt(x: Ctx, cx: number, cy: number, img: Src) {
  const printIn = HOLE_R + 7;
  x.save();
  // vùng in phủ kín
  x.beginPath(); x.arc(cx, cy, DISC_R - 0.6, 0, Math.PI * 2); x.arc(cx, cy, printIn, 0, Math.PI * 2, true); x.clip("evenodd");
  if (img) x.drawImage(cropped(img, 1), cx - DISC_R, cy - DISC_R, DISC_R * 2, DISC_R * 2); else { x.fillStyle = "#fbfbfa"; x.fillRect(cx - DISC_R, cy - DISC_R, DISC_R * 2, DISC_R * 2); }
  // ánh sáng nhẹ trên mặt in
  const sh = x.createLinearGradient(cx - DISC_R, cy - DISC_R, cx + DISC_R, cy + DISC_R);
  sh.addColorStop(0, "rgba(255,255,255,0.12)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,0.06)");
  x.fillStyle = sh; x.fillRect(cx - DISC_R, cy - DISC_R, DISC_R * 2, DISC_R * 2);
  x.restore();
  // vùng trong suốt quanh lỗ + vòng nổi mảnh
  x.beginPath(); x.arc(cx, cy, printIn, 0, Math.PI * 2); x.arc(cx, cy, HOLE_R, 0, Math.PI * 2, true);
  x.fillStyle = "rgba(226,232,238,0.5)"; x.fill("evenodd");
  x.lineWidth = 0.35; x.strokeStyle = "rgba(255,255,255,0.9)"; x.beginPath(); x.arc(cx, cy, HOLE_R + 4.2, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = "rgba(0,0,0,0.12)"; x.beginPath(); x.arc(cx, cy, HOLE_R + 4.6, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 0.4; x.strokeStyle = "rgba(0,0,0,0.25)"; x.beginPath(); x.arc(cx, cy, HOLE_R, 0, Math.PI * 2); x.stroke();
  // vành ngoài nhựa trong + highlight
  x.beginPath(); x.arc(cx, cy, DISC_R, 0, Math.PI * 2); x.arc(cx, cy, DISC_R - 0.6, 0, Math.PI * 2, true);
  x.fillStyle = "rgba(235,240,245,0.75)"; x.fill("evenodd");
  x.lineWidth = 0.5; x.strokeStyle = "rgba(255,255,255,0.95)"; x.beginPath(); x.arc(cx, cy, DISC_R - 0.3, Math.PI * 1.05, Math.PI * 1.75); x.stroke();
  x.strokeStyle = "rgba(0,0,0,0.22)"; x.beginPath(); x.arc(cx, cy, DISC_R - 0.2, Math.PI * 0.05, Math.PI * 0.75); x.stroke();
}
export function drawDisc(s: number, img: Src) {
  const { c, x } = surface(DISC_R * 2, DISC_R * 2, s);
  discArt(x, DISC_R, DISC_R, img);
  return c;
}

// ---------- hộp đóng (mặt trước) ----------
export function drawClosed(s: number, front: Src, disc: Src, glass: GlassSettings) {
  const { c, x } = surface(CASE_W, CASE_H, s);
  plasticSlab(x, CASE_W, CASE_H);
  // không có bìa (CD + Hộp): nhìn xuyên thấy đĩa trong khay
  if (front === undefined) discArt(x, HINGE + (CASE_W - HINGE) / 2, CASE_H / 2, disc ?? null);
  paper(x, front, COVER_X, COVER_Y, COVER, COVER);
  hinge(x, 0, CASE_H);
  tabs(x, CASE_W - 6);
  glassBand(x, CASE_W, CASE_H, glass);
  plasticEdges(x, CASE_W, CASE_H);
  return c;
}

// ---------- mặt sau hộp: tray card mặt ngoài + 2 gáy dưới lớp nhựa gân dọc ----------
export function drawBack(s: number, back: Src, glass: GlassSettings) {
  const { c, x } = surface(CASE_W, CASE_H, s);
  plasticSlab(x, CASE_W, CASE_H);
  const aspect = CARD_W / CARD_H, sp = CARD_SPINE / CARD_W, cy = (CASE_H - CARD_H) / 2;
  const gw = 5, fx = gw, fw = CASE_W - gw * 2; // gáy nhìn nghiêng còn ~5 mm, đáy ở giữa (cắt đều 2 bên, không méo)
  const fu = (fw / CARD_W) / 2;
  paperPart(x, back, aspect, 0, sp, 0.6, cy, gw - 0.6, CARD_H);
  paperPart(x, back, aspect, 0.5 - fu, 0.5 + fu, fx, cy, fw, CARD_H);
  paperPart(x, back, aspect, 1 - sp, 1, CASE_W - gw, cy, gw - 0.6, CARD_H);
  // nhựa gân dọc phủ 2 gáy
  for (const X0 of [0, CASE_W - gw]) {
    x.fillStyle = "rgba(240,244,248,0.35)"; x.fillRect(X0, 0.8, gw, CASE_H - 1.6);
    for (let i = 0.6; i < gw; i += 0.8) {
      x.fillStyle = "rgba(255,255,255,0.45)"; x.fillRect(X0 + i, 1, 0.22, CASE_H - 2);
      x.fillStyle = "rgba(0,0,0,0.07)"; x.fillRect(X0 + i + 0.3, 1, 0.15, CASE_H - 2);
    }
  }
  glassBand(x, CASE_W, CASE_H, glass);
  plasticEdges(x, CASE_W, CASE_H);
  return c;
}

// ---------- hộp mở: trái = mặt trong nắp · phải = khay + tray card mặt trong + đĩa ----------
function rosette(x: Ctx, cx: number, cy: number, black: boolean) {
  x.fillStyle = black ? "#1b1b1e" : "rgba(236,241,245,0.75)";
  x.strokeStyle = black ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.16)"; x.lineWidth = 0.3;
  x.beginPath(); x.arc(cx, cy, HOLE_R + 6, 0, Math.PI * 2); x.fill(); x.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    x.save(); x.translate(cx + Math.cos(a) * (HOLE_R + 1.2), cy + Math.sin(a) * (HOLE_R + 1.2)); x.rotate(a);
    rr(x, -1.6, -1.1, 3.2, 2.2, 0.8); x.fillStyle = black ? "#2a2a2e" : "rgba(255,255,255,0.85)"; x.fill(); x.stroke();
    x.restore();
  }
}
export function drawOpen(s: number, frontIn: Src, backIn: Src, disc: Src, tray: TrayStyle, glass: GlassSettings, withDisc = true) {
  const W = CASE_W * 2;
  const { c, x } = surface(W, CASE_H, s);
  // nửa trái: mặt trong nắp (đối xứng hộp đóng)
  x.save();
  plasticSlab(x, CASE_W, CASE_H);
  paper(x, frontIn, CASE_W - COVER_X - COVER, COVER_Y, COVER, COVER);
  tabs(x, 2.5);
  glassBand(x, CASE_W, CASE_H, { ...glass, angle: -glass.angle });
  plasticEdges(x, CASE_W, CASE_H);
  x.restore();
  // nửa phải: khay
  x.save(); x.translate(CASE_W, 0);
  plasticSlab(x, CASE_W, CASE_H);
  const cy = (CASE_H - CARD_H) / 2, fw = CARD_W - CARD_SPINE * 2, fx = (CASE_W - fw) / 2;
  paperPart(x, backIn, CARD_W / CARD_H, CARD_SPINE / CARD_W, 1 - CARD_SPINE / CARD_W, fx, cy, fw, CARD_H);
  // 2 gáy gập đứng (nhìn từ trên chỉ thấy mép mảnh)
  if (backIn !== undefined) { x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(fx - 0.8, cy, 0.8, CARD_H); x.fillRect(fx + fw, cy, 0.8, CARD_H); }
  const black = tray === "black";
  // khay giữ đĩa: tấm khay + vòng gờ tròn + 4 lỗ góc + cụm ngàm
  rr(x, 3, 3, CASE_W - 6, CASE_H - 6, 2);
  x.fillStyle = black ? "#151517" : "rgba(238,242,246,0.28)"; x.fill();
  x.lineWidth = 0.4; x.strokeStyle = black ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)"; x.stroke();
  const ccx = CASE_W / 2, ccy = CASE_H / 2;
  x.lineWidth = 0.9; x.strokeStyle = black ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)"; x.beginPath(); x.arc(ccx, ccy, DISC_R + 1.2, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 0.35; x.strokeStyle = "rgba(0,0,0,0.14)"; x.beginPath(); x.arc(ccx, ccy, DISC_R + 1.8, 0, Math.PI * 2); x.stroke();
  for (const [px, py] of [[9, 9], [CASE_W - 9, 9], [CASE_W - 9, CASE_H - 9], [9, CASE_H - 9]]) {
    x.beginPath(); x.arc(px, py, 1.6, 0, Math.PI * 2); x.fillStyle = black ? "#050506" : "rgba(120,130,140,0.25)"; x.fill();
  }
  rosette(x, ccx, ccy, black);
  if (withDisc) {
    // bóng đĩa đổ lên khay (chỉ vẽ bóng: hình đặt ngoài khung, bóng dịch vào đúng chỗ)
    const off = 1000;
    x.save(); x.shadowColor = "rgba(0,0,0,0.22)"; x.shadowBlur = 3 * s; x.shadowOffsetX = off * s; x.shadowOffsetY = 0.8 * s;
    x.beginPath(); x.arc(ccx - off, ccy, DISC_R, 0, Math.PI * 2); x.fillStyle = "#000"; x.fill();
    x.restore();
    discArt(x, ccx, ccy, disc ?? null);
    // ngàm trồi lên giữa lỗ đĩa
    x.save(); x.beginPath(); x.arc(ccx, ccy, HOLE_R, 0, Math.PI * 2); x.clip(); rosette(x, ccx, ccy, black); x.restore();
  }
  glassBand(x, CASE_W, CASE_H, glass);
  plasticEdges(x, CASE_W, CASE_H);
  x.restore();
  // bản lề nối 2 nửa
  hinge(x, CASE_W - 5, CASE_H, 10);
  return c;
}

// ---------- booklet ----------
/** Mở đôi trang 2–3: bóng gáy giữa, 2 mép ngoài cong nhẹ */
export function drawSpread(s: number, left: Src, right: Src) {
  const P = COVER, W = P * 2, H = P + 4;
  const { c, x } = surface(W, H, s);
  const page = (img: Src, X: number, outerLeft: boolean) => {
    x.save();
    x.beginPath();
    if (outerLeft) { x.moveTo(X + P, 2); x.quadraticCurveTo(X + P * 0.45, 2.4, X, 0.6); x.lineTo(X + 0.4, H - 0.6); x.quadraticCurveTo(X + P * 0.45, H - 1.6, X + P, H - 2); }
    else { x.moveTo(X, 2); x.quadraticCurveTo(X + P * 0.55, 2.4, X + P, 0.6); x.lineTo(X + P - 0.4, H - 0.6); x.quadraticCurveTo(X + P * 0.55, H - 1.6, X, H - 2); }
    x.closePath(); x.clip();
    if (img) x.drawImage(cropped(img, 1), X, 0.6, P, H - 1.2); else { x.fillStyle = "#fbfbfa"; x.fillRect(X, 0, P, H); }
    // bóng gáy + mép ngoài hơi tối (cong)
    const g = x.createLinearGradient(outerLeft ? X + P : X, 0, outerLeft ? X : X + P, 0);
    g.addColorStop(0, "rgba(0,0,0,0.26)"); g.addColorStop(0.1, "rgba(0,0,0,0.06)"); g.addColorStop(0.85, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.08)");
    x.fillStyle = g; x.fillRect(X, 0, P, H);
    x.restore();
  };
  page(left, 0, true);
  page(right, P, false);
  return c;
}
/** Xoè: 2–3 trang chồng lệch, mỗi trang xoay vài độ (trang 1 trên cùng) */
export function drawFan(s: number, pages: Src[]) {
  const P = COVER, W = P * 1.5, H = P * 1.32;
  const { c, x } = surface(W, H, s);
  const list = pages.slice(0, 3).reverse();
  list.forEach((img, i) => {
    const k = list.length - 1 - i; // 0 = trang trên cùng
    x.save();
    x.translate(W / 2 + k * 9, H / 2 + k * 3); x.rotate(((k * 6 - 2) * Math.PI) / 180);
    x.shadowColor = "rgba(0,0,0,0.18)"; x.shadowBlur = 4 * s; x.shadowOffsetY = 1 * s;
    x.fillStyle = "#fff"; x.fillRect(-P / 2, -P / 2, P, P);
    x.shadowColor = "transparent";
    if (img) x.drawImage(cropped(img, 1), -P / 2, -P / 2, P, P);
    x.restore();
  });
  return c;
}
