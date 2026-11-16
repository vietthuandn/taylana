// Mô hình dữ liệu trang Custom CD — lưu theo TỪNG TRANG, toạ độ px bản in của trang đó.
import type { DesignTemplate } from "./templates";

export type FrameShape = "rect" | "square" | "circle" | "rounded";
export type El = {
  id: string;
  kind: "image" | "sticker" | "text" | "frame";
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  width?: number; height?: number;
  src?: string; nw?: number; nh?: number; // ảnh/sticker
  text?: string; fontFamily?: string; fontSize?: number; fill?: string; align?: "left" | "center" | "right"; lineHeight?: number;
  shape?: FrameShape; // khung ảnh (mẫu)
  layer?: "above" | "below"; // ảnh trang trí của mẫu: trên/dưới ảnh khách
};
export type FrameFill = { src: string; nw: number; nh: number; zoom: number; ox: number; oy: number };
export type BgImage = { src: string } | null;

// Nội dung 1 mẫu (do admin tạo)
export type TemplateDoc = { bg: string | null; bgImage: BgImage; els: El[] };
// Nội dung 1 trang của khách
export type PageDoc = {
  bg: string | null; // null = theo mẫu / trắng
  bgImage: BgImage;
  els: El[];
  templateId: string | null;
  fills: Record<string, FrameFill>; // ảnh khách đặt vào khung của mẫu
  texts: Record<string, string>; // khách sửa nội dung chữ của mẫu
};

export const DEFAULT_BG = "#ffffff";
export const emptyDoc = (): PageDoc => ({ bg: null, bgImage: null, els: [], templateId: null, fills: {}, texts: {} });
export const emptyTemplateDoc = (): TemplateDoc => ({ bg: null, bgImage: null, els: [] });
export const uid = () => Math.random().toString(36).slice(2, 10);

// Trang "có artwork" khi đã có bất kỳ thay đổi nào
export function docHasArtwork(d: PageDoc | undefined) {
  if (!d) return false;
  return d.els.length > 0 || Object.keys(d.fills).length > 0 || !!d.bgImage || (!!d.bg && d.bg.toLowerCase() !== DEFAULT_BG) || !!d.templateId;
}

// Mẫu cũ (ảnh khung + ô ảnh) → mẫu kiểu mới
export function templateDoc(t: DesignTemplate & { doc?: TemplateDoc | null }, W: number, H: number): TemplateDoc {
  if (t.doc && Array.isArray(t.doc.els)) return t.doc;
  const els: El[] = (t.slots ?? []).map((s) => ({
    id: `slot-${s.id}`, kind: "frame" as const, shape: s.shape === "circle" ? "circle" as const : "rect" as const,
    x: s.x * W, y: s.y * H, width: s.w * W, height: s.h * H, rotation: s.rotation ?? 0, scaleX: 1, scaleY: 1,
  }));
  if (t.overlay_url) els.push({ id: "overlay", kind: "image", src: t.overlay_url, x: 0, y: 0, width: W, height: H, rotation: 0, scaleX: 1, scaleY: 1, layer: "above" });
  return { bg: null, bgImage: t.background_url ? { src: t.background_url } : null, els };
}

// Khung bao (đã xoay) của 1 phần tử — dùng khi tách/ghép trải đôi
export function elBox(e: El, measureText?: (e: El) => { w: number; h: number }) {
  let w = (e.width ?? 0) * e.scaleX, h = (e.height ?? 0) * e.scaleY;
  if (e.kind === "text" && measureText) { const m = measureText(e); w = m.w * e.scaleX; h = m.h * e.scaleY; }
  const r = (e.rotation * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const pts = [[0, 0], [w, 0], [w, h], [0, h]].map(([px, py]) => [e.x + px * c - py * s, e.y + px * s + py * c]);
  const xs = pts.map((p) => p[0]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs) };
}

// Trải đôi → 1 trang: phần tử của trang nào giữ ở trang đó; vắt qua 2 trang thì nhân bản sang trang kia
export function splitSpread(L: PageDoc, R: PageDoc, W1: number, measure: (e: El) => { w: number; h: number }): [PageDoc, PageDoc] {
  const l: El[] = [], r: El[] = [];
  for (const e of L.els) {
    const b = elBox(e, measure);
    if (b.minX >= W1) r.push({ ...e, x: e.x - W1 });
    else { l.push(e); if (b.maxX > W1) r.push({ ...e, id: uid(), x: e.x - W1 }); }
  }
  for (const e of R.els) {
    const b = elBox(e, measure);
    if (b.maxX <= 0) l.push({ ...e, x: e.x + W1 });
    else { r.push(e); if (b.minX < 0) l.push({ ...e, id: uid(), x: e.x + W1 }); }
  }
  return [{ ...L, els: l }, { ...R, els: r }];
}
