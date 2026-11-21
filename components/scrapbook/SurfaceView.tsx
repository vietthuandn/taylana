"use client";

/* Khung xem + sửa 1 bề mặt scrapbook (đĩa / trang / cặp trang): bấm chọn lớp, kéo di chuyển, kéo góc phóng / thu, núm xoay,
   bấm đúp ô ảnh để chỉnh ảnh trong khung (kéo dịch, cuộn / nút ± để phóng), bấm ô ảnh trống để chọn ảnh,
   thả sticker / ảnh từ danh sách lên bề mặt, menu chuột phải. Guideline vẽ ở lớp phủ riêng trên cùng (mảnh, mờ,
   pointer-events: none) — không che hay chặn thao tác.
   Chữ: bấm 1 lần chọn, bấm thêm lần nữa (hoặc bấm đúp) để sửa trực tiếp — ô nhập đè đúng lên lớp chữ (vị trí, góc xoay,
   độ rộng, font, cỡ, màu, căn lề, khoảng cách dòng); Esc / Ctrl+Enter / bấm ra ngoài để thoát. Kéo 2 nút cạnh trái / phải
   để đổi độ rộng khung (chữ tự xuống dòng, cỡ giữ nguyên); 4 góc phóng / thu cả khối chữ. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Lock, Minus, Plus } from "lucide-react";
import { FONTS, WISH_FONT, renderSurface, type RenderOpts, type TextHit } from "@/lib/scrapbook/render";
import { applyBox, applyWidth, boxOf, imgAr, inside, resizeBox, snap, type Box as LBox } from "@/lib/scrapbook/edit";
import { surfaceOf } from "@/lib/scrapbook/surface";
import { C, R_HUB, R_OUT, R_SAFE, type Adjust, type Layer, type Template } from "@/lib/scrapbook/types";
import { cx } from "@/components/ui/styles";

export const ASSET_DRAG = "text/scrap-asset";
export const PHOTO_DRAG = "text/scrap-photo";

export type SurfaceViewProps = {
  t: Template; width: number; render: Omit<RenderOpts, "template" | "size">; guides: boolean;
  sel: number | null; onSel: (i: number | null) => void;
  editLayer: number | null; onEditLayer: (i: number | null) => void;
  begin: () => void; setLayers: (fn: (L: Layer[]) => Layer[], touched?: Layer) => void;
  adjustOf: (photoId: string) => Adjust | undefined; setAdjust: (photoId: string, a: Adjust) => void;
  onDropAsset?: (id: string, at: { x: number; y: number }) => void;
  onDropPhoto?: (photoId: string, layer: number) => void;
  onDropFreePhoto?: (photoId: string, at: { x: number; y: number }) => void; // thả ảnh ra ngoài ô ảnh → lớp ảnh tự do
  onDropFiles?: (files: File[], at: { x: number; y: number }) => void; // kéo file ảnh từ máy tính thả vào
  onEmptySlot?: (layer: number) => void;
  onTextEdit?: (layer: number) => void;
  // sửa chữ trực tiếp trên trang
  editText?: number | null; onEditText?: (layer: number | null) => void; selectAllText?: boolean;
  textValue?: (layer: number) => string; onTextValue?: (layer: number, v: string) => void;
  onBackgroundDbl?: (at: { x: number; y: number }) => void;
  tools?: React.ReactNode;
  scanning?: number | null; // lớp ảnh đang được "cắt" (xoá nền) — hiện hiệu ứng quét
  cropLayer?: number | null; onCrop?: (i: number | null) => void;
  onViewZoom?: (f: number) => void; onViewPan?: (dx: number, dy: number) => void; // 2 ngón ở vùng trống: phóng / kéo khu làm việc
  bgEdit?: boolean; onBgEdit?: (on: boolean, right?: boolean) => void; onBgMove?: (dx: number, dy: number, start: boolean) => void; onBgZoom?: (f: number) => void; bgBar?: React.ReactNode; // sửa ảnh nền // chế độ cắt ảnh tự do (bấm đúp / nút Cắt)
};

export function SurfaceView(p: SurfaceViewProps) {
  const { t, width } = p;
  const S = surfaceOf(t), k = width / S.w, height = S.h * k;
  const view = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const textBoxes = useRef<Record<number, LBox>>({});
  const bgDrag = useRef<{ x: number; y: number } | null>(null);
  // ---------- chạm (điện thoại / máy tính bảng): 2 ngón · chạm đúp · nhấn giữ 0.5 giây ----------
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<null | { kind: "layer"; i: number; b0: LBox; l0: Layer; d0: number; a0: number } | { kind: "view"; d: number; mx: number; my: number }>(null);
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null), lastTapDbl = useRef(0);
  const two = () => { const [a, b] = [...ptrs.current.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y), a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  function tDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      const sx = e.clientX, sy = e.clientY;
      press.current = { x: sx, y: sy, t: setTimeout(() => { // nhấn giữ → menu như chuột phải
        press.current = null;
        if (!view.current || drag.current?.moved) return;
        const r = view.current.getBoundingClientRect(), pt = { x: ((sx - r.left) / r.width) * S.w, y: ((sy - r.top) / r.height) * S.h }, i = layerAt(pt.x, pt.y);
        if (i < 0) return;
        drag.current = null; p.onSel(i); setMenu({ x: sx - r.left, y: sy - r.top });
      }, 500) };
    }
    if (ptrs.current.size === 2) {
      if (press.current) { clearTimeout(press.current.t); press.current = null; }
      const g = two(), r = view.current?.getBoundingClientRect();
      const mid = r ? { x: ((g.mx - r.left) / r.width) * S.w, y: ((g.my - r.top) / r.height) * S.h } : null;
      const b = p.sel !== null ? layerBox(p.sel) : null, i = p.sel;
      drag.current = null;
      if (i !== null && b && mid && !L[i]?.ulock && (inside(mid.x, mid.y, { ...b, w: b.w * 1.4, h: b.h * 1.4 }))) { p.begin(); gesture.current = { kind: "layer", i, b0: b, l0: L[i], d0: g.d, a0: g.a }; }
      else gesture.current = { kind: "view", d: g.d, mx: g.mx, my: g.my };
    }
  }
  function tMove(e: React.PointerEvent) {
    if (e.pointerType !== "touch" || !ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) { clearTimeout(press.current.t); press.current = null; }
    const G = gesture.current;
    if (!G || ptrs.current.size < 2) return;
    const g = two();
    if (G.kind === "layer") {
      const sc = g.d / Math.max(1, G.d0), b = { ...G.b0, w: G.b0.w * sc, h: G.b0.h * sc, rot: Math.round(G.b0.rot + g.a - G.a0) };
      p.setLayers((ls) => ls.map((l, j) => (j === G.i ? applyBox(G.l0, b, G.b0) : l)), G.l0);
    } else {
      p.onViewZoom?.(g.d / Math.max(1, G.d)); p.onViewPan?.(g.mx - G.mx, g.my - G.my);
      gesture.current = { kind: "view", d: g.d, mx: g.mx, my: g.my };
    }
  }
  function tUp(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    if (press.current) { clearTimeout(press.current.t); press.current = null; }
    const was = ptrs.current.get(e.pointerId);
    ptrs.current.delete(e.pointerId);
    if (gesture.current) { if (ptrs.current.size === 0) gesture.current = null; return; }
    // chạm đúp (không kéo) → như bấm đúp (cắt ảnh / sửa chữ / sửa nền)
    if (was && view.current && !drag.current?.moved) {
      const now = Date.now(), lt = lastTap.current;
      if (lt && now - lt.at < 320 && Math.hypot(was.x - lt.x, was.y - lt.y) < 24) {
        lastTap.current = null; lastTapDbl.current = now;
        const r = view.current.getBoundingClientRect(); dblAt({ x: ((was.x - r.left) / r.width) * S.w, y: ((was.y - r.top) / r.height) * S.h });
      } else lastTap.current = { at: now, x: was.x, y: was.y };
    }
  }
  const drag = useRef<{ mode: "move" | "scale" | "rotate" | "pan" | "width" | "cropEdge"; c0?: { x: number; y: number; w: number; h: number }; i: number; b0: LBox; sx: number; sy: number; adj0?: Adjust; layer0?: Layer; pid?: string; moved?: boolean; wasSel?: boolean; side?: -1 | 1; hx?: -1 | 0 | 1; hy?: -1 | 0 | 1 } | null>(null);
  const editing = p.editText ?? null;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [guide, setGuide] = useState<{ center?: boolean; ring?: number; vx?: number; hy?: number } | null>(null);
  const [, setTick] = useState(0);
  const L = t.layers;
  const toolW = useRef(0);
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    const v = view.current;
    if (!v || width <= 0) return;
    const r = renderSurface({ template: t, ...p.render, size: Math.min(3200, Math.round(width * dpr)), editLayer: p.editLayer, hideLayer: editing });
    textBoxes.current = Object.fromEntries(r.texts.map((h: TextHit) => [h.layer, { x: h.x, y: h.y, w: h.w, h: h.h, rot: h.rot }]));
    v.width = r.canvas.width; v.height = r.canvas.height; v.getContext("2d")!.drawImage(r.canvas, 0, 0);
    setTick((x) => x + 1);
  }, [t, p.render, width, dpr, p.editLayer, editing]);

  const layerBox = (i: number) => { const l = L[i]; return l ? boxOf(l, l.k === "text" ? textBoxes.current[i] : undefined, (l.k === "sticker" || l.k === "doodle") && l.asset ? imgAr(l, p.render.assets?.[l.asset]?.img ?? p.render.bgImages?.[l.asset]) : 1) : null; };
  const toMM = (e: { clientX: number; clientY: number }) => { const r = view.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * S.w, y: ((e.clientY - r.top) / r.height) * S.h }; };
  const layerAt = (x: number, y: number) => {
    // sticker khách thêm vẽ trên cùng → được ưu tiên bấm trúng
    const idx = L.map((_, i) => i).sort((a, b) => Number(top(L[a])) - Number(top(L[b])) || a - b);
    for (let j = idx.length - 1; j >= 0; j--) { const i = idx[j]; if (L[i].locked || L[i].hidden) continue; const b = layerBox(i); if (b && inside(x, y, b)) return i; }
    return -1;
  };
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (gesture.current) return; // đang thao tác 2 ngón
    setMenu(null);
    if (e.button === 2) return;
    const pt = toMM(e);
    if (p.bgEdit) { e.currentTarget.setPointerCapture(e.pointerId); bgDrag.current = pt; p.onBgMove?.(0, 0, true); return; } // kéo để dịch ảnh nền
    if (editing !== null) p.onEditText?.(null); // bấm ra ngoài ô đang sửa → thoát chế độ sửa
    if (p.editLayer !== null) {
      const l = L[p.editLayer], b = layerBox(p.editLayer);
      if (l?.k === "photo" && l.photo && b && inside(pt.x, pt.y, b)) {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { mode: "pan", i: p.editLayer, b0: b, sx: pt.x, sy: pt.y, adj0: p.adjustOf(l.photo) ?? { dx: 0, dy: 0, zoom: 1 }, pid: l.photo };
        return;
      }
      p.onEditLayer(null);
    }
    const i = layerAt(pt.x, pt.y);
    if (i < 0) { p.onSel(null); return; }
    const wasSel = p.sel === i && editing === null;
    p.onSel(i);
    const b = layerBox(i);
    if (!b || L[i].ulock) return; // lớp khách khoá: chỉ chọn được (để mở khoá), không kéo
    e.currentTarget.setPointerCapture(e.pointerId);
    p.begin();
    drag.current = { mode: "move", i, b0: b, sx: pt.x, sy: pt.y, layer0: L[i], wasSel };
  }
  function startWidth(e: React.PointerEvent, side: -1 | 1) {
    if (p.sel === null) return;
    e.stopPropagation();
    const b = layerBox(p.sel);
    if (!b) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    p.begin();
    const pt = toMM(e);
    drag.current = { mode: "width", i: p.sel, b0: { ...b, x: L[p.sel].x, y: L[p.sel].y }, sx: pt.x, sy: pt.y, layer0: L[p.sel], side };
  }
  // ảnh tự do: 4 nút CẠNH = cắt theo cạnh đó (cạnh đối diện cố định, kéo ra tối đa tới mép ảnh gốc) — toạ độ hiển thị (đã tính lật)
  const dispCrop = (l: Extract<Layer, { k: "sticker" }>, c = l.crop ?? { x: 0, y: 0, w: 1, h: 1 }) => ({ x: l.fx ? 1 - c.x - c.w : c.x, y: l.fy ? 1 - c.y - c.h : c.y, w: c.w, h: c.h });
  function startCropEdge(e: React.PointerEvent, hx: -1 | 0 | 1, hy: -1 | 0 | 1) {
    if (p.sel === null) return;
    const l = L[p.sel];
    if (l?.k !== "sticker") return;
    e.stopPropagation();
    const b = layerBox(p.sel);
    if (!b) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    p.begin();
    const pt = toMM(e);
    drag.current = { mode: "cropEdge", i: p.sel, b0: b, sx: pt.x, sy: pt.y, layer0: l, hx, hy, c0: dispCrop(l) };
  }
  function startHandle(e: React.PointerEvent, mode: "scale" | "rotate", hx: -1 | 0 | 1 = 1, hy: -1 | 0 | 1 = 1) {
    if (p.sel === null) return;
    e.stopPropagation();
    const b = layerBox(p.sel);
    if (!b) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    p.begin();
    const pt = toMM(e);
    drag.current = { mode, i: p.sel, b0: b, sx: pt.x, sy: pt.y, layer0: L[p.sel], hx, hy };
  }
  function onMove(e: React.PointerEvent) {
    if (gesture.current) return;
    if (bgDrag.current) { const pt = toMM(e); p.onBgMove?.(pt.x - bgDrag.current.x, pt.y - bgDrag.current.y, false); bgDrag.current = pt; return; }
    const d = drag.current;
    if (!d) return;
    const pt = toMM(e), b0 = d.b0;
    if (d.mode === "pan") {
      const a = (-b0.rot * Math.PI) / 180, dx = pt.x - d.sx, dy = pt.y - d.sy;
      p.setAdjust(d.pid!, { ...d.adj0!, dx: d.adj0!.dx + dx * Math.cos(a) - dy * Math.sin(a), dy: d.adj0!.dy + dx * Math.sin(a) + dy * Math.cos(a) });
      return;
    }
    if (d.mode === "cropEdge") {
      const l0 = d.layer0 as Extract<Layer, { k: "sticker" }>, c0 = d.c0!, FW = b0.w / c0.w, FH = b0.h / c0.h, a = (b0.rot * Math.PI) / 180;
      const vx = pt.x - b0.x, vy = pt.y - b0.y, lx = vx * Math.cos(-a) - vy * Math.sin(-a), ly = vx * Math.sin(-a) + vy * Math.cos(-a);
      const MIN = 0.04; let { x, y, w, h } = c0, sx = 0, sy = 0;
      if (d.hx === 1) { const u = Math.min(1, Math.max(c0.x + MIN, c0.x + (lx / b0.w + 0.5) * c0.w)); w = u - c0.x; sx = ((w - c0.w) * FW) / 2; }
      if (d.hx === -1) { const u = Math.max(0, Math.min(c0.x + c0.w - MIN, c0.x + (lx / b0.w + 0.5) * c0.w)); x = u; w = c0.x + c0.w - u; sx = -((w - c0.w) * FW) / 2; }
      if (d.hy === 1) { const v = Math.min(1, Math.max(c0.y + MIN, c0.y + (ly / b0.h + 0.5) * c0.h)); h = v - c0.y; sy = ((h - c0.h) * FH) / 2; }
      if (d.hy === -1) { const v = Math.max(0, Math.min(c0.y + c0.h - MIN, c0.y + (ly / b0.h + 0.5) * c0.h)); y = v; h = c0.y + c0.h - v; sy = -((h - c0.h) * FH) / 2; }
      const nw = w * FW, nh = h * FH, full = x <= 0.001 && y <= 0.001 && w >= 0.999 && h >= 0.999;
      const src = { x: l0.fx ? 1 - x - w : x, y: l0.fy ? 1 - y - h : y, w, h };
      const nl = { ...l0, crop: full ? undefined : src, x: b0.x + sx * Math.cos(a) - sy * Math.sin(a), y: b0.y + sx * Math.sin(a) + sy * Math.cos(a), s: Math.max(nw, nh) } as Layer;
      p.setLayers((ls) => ls.map((l, j) => (j === d.i ? nl : l)), l0);
      return;
    }
    if (d.mode === "width") { const l0 = d.layer0!; p.setLayers((ls) => ls.map((l, j) => (j === d.i ? applyWidth(l0, b0, d.side!, pt.x, pt.y) : l)), l0); return; }
    let b: LBox = b0;
    if (d.mode === "move") {
      if (Math.hypot(pt.x - d.sx, pt.y - d.sy) > 0.6) d.moved = true;
      if (!d.moved) return;
      const nx = b0.x + pt.x - d.sx, ny = b0.y + pt.y - d.sy;
      const s = S.round ? snap(nx, ny) : { x: nx, y: ny, guide: {} as { center?: boolean; ring?: number } };
      // gióng giữa kiểu Canva: tâm lớp gần đường giữa dọc / ngang của bề mặt (cặp trang: thêm giữa từng trang) → hít nhẹ + vạch đỏ
      const tol = Math.max(1, 6 / k), g: { center?: boolean; ring?: number; vx?: number; hy?: number } = { ...s.guide };
      if (!g.center && !g.ring) {
        const vx = (S.kind === "spread" ? [S.w / 2, S.w / 4, (S.w * 3) / 4] : [S.w / 2]).find((v) => Math.abs(s.x - v) < tol);
        if (vx !== undefined) { s.x = vx; g.vx = vx; }
        if (Math.abs(s.y - S.h / 2) < tol) { s.y = S.h / 2; g.hy = S.h / 2; }
      }
      setGuide(g.center || g.ring || g.vx !== undefined || g.hy !== undefined ? g : null);
      b = { ...b0, x: s.x, y: s.y };
    } else if (d.mode === "rotate") {
      let r = Math.round((Math.atan2(pt.y - b0.y, pt.x - b0.x) * 180) / Math.PI + 90);
      if (Math.abs(((r % 90) + 90) % 90) < 3 || Math.abs(((r % 90) + 90) % 90) > 87) r = Math.round(r / 90) * 90;
      b = { ...b0, rot: r };
    } else {
      // góc / cạnh đối diện đứng yên · Shift = giữ tỉ lệ (lớp kéo giãn tự do) · Alt = từ tâm
      const l0 = d.layer0!, free = stretchable(l0);
      b = resizeBox(b0, d.hx ?? 1, d.hy ?? 1, pt.x, pt.y, { lock: !free || e.shiftKey, fromCenter: e.altKey, min: l0.k === "text" ? 1 : 2 });
    }
    const l0 = d.layer0!;
    p.setLayers((ls) => ls.map((l, j) => (j === d.i ? applyBox(l0, b, b0) : l)), l0);
  }
  const onUp = () => {
    bgDrag.current = null;
    const d = drag.current;
    drag.current = null; setGuide(null);
    // bấm (không kéo) vào ô ảnh trống → chọn ảnh
    if (d?.mode === "move" && !d.moved) {
      const l = L[d.i];
      if (l?.k === "photo" && l.photo === "") p.onEmptySlot?.(d.i);
      else if (d.wasSel && (l?.k === "text" || l?.k === "wish")) p.onEditText?.(d.i); // bấm lần 2 vào lớp chữ đang chọn → sửa
    }
  };
  function onDbl(e: React.MouseEvent<HTMLCanvasElement>) {
    if (Date.now() - lastTapDbl.current < 500) return; // đã xử lý bằng chạm đúp
    dblAt(toMM(e));
  }
  function dblAt(pt: { x: number; y: number }) {
    const i = layerAt(pt.x, pt.y), l = L[i];
    if (!l) { if (p.onBgEdit && (pt.x >= S.w / 2 && t.bg2 ? t.bg2.image : t.bg.image)) { p.onSel(null); p.onBgEdit(true, pt.x >= S.w / 2 && !!t.bg2); } else p.onBackgroundDbl?.(pt); return; }
    if (l.k === "photo") { if (l.photo === "") p.onEmptySlot?.(i); else { p.onEditLayer(i); p.onSel(null); } }
    if (l.k === "sticker" && l.asset?.startsWith("p:") && !l.ulock) p.onCrop?.(i);
    if (l.k === "text" || l.k === "wish") { if (p.onEditText) p.onEditText(i); else p.onTextEdit?.(i); }
  }
  function onContext(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const pt = toMM(e), i = layerAt(pt.x, pt.y);
    if (i < 0) return;
    p.onSel(i);
    const r = view.current!.getBoundingClientRect();
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top });
  }
  function onDrop(e: React.DragEvent) {
    const pid = e.dataTransfer.getData(PHOTO_DRAG), aid = e.dataTransfer.getData(ASSET_DRAG);
    const files = [...(e.dataTransfer.files ?? [])].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!pid && !aid && !files.length) return;
    e.preventDefault();
    const pt = toMM(e);
    if (!pid && !aid) { p.onDropFiles?.(files, pt); return; }
    if (pid) { const i = layerAt(pt.x, pt.y); const j = i >= 0 && L[i].k === "photo" ? i : L.findIndex((l, n) => l.k === "photo" && (() => { const b = layerBox(n); return b && inside(pt.x, pt.y, b); })()); if (j >= 0 && p.onDropPhoto) p.onDropPhoto(pid, j); else p.onDropFreePhoto?.(pid, pt); return; }
    p.onDropAsset?.(aid, pt);
  }
  const zoom = useCallback((dz: number) => {
    if (p.editLayer === null) return;
    const l = L[p.editLayer];
    if (l?.k !== "photo" || !l.photo) return;
    const a = p.adjustOf(l.photo) ?? { dx: 0, dy: 0, zoom: 1 };
    p.setAdjust(l.photo, { ...a, zoom: Math.min(3, Math.max(1, Math.round((a.zoom + dz) * 100) / 100)) });
  }, [p, L]);
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const h = (e: WheelEvent) => { if (p.bgEdit) { e.preventDefault(); p.onBgZoom?.(e.deltaY < 0 ? 1.06 : 1 / 1.06); return; } if (p.editLayer === null) return; e.preventDefault(); zoom(e.deltaY < 0 ? 0.08 : -0.08); };
    v.addEventListener("wheel", h, { passive: false });
    return () => v.removeEventListener("wheel", h);
  }, [p.editLayer, zoom, p.bgEdit, p.onBgZoom]); // eslint-disable-line react-hooks/exhaustive-deps
  // sửa nền: bấm ra ngoài bề mặt → thoát
  useEffect(() => {
    if (!p.bgEdit) return;
    const h = (e: PointerEvent) => { const el = e.target as HTMLElement; if (!root.current?.contains(el) && !el.closest?.("[data-bg-bar],[data-keep-sel]")) p.onBgEdit?.(false); };
    document.addEventListener("pointerdown", h, true);
    return () => document.removeEventListener("pointerdown", h, true);
  }, [p.bgEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (p.sel === null) setMenu(null); }, [p.sel]);
  // iPad / iPhone: đang kéo / phóng / xoay lớp thì chặn cuộn trang (Safari có lúc vẫn cuộn giữa chừng → thao tác bị ngắt)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { if (drag.current) e.preventDefault(); };
    el.addEventListener("touchmove", stop, { passive: false });
    document.addEventListener("touchmove", stop, { passive: false });
    return () => { el.removeEventListener("touchmove", stop); document.removeEventListener("touchmove", stop); };
  }, []);

  const SB = p.sel !== null && p.editLayer === null && editing === null && p.cropLayer == null ? layerBox(p.sel) : null;
  const selL = p.sel !== null ? L[p.sel] : null;
  const sideHandles = selL?.k === "text" && !selL.arc;
  // lớp kéo giãn tự do (thêm 4 nút giữa cạnh): ô ảnh chữ nhật / vuông / bo góc / giấy xé / tròn / tim, khung PNG admin cho phép, giấy, băng dính, lời chúc
  function stretchable(l: Layer) {
    if (l.k === "paper" || l.k === "tape" || l.k === "wish") return true;
    if (l.k !== "photo") return false;
    if (l.frame) return !!p.render.frames?.[l.frame]?.frame.allow_stretch;
    return l.shape !== "polaroid" && l.shape !== "frame";
  }
  const freePhoto = selL?.k === "sticker" && !!selL.asset?.startsWith("p:");
  const edgeHandles = !!selL && !sideHandles && (stretchable(selL) || freePhoto);
  // thanh nhỏ ở PHÍA TRÊN lớp, nút xoay ở PHÍA DƯỚI (cách 24px) — sát mép trên khu xem trước thì đổi chỗ cho nhau
  const TBH = 40, sbExt = SB ? (Math.abs(SB.w * Math.sin((SB.rot * Math.PI) / 180)) + Math.abs(SB.h * Math.cos((SB.rot * Math.PI) / 180))) / 2 : 0;
  const barAboveTop = SB ? (SB.y - sbExt) * k - 10 - TBH : 0, swapBar = !!SB && barAboveTop < 0;
  return (
    <div ref={root} className="relative touch-none" style={{ width, height }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={(e) => { onUp(); tUp(e); }}
      onPointerDownCapture={tDown} onPointerMoveCapture={tMove} onPointerUpCapture={tUp}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(ASSET_DRAG) || e.dataTransfer.types.includes(PHOTO_DRAG) || (p.onDropFiles && e.dataTransfer.types.includes("Files"))) e.preventDefault(); }} onDrop={onDrop}>
      <canvas ref={view} className={cx("block h-full w-full touch-none", p.editLayer !== null ? "cursor-move" : "cursor-pointer", !S.round && "shadow-[0_10px_30px_rgba(0,0,0,0.12)]")}
        onPointerDown={onDown} onDoubleClick={onDbl} onContextMenu={onContext} />
      {/* guideline: lớp phủ riêng trên cùng, mảnh + mờ, không chặn thao tác */}
      {p.guides && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${S.w} ${S.h}`} aria-hidden>
          {S.round ? (
            <g fill="none" strokeWidth="0.25" strokeDasharray="1.4 1.2">
              <circle cx={C} cy={C} r={R_OUT - 0.2} stroke="rgba(255,95,162,0.55)" />
              <circle cx={C} cy={C} r={R_SAFE} stroke="rgba(60,60,70,0.35)" />
              <circle cx={C} cy={C} r={R_HUB} stroke="rgba(60,60,70,0.35)" />
              <g stroke="rgba(60,60,70,0.18)"><line x1={C - 3} y1={C} x2={C + 3} y2={C} /><line x1={C} y1={C - 3} x2={C} y2={C + 3} /></g>
            </g>
          ) : (
            <g fill="none" strokeWidth="0.25" strokeDasharray="1.4 1.2" stroke="rgba(60,60,70,0.35)">
              {S.kind === "spread" ? (<><rect x={5} y={5} width={108} height={110} /><rect x={127} y={5} width={108} height={110} /></>)
                : <rect x={S.safe.x0} y={S.safe.y0} width={S.safe.x1 - S.safe.x0} height={S.safe.y1 - S.safe.y0} />}
              {S.gutter !== null && <line x1={S.gutter} y1={0} x2={S.gutter} y2={S.h} stroke="rgba(255,95,162,0.55)" strokeDasharray="none" strokeWidth="0.4" />}
              {(S.folds ?? []).map((f) => <line key={f} x1={f} y1={0} x2={f} y2={S.h} stroke="rgba(255,95,162,0.55)" strokeDasharray="none" strokeWidth="0.4" />)}
            </g>
          )}
        </svg>
      )}
      {p.scanning != null && (() => { const b = layerBox(p.scanning); return b && (
        <div className="pointer-events-none absolute z-20 overflow-hidden rounded-[2px]" style={{ left: (b.x - b.w / 2) * k, top: (b.y - b.h / 2) * k, width: b.w * k, height: b.h * k, transform: `rotate(${b.rot}deg)` }} aria-label="Đang xoá nền">
          <div className="absolute inset-0 bg-white/15" />
          <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-[scan-sweep_1.1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          <div className="absolute inset-y-0 -left-1/2 w-[3px] animate-[scan-sweep_1.1s_ease-in-out_infinite] bg-[var(--c-primary)] shadow-[0_0_12px_var(--c-primary)]" style={{ marginLeft: "25%" }} />
        </div>
      ); })()}
      {guide && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${S.w} ${S.h}`}>
          {guide.center && <g stroke="#2563eb" strokeWidth="0.3" strokeDasharray="1.2 1"><line x1={C} y1="0" x2={C} y2={S.h} /><line x1="0" y1={C} x2={S.w} y2={C} /></g>}
          {guide.ring && <circle cx={C} cy={C} r={guide.ring} fill="none" stroke="#2563eb" strokeWidth="0.3" strokeDasharray="1.2 1" />}
          {guide.vx !== undefined && <line x1={guide.vx} y1="0" x2={guide.vx} y2={S.h} stroke="#ef4444" strokeWidth={1.2 / k} />}
          {guide.hy !== undefined && <line x1="0" y1={guide.hy} x2={S.w} y2={guide.hy} stroke="#ef4444" strokeWidth={1.2 / k} />}
        </svg>
      )}
      {SB && selL?.ulock && (
        <div className="pointer-events-none absolute z-30 border-2 border-dashed border-[#a1a1aa]" style={{ left: (SB.x - SB.w / 2) * k, top: (SB.y - SB.h / 2) * k, width: SB.w * k, height: SB.h * k, transform: `rotate(${SB.rot}deg)` }}>
          <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-white text-[#52525b] shadow"><Lock size={11} /></span>
        </div>
      )}
      {SB && !selL?.ulock && (
        <div className="pointer-events-none absolute z-30 border-2 border-[#2563eb]"
          style={{ left: (SB.x - SB.w / 2) * k, top: (SB.y - SB.h / 2) * k, width: SB.w * k, height: SB.h * k, transform: `rotate(${SB.rot}deg)` }}>
          {([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([hx, hy], i) => (
            <span key={i} onPointerDown={(e) => startHandle(e, "scale", hx, hy)} className={cx("pointer-events-auto absolute touch-none before:absolute before:-inset-3 before:content-[''] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-2 border-[#2563eb] bg-white", hx === hy ? "cursor-nwse-resize" : "cursor-nesw-resize")} style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%` }} />
          ))}
          {edgeHandles && ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).map(([hx, hy], i) => (
            <span key={`e${i}`} onPointerDown={(e) => (freePhoto ? startCropEdge(e, hx, hy) : startHandle(e, "scale", hx, hy))} title={freePhoto ? "Kéo để cắt ảnh theo cạnh này" : "Kéo để kéo giãn (Shift: giữ tỉ lệ · Alt: từ tâm)"}
              className={cx("pointer-events-auto absolute touch-none before:absolute before:-inset-3 before:content-[''] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2563eb] bg-white", hx ? "h-5 w-2 cursor-ew-resize" : "h-2 w-5 cursor-ns-resize")} style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%` }} />
          ))}
          <span onPointerDown={(e) => startHandle(e, "rotate")} title="Kéo để xoay" className="pointer-events-auto absolute touch-none before:absolute before:-inset-3 before:content-[''] left-1/2 h-3.5 w-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-[#2563eb] bg-white"
            style={swapBar ? { top: -31 } : { top: "calc(100% + 17px)" }} />
          {sideHandles && ([-1, 1] as const).map((side) => (
            <span key={side} onPointerDown={(e) => startWidth(e, side)} title="Kéo để đổi độ rộng (chữ tự xuống dòng)"
              className="pointer-events-auto absolute touch-none before:absolute before:-inset-3 before:content-[''] top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[#2563eb] bg-white" style={{ left: side < 0 ? "0%" : "100%" }} />
          ))}
        </div>
      )}
      {p.bgEdit && <><div className="pointer-events-none absolute inset-0 z-10 outline outline-2 -outline-offset-2 outline-[var(--c-primary)]" />{p.bgBar}</>}
      {p.cropLayer != null && L[p.cropLayer]?.k === "sticker" && (() => {
        const l = L[p.cropLayer] as Extract<Layer, { k: "sticker" }>, img = l.asset ? p.render.assets?.[l.asset]?.img : undefined, b = layerBox(p.cropLayer);
        return img && b ? <CropOverlay key={p.cropLayer} l={l} img={img} box={b} k={k} onDone={(v) => { if (v) { p.begin(); const i = p.cropLayer!; p.setLayers((ls) => ls.map((x, j) => (j === i ? ({ ...x, ...v } as Layer) : x)), l); } p.onCrop?.(null); }} /> : null;
      })()}
      {editing !== null && (L[editing]?.k === "text" || L[editing]?.k === "wish") && p.textValue && p.onTextValue && (
        <InlineText key={editing} l={L[editing] as Extract<Layer, { k: "text" | "wish" }>} hit={textBoxes.current[editing]} k={k} value={p.textValue(editing)} selectAll={!!p.selectAllText}
          onChange={(v) => p.onTextValue!(editing, v)} onExit={() => p.onEditText?.(null)} />
      )}
      {SB && p.tools && !menu && p.cropLayer == null && (() => {
        // thanh nhỏ: phía TRÊN lớp (nút xoay ở dưới); sát mép trên thì xuống dưới lớp (nút xoay lên trên) — không bao giờ chồng nhau
        const TW = Math.min(width, toolW.current || 182);
        const top = swapBar ? Math.min(height - TBH, (SB.y + sbExt) * k + 10) : barAboveTop;
        const left = Math.min(Math.max(SB.x * k, TW / 2 + 2), Math.max(TW / 2 + 2, width - TW / 2 - 2));
        return (
          <div data-keep-sel ref={(el) => { if (el && el.offsetWidth !== toolW.current) { toolW.current = el.offsetWidth; requestAnimationFrame(() => setTick((x) => x + 1)); } }} className="absolute z-20 flex -translate-x-1/2 flex-nowrap gap-0.5 rounded-full border border-[#efeff1] bg-white p-0.5 shadow-[0_2px_10px_rgb(0_0_0/0.12)]"
            style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>{p.tools}</div>
        );
      })()}
      {menu && p.sel !== null && p.tools && (
        <div className="absolute z-20 flex flex-col rounded-[8px] border border-[#e5e5e7] bg-white p-1 shadow-lg" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>{p.tools}</div>
      )}
      {p.editLayer !== null && (
        <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[12px] text-[#52525b] shadow">
          <span className="px-1">Kéo để dịch ảnh</span>
          <button type="button" onClick={() => zoom(-0.1)} aria-label="Thu nhỏ" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Minus size={14} /></button>
          <button type="button" onClick={() => zoom(0.1)} aria-label="Phóng to" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Plus size={14} /></button>
          <button type="button" onClick={() => p.onEditLayer(null)} className="rounded-full bg-[var(--c-primary)] px-2.5 py-1 font-medium text-white">Xong</button>
        </div>
      )}
    </div>
  );
}
const top = (l: Layer) => l.k === "sticker" && !!l.user;

/** ô nhập nhiều dòng đè đúng lên lớp chữ đang sửa (khớp vị trí, góc xoay, độ rộng, font, cỡ, màu, căn lề, khoảng cách dòng) */
function InlineText({ l, hit, k, value, selectAll, onChange, onExit }: {
  l: Extract<Layer, { k: "text" | "wish" }>; hit?: LBox; k: number; value: string; selectAll: boolean; onChange: (v: string) => void; onExit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [h, setH] = useState(0);
  const fit = () => { const el = ref.current; if (!el) return; el.style.height = "0px"; const sh = el.scrollHeight; el.style.height = `${sh}px`; setH(sh); };
  useLayoutEffect(fit, [value, k]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (selectAll) el.select(); else el.setSelectionRange(el.value.length, el.value.length);
    // điện thoại: đợi bàn phím bật lên rồi cuộn để ô đang sửa không bị che
    const t = setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 350);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const isText = l.k === "text", cut = isText ? !!l.cutout : !!l.cutout;
  const arc = isText && !!l.arc;
  const W = isText ? (arc ? Math.max(40, hit?.w ?? 60) : (hit?.w ?? l.w)) : l.w * 0.84;
  const cx0 = arc ? hit?.x ?? l.x : l.x, cy0 = arc ? hit?.y ?? l.y : l.y, rot = arc ? 0 : l.rot;
  const size = isText ? l.size : Math.min(6, l.h / 4);
  const family = cut ? '"Be Vietnam Pro", sans-serif' : isText ? (l.family ? `"${l.family}", "Be Vietnam Pro", sans-serif` : FONTS[l.font]) : `"${l.family ?? WISH_FONT}", "Itim", sans-serif`;
  const style: React.CSSProperties = {
    position: "absolute", left: (cx0 - W / 2) * k, top: cy0 * k - h / 2, width: W * k, transform: `rotate(${rot}deg)`, transformOrigin: "50% 50%",
    fontFamily: family, fontSize: size * k, lineHeight: isText ? l.lh ?? 1.25 : 1.3, letterSpacing: isText && !cut ? `${(l.ls ?? 0) * k}px` : undefined,
    fontWeight: cut ? 600 : isText && (l.bold || (!l.family && l.font === "hand")) ? 700 : 400, fontStyle: isText && l.italic ? "italic" : "normal",
    textAlign: isText ? l.align ?? "center" : "center", color: cut ? "#3f3f46" : isText ? l.color : l.ink,
    background: cut || !isText ? "rgba(255,255,255,0.78)" : "transparent", padding: 0, margin: 0, border: 0, resize: "none", overflow: "hidden",
    outline: "1.5px dashed #2563eb", outlineOffset: 2, whiteSpace: "pre-wrap", overflowWrap: "break-word", caretColor: "#2563eb", zIndex: 30,
  };
  return (
    <textarea ref={ref} value={value} rows={1} spellCheck={false} aria-label="Sửa chữ" style={style}
      onChange={(e) => onChange(e.target.value)} onBlur={onExit} onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); onExit(); } }} />
  );
}

type Crop = { x: number; y: number; w: number; h: number };
/** Bấm đúp ảnh tự do: chỉnh vị trí ảnh BÊN TRONG vùng cắt (KHÔNG phá huỷ) — khung giữ nguyên, kéo để dịch ảnh, thanh trượt / cuộn chuột
    để phóng ảnh; phần ảnh ngoài khung hiện mờ. Bấm ra ngoài / Enter / "Xong" = xong · Esc / "Huỷ" = huỷ. (Cắt theo cạnh: kéo 4 nút cạnh khi chọn ảnh.) */
function CropOverlay({ l, img, box, k, onDone }: { l: Extract<Layer, { k: "sticker" }>; img: CanvasImageSource & { width: number; height: number }; box: LBox; k: number; onDone: (v: Partial<Extract<Layer, { k: "sticker" }>> | null) => void }) {
  const flip = (c: Crop): Crop => ({ x: l.fx ? 1 - c.x - c.w : c.x, y: l.fy ? 1 - c.y - c.h : c.y, w: c.w, h: c.h });
  const init = flip(l.crop ?? { x: 0, y: 0, w: 1, h: 1 });
  const [cr, setCr] = useState<Crop>(init);
  const iw = img.width, ih = img.height, W = box.w / cr.w, H = box.h / cr.h; // cỡ cả ảnh (mm) theo vùng cắt hiện tại
  const cv = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const sc = Math.min(1, 1600 / Math.max(iw, ih)); c.width = Math.round(iw * sc); c.height = Math.round(ih * sc);
    const x = c.getContext("2d")!; x.save(); x.translate(l.fx ? c.width : 0, l.fy ? c.height : 0); x.scale(l.fx ? -1 : 1, l.fy ? -1 : 1); x.drawImage(img, 0, 0, c.width, c.height); x.restore();
  }, [img, iw, ih, l.fx, l.fy]);
  const done = useCallback((ok: boolean) => {
    if (!ok) return onDone(null);
    const full = cr.x <= 0.001 && cr.y <= 0.001 && cr.w >= 0.999 && cr.h >= 0.999;
    onDone({ crop: full ? undefined : flip(cr) });
  }, [cr, onDone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") { e.preventDefault(); done(false); } };
    const out = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-crop-bar]")) done(true); };
    window.addEventListener("keydown", h, true); document.addEventListener("pointerdown", out, true);
    return () => { window.removeEventListener("keydown", h, true); document.removeEventListener("pointerdown", out, true); };
  }, [done]);
  const clamp = (c: Crop): Crop => { const w = Math.min(1, Math.max(0.03, c.w)), h = Math.min(1, Math.max(0.03, c.h)); return { w, h, x: Math.min(1 - w, Math.max(0, c.x)), y: Math.min(1 - h, Math.max(0, c.y)) }; };
  const drag = useRef<{ x: number; y: number; c0: Crop } | null>(null);
  const loc = (e: { clientX: number; clientY: number }) => { const a = (-box.rot * Math.PI) / 180; return { x: (e.clientX * Math.cos(a) - e.clientY * Math.sin(a)) / k, y: (e.clientX * Math.sin(a) + e.clientY * Math.cos(a)) / k }; };
  const zoomBy = (f: number) => setCr((c) => { // phóng ảnh trong khung (khung giữ nguyên, vùng cắt thu / nở quanh tâm)
    let w = c.w / f, h = c.h / f; const m = Math.max(w, h); if (m > 1) { w /= m; h /= m; } // giữ tỉ lệ khung, không vượt ra ngoài ảnh gốc
    return clamp({ x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h });
  });
  const zoom = 1 / Math.max(cr.w, cr.h);
  // khung (cố định) + cả ảnh phía sau theo toạ độ của khung
  const imgLeft = -cr.x * W * k, imgTop = -cr.y * H * k;
  return (
    <>
      <div ref={wrap} className="absolute z-40 touch-none select-none" style={{ left: (box.x - box.w / 2) * k, top: (box.y - box.h / 2) * k, width: box.w * k, height: box.h * k, transform: `rotate(${box.rot}deg)` }}
        onWheel={(e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.06 : 1 / 1.06); }}
        onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); const q = loc(e); drag.current = { x: q.x, y: q.y, c0: cr }; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const q = loc(e); setCr(clamp({ ...d.c0, x: d.c0.x - (q.x - d.x) / W, y: d.c0.y - (q.y - d.y) / H })); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <canvas ref={cv} className="pointer-events-none absolute max-w-none opacity-45" style={{ left: imgLeft, top: imgTop, width: W * k, height: H * k }} />
        <div className="absolute inset-0 cursor-move overflow-hidden outline outline-2 outline-[var(--c-primary)]">
          <canvas ref={(el) => { if (el && cv.current && el.width !== cv.current.width) { el.width = cv.current.width; el.height = cv.current.height; el.getContext("2d")!.drawImage(cv.current, 0, 0); } }}
            className="pointer-events-none absolute max-w-none" style={{ left: imgLeft, top: imgTop, width: W * k, height: H * k }} />
        </div>
      </div>
      <div data-crop-bar className="absolute left-1/2 top-2 z-50 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[12px] text-[#52525b] shadow" onPointerDown={(e) => e.stopPropagation()}>
        <span className="hidden px-1 sm:inline">Kéo để dịch ảnh</span>
        <button type="button" onClick={() => zoomBy(1 / 1.15)} aria-label="Thu nhỏ ảnh" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Minus size={14} /></button>
        <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.15)} aria-label="Phóng to ảnh" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Plus size={14} /></button>
        <button type="button" onClick={() => done(false)} className="rounded-full border border-[#e5e5e7] px-2.5 py-1">Huỷ</button>
        <button type="button" onClick={() => done(true)} className="rounded-full bg-[var(--c-primary)] px-3 py-1 font-medium text-white">Xong</button>
      </div>
    </>
  );
}
