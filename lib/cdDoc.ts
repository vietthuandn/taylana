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
  bold?: boolean; italic?: boolean; underline?: boolean;
  shape?: FrameShape; // khung ảnh (mẫu)
  layer?: "above" | "below"; // ảnh trang trí của mẫu: trên/dưới ảnh khách
};
export type FrameFill = { src: string; nw: number; nh: number; zoom: number; ox: number; oy: number };
// half: ảnh nền của cả cặp trải đôi đã được tách → trang này hiện nửa trái/phải của ảnh
export type BgImage = { src: string; half?: "L" | "R" } | null;

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

// ---------- Trải đôi ----------
// Ở chế độ Trải đôi, artwork (ảnh, chữ, sticker, màu nền, ảnh nền) lưu theo CẶP TRANG (doc "S23"...),
// toạ độ trên cả vùng 2 trang. Mẫu + ảnh đặt trong khung mẫu vẫn lưu theo từng trang (P2, P3...).

// Tách cặp → 2 trang: mỗi trang nhận bản sao các phần tử chạm vào nó (toạ độ theo trang đó).
export function splitFromSpread(S: PageDoc | undefined, L: PageDoc, R: PageDoc, W1: number, measure: (e: El) => { w: number; h: number }): [PageDoc, PageDoc] {
  if (!S) return [L, R];
  const l: El[] = [], r: El[] = [];
  for (const e of S.els) {
    const b = elBox(e, measure);
    const inL = b.minX < W1, inR = b.maxX > W1;
    if (inL) l.push(e);
    if (inR) r.push({ ...e, id: inL ? uid() : e.id, x: e.x - W1 });
    if (!inL && !inR) l.push(e);
  }
  const bgL = S.bgImage ? { src: S.bgImage.src, half: "L" as const } : L.bgImage;
  const bgR = S.bgImage ? { src: S.bgImage.src, half: "R" as const } : R.bgImage;
  return [
    { ...L, els: [...L.els, ...l], bg: S.bg ?? L.bg, bgImage: bgL },
    { ...R, els: [...R.els, ...r], bg: S.bg ?? R.bg, bgImage: bgR },
  ];
}

// Ghép 2 trang → cặp: giữ nguyên vị trí (phần tử trang phải dịch sang phải 1 trang)
export function mergeToSpread(S: PageDoc | undefined, L: PageDoc, R: PageDoc, W1: number): { S: PageDoc; L: PageDoc; R: PageDoc } {
  const base = S ?? emptyDoc();
  const sameBg = L.bgImage?.half === "L" && R.bgImage?.half === "R" && L.bgImage.src === R.bgImage.src;
  const nS: PageDoc = {
    ...base,
    els: [...base.els, ...L.els, ...R.els.map((e) => ({ ...e, x: e.x + W1 }))],
    bg: base.bg ?? L.bg ?? R.bg,
    bgImage: base.bgImage ?? (sameBg ? { src: L.bgImage!.src } : null),
  };
  // ảnh nền riêng từng trang (không phải nửa của 1 ảnh) vẫn giữ ở trang đó
  return {
    S: nS,
    L: { ...L, els: [], bg: null, bgImage: sameBg ? null : L.bgImage },
    R: { ...R, els: [], bg: null, bgImage: sameBg ? null : R.bgImage },
  };
}
