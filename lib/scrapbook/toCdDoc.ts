"use client";
/* Mẫu thư viện (CD Template · Trang đơn) → mẫu của trình "Thiết kế CD" (/thiet-ke/cd — lib/cdDoc TemplateDoc, toạ độ px bản in):
   lớp nằm dưới ô ảnh đầu tiên (nền + trang trí) → 1 ảnh PNG "below", lớp phía trên ảnh (băng dính, sticker, chữ…) → 1 ảnh PNG
   "above", mỗi ô ảnh → 1 khung (frame) cho khách thả ảnh; ô có khung PNG thì khung PNG đặt phía trên ô. Chạy trên trình duyệt admin
   khi lưu mẫu, ảnh tải lên kho công khai (scrapbook/cddoc). */
import { mmToPx } from "@/lib/print";
import { uploadFile } from "@/lib/storage/client";
import { uid, type El, type TemplateDoc } from "@/lib/cdDoc";
import { renderSurface, type RenderOpts } from "./render";
import { surfaceOf } from "./surface";
import type { Layer, Template } from "./types";

const png = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), "image/png"));
/** góc trên trái của khung (w × h) xoay r° quanh tâm (cx, cy) — El xoay quanh góc trên trái */
function topLeft(cx: number, cy: number, w: number, h: number, rot: number) {
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: cx - (w / 2) * c + (h / 2) * s, y: cy - (w / 2) * s - (h / 2) * c };
}

export async function buildCdDoc(t: Template, ro: Omit<RenderOpts, "template" | "size">): Promise<TemplateDoc> {
  const S = surfaceOf(t), W = mmToPx(120), k = W / S.w;
  const first = t.layers.findIndex((l) => l.k === "photo");
  const cut = first < 0 ? t.layers.length : first;
  const keep = (from: number, to: number) => t.layers.filter((l, i) => i >= from && i < to && l.k !== "photo" && !l.hidden);
  const opts = { ...ro, photos: [], photoMap: {}, editLayer: null, hideLayer: null };
  const below = renderSurface({ ...opts, template: { ...t, layers: keep(0, cut) }, size: W }).canvas;
  const aboveLayers = keep(cut + 1, Infinity);
  const els: El[] = [];
  const put = async (c: HTMLCanvasElement, layer: "above" | "below") => {
    const { url } = await uploadFile("scrapbook", await png(c), { folder: "cddoc", contentType: "image/png" });
    if (url) els.push({ id: uid(), kind: "image", src: url, nw: c.width, nh: c.height, x: 0, y: 0, width: W, height: W, rotation: 0, scaleX: 1, scaleY: 1, layer });
  };
  await put(below, "below");
  for (const l of t.layers) {
    if (l.k !== "photo" || l.hidden) continue;
    const p = l as Extract<Layer, { k: "photo" }>;
    const f = p.frame ? ro.frames?.[p.frame] : undefined;
    // ô ảnh: vùng ảnh của khung PNG (nếu có) bên trong khung bao của lớp
    let cx = p.x, cy = p.y, w = p.w, h = p.h;
    const rg = f?.frame.region;
    if (rg) {
      const ox = ((rg.x0 + rg.x1) / 2 - 0.5) * p.w, oy = ((rg.y0 + rg.y1) / 2 - 0.5) * p.h, a = (p.rot * Math.PI) / 180;
      cx = p.x + ox * Math.cos(a) - oy * Math.sin(a); cy = p.y + ox * Math.sin(a) + oy * Math.cos(a);
      w = (rg.x1 - rg.x0) * p.w; h = (rg.y1 - rg.y0) * p.h;
    }
    const tl = topLeft(cx * k, cy * k, w * k, h * k, p.rot);
    els.push({ id: `slot-${p.slot}-${uid()}`, kind: "frame", shape: p.shape === "circle" ? "circle" : "rect", x: tl.x, y: tl.y, width: w * k, height: h * k, rotation: p.rot, scaleX: 1, scaleY: 1 });
    if (f) {
      const fl = topLeft(p.x * k, p.y * k, p.w * k, p.h * k, p.rot);
      els.push({ id: uid(), kind: "image", src: f.frame.url, nw: f.img.width, nh: f.img.height, x: fl.x, y: fl.y, width: p.w * k, height: p.h * k, rotation: p.rot, scaleX: 1, scaleY: 1, layer: "above" });
    }
  }
  if (aboveLayers.length) {
    const clear = { ...t.bg, color: "rgba(0,0,0,0)", pattern: "plain" as const, asset: undefined, image: undefined };
    await put(renderSurface({ ...opts, template: { ...t, bg: clear, bg2: undefined, layers: aboveLayers }, size: W }).canvas, "above");
  }
  return { bg: t.bg.color, bgImage: null, els };
}
