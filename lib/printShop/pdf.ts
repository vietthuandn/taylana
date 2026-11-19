"use client";
/* Bàn in — tạo PDF in trên trình duyệt (pdf-lib): mỗi tờ giấy = 1 trang PDF đúng khổ (A4 / A5 / A6 / 12 × 12 cm), ảnh 300 DPI
   phủ kín khung cắt + lề tràn ở các mép ngoài, vạch cắt ở 4 góc, chữ ghi chú 5pt xám ngoài vùng cắt ("#2 username · Bìa sau").
   Mặt đĩa: phủ kín hình tròn 12 cm, không khoét lỗ (ngoài hình tròn để trắng). Có lệnh tự mở hộp thoại in khi mở PDF. */
import { PDFDocument, rgb } from "pdf-lib";
import type { Piece, Profile, Sheet } from "./layout";

export type ImgSrc = (orderId: string, slot: string) => Promise<{ blob: Blob; rot: number } | null>;
const MM = 72 / 25.4, DPI = 300, pxOf = (mm: number) => Math.max(1, Math.round((mm / 25.4) * DPI));
const bmpCache = new Map<string, Promise<ImageBitmap | null>>();
async function bitmap(key: string, blob: Blob) {
  let p = bmpCache.get(key);
  if (!p) { p = createImageBitmap(blob).catch(() => null); bmpCache.set(key, p); if (bmpCache.size > 40) bmpCache.delete(bmpCache.keys().next().value!); }
  return p;
}
/** vẽ ảnh phủ kín (cover) vào khung w × h mm, có xoay (độ) */
async function paint(src: { blob: Blob; rot: number }, key: string, w: number, h: number, rot: number, disc: boolean, scale = 1) {
  const bmp = await bitmap(`${key}@${src.blob.size}`, src.blob);
  const W = Math.max(1, Math.round(pxOf(w) * scale)), H = Math.max(1, Math.round(pxOf(h) * scale));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!; x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
  if (bmp) {
    x.save(); x.translate(W / 2, H / 2); x.rotate(((src.rot + rot) * Math.PI) / 180);
    const swap = ((src.rot + rot) / 90) % 2 === 1, bw = swap ? bmp.height : bmp.width, bh = swap ? bmp.width : bmp.height;
    const k = Math.max(W / bw, H / bh);
    x.imageSmoothingQuality = "high"; x.drawImage(bmp, (-bmp.width * k) / 2, (-bmp.height * k) / 2, bmp.width * k, bmp.height * k);
    x.restore();
  }
  if (disc) { x.globalCompositeOperation = "destination-in"; x.beginPath(); x.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2); x.fill(); x.globalCompositeOperation = "destination-over"; x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H); }
  return c;
}
const jpg = (c: HTMLCanvasElement) => new Promise<Uint8Array>((res, rej) => c.toBlob(async (b) => (b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error("Không xuất được ảnh"))), "image/jpeg", 0.95));
const png = (c: HTMLCanvasElement) => new Promise<Uint8Array>((res, rej) => c.toBlob(async (b) => (b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error("Không xuất được ảnh"))), "image/png"));
/** chữ ghi chú 5pt (ảnh PNG nền trong, không cần nhúng font tiếng Việt) */
function labelCanvas(t: string) {
  const px = 42, c = document.createElement("canvas"), x = c.getContext("2d")!;
  x.font = `${px}px "Be Vietnam Pro", Arial, sans-serif`;
  c.width = Math.ceil(x.measureText(t).width) + 8; c.height = Math.round(px * 1.3);
  x.font = `${px}px "Be Vietnam Pro", Arial, sans-serif`; x.fillStyle = "#6b7280"; x.textBaseline = "top"; x.fillText(t, 4, px * 0.1);
  return c;
}
/** khung ảnh của từng nội dung trên tờ (mm), mở rộng lề tràn ở các mép ngoài của vật in */
export function boxes(pl: { piece: Piece; side: number; x: number; y: number; rot180: boolean }, bleed: number) {
  const p = pl.piece, disc = p.group === "disc", b = disc ? 0 : bleed;
  return (p.sides[pl.side] ?? []).map((c) => {
    const cx = pl.rot180 ? p.w - c.x - c.w : c.x;
    const L = cx <= 0.01 ? b : 0, R = cx + c.w >= p.w - 0.01 ? b : 0;
    return { slot: c.slot, x: pl.x + cx - L, y: pl.y - b, w: c.w + L + R, h: p.h + b * 2 };
  });
}

export async function buildPdf(sheets: Sheet[], pr: Profile, src: ImgSrc, o: { autoprint?: boolean; onProgress?: (d: number, t: number) => void } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle("Taylana — Bàn in"); doc.setCreator("Taylana");
  for (const [i, s] of sheets.entries()) {
    o.onProgress?.(i, sheets.length);
    const page = doc.addPage([s.pw * MM, s.ph * MM]);
    const Y = (y: number, h: number) => (s.ph - y - h) * MM;
    for (const pl of s.places) {
      const disc = pl.piece.group === "disc";
      for (const bx of boxes(pl, pr.bleed)) {
        const img = await src(pl.piece.order.id, bx.slot);
        if (!img) continue;
        const c = await paint(img, `${pl.piece.order.id}/${bx.slot}`, bx.w, bx.h, pl.rot180 ? 180 : 0, disc);
        const e = await doc.embedJpg(await jpg(c));
        page.drawImage(e, { x: bx.x * MM, y: Y(bx.y, bx.h), width: bx.w * MM, height: bx.h * MM });
      }
      if (disc) continue;
      const { x, y } = pl, w = pl.piece.w, h = pl.piece.h, b = pr.bleed;
      // vạch cắt ở 4 góc (ngoài lề tràn)
      if (pr.marks) {
        const L = 4, g = b + 1, line = (x1: number, y1: number, x2: number, y2: number) => page.drawLine({ start: { x: x1 * MM, y: (s.ph - y1) * MM }, end: { x: x2 * MM, y: (s.ph - y2) * MM }, thickness: 0.3, color: rgb(0.35, 0.35, 0.35) });
        for (const [cx, sx] of [[x, -1], [x + w, 1]] as const) for (const [cy, sy] of [[y, -1], [y + h, 1]] as const) {
          line(cx + sx * g, cy, cx + sx * (g + L), cy);
          line(cx, cy + sy * g, cx, cy + sy * (g + L));
        }
      }
      // chữ ghi chú 5pt: dưới khung (hết chỗ thì phía trên), ngoài vùng cắt
      const t = labelCanvas(`#${pl.piece.order.seq} ${pl.piece.order.username || pl.piece.order.order_code} · ${pl.piece.label}${pl.side ? " · mặt sau" : ""}`);
      const th = 2.2, tw = (t.width / t.height) * th;
      let ly = y + h + b + 1.2;
      if (ly + th > s.ph - 1) ly = Math.max(0.5, y - b - 1.2 - th);
      const lx = Math.min(Math.max(0.5, x), s.pw - tw - 0.5);
      page.drawImage(await doc.embedPng(await png(t)), { x: lx * MM, y: Y(ly, th), width: tw * MM, height: th * MM });
    }
  }
  if (o.autoprint) doc.addJavaScript("print", "this.print({bUI: true, bSilent: false, bShrinkToFit: false});");
  o.onProgress?.(sheets.length, sheets.length);
  return doc.save();
}
/** ảnh thu nhỏ 1 tờ (xem trước trong hàng đợi) */
export async function previewSheet(s: Sheet, pr: Profile, src: ImgSrc, wPx = 220) {
  const k = wPx / s.pw, c = document.createElement("canvas"); c.width = wPx; c.height = Math.round(s.ph * k);
  const x = c.getContext("2d")!; x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
  for (const pl of s.places) for (const bx of boxes(pl, pr.bleed)) {
    const img = await src(pl.piece.order.id, bx.slot);
    if (!img) { x.fillStyle = "#fee2e2"; x.fillRect(bx.x * k, bx.y * k, bx.w * k, bx.h * k); continue; }
    const p = await paint(img, `${pl.piece.order.id}/${bx.slot}`, bx.w, bx.h, pl.rot180 ? 180 : 0, pl.piece.group === "disc", 0.12);
    x.drawImage(p, bx.x * k, bx.y * k, bx.w * k, bx.h * k);
  }
  x.strokeStyle = "#e4e4e7"; x.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  return c.toDataURL("image/jpeg", 0.8);
}
/** mở PDF ở tab mới (tự gọi lệnh in) */
export function openPdf(bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const w = window.open(url, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}
export function downloadPdf(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
