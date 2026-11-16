"use client";

/* Trình chỉnh Custom CD (react-konva), dùng chung cho khách và admin (tạo mẫu).
   - Dữ liệu nằm ở trang cha (theo TỪNG TRANG, toạ độ px bản in của trang). Component chỉ vẽ & báo thay đổi.
   - pages = 1 trang, hoặc 2 trang cạnh nhau (trải đôi). Phần tử thuộc trang nào thì nằm trong nhóm của trang đó.
   - Stage phủ cả vùng làm việc; nội dung được zoom/pan; khung chọn giữ kích thước cố định trên màn hình. */
import "@fontsource/itim/400.css";
import "@fontsource/pangolin/400.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/dancing-script/600.css";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Stage, Layer, Group, Rect, Ellipse, Circle, Ring, Line, Text, Image as KImage, Transformer } from "react-konva";
import type Konva from "konva";
import { mmToPx, type PrintSpec } from "@/lib/print";
import { stickers } from "@/lib/stickers";
import { setPngDpi } from "@/lib/png";
import { resolveSrc, storeLocalImage } from "@/lib/blobStore";
import { emptyDoc, uid, type El, type FrameFill, type FrameShape, type PageDoc, type TemplateDoc } from "@/lib/cdDoc";
import { useView } from "@/components/designer/smoothImage";
import { SpineContent, sideHasContent, zonePlacement, type Zone } from "@/components/designer/Spine";
import { ColorSelect } from "./ColorSelect";
import { Icon } from "./icons";

export type Half = "L" | "R" | "all";
export type CdDesignerHandle = {
  exportBlob: (half?: Half) => Promise<Blob>;
  regionCanvas: (x: number, w: number) => HTMLCanvasElement | null;
  snapshot: (size: number) => string | null; // ảnh thu nhỏ cả canvas (thumbnail mẫu / thiết kế)
};
export type PageInput = { doc: PageDoc; tpl: TemplateDoc | null };

export const ACCENT = "#ff5fa2";
export const FONTS = [
  { name: "Be Vietnam Pro", label: "Be Vietnam Pro" },
  { name: "Anton", label: "Anton" },
  { name: "Bricolage Grotesque", label: "Bricolage Grotesque" },
  { name: "Itim", label: "Itim" },
  { name: "Pangolin", label: "Pangolin" },
  { name: "Patrick Hand", label: "Patrick Hand" },
  { name: "Dancing Script", label: "Dancing Script" },
];
export const TEXT_COLORS = [
  { value: "#050505", name: "Đen" }, { value: "#ffffff", name: "Trắng" }, { value: "#4d4a46", name: "Xám đậm" },
  { value: "#3b1510", name: "Nâu" }, { value: "#c8e03c", name: "Xanh chanh" }, { value: "#7b68ee", name: "Tím" },
  { value: "#ff5fa2", name: "Hồng" }, { value: "#e0337e", name: "Hồng đậm" }, { value: "#ffcf5c", name: "Vàng" }, { value: "#3aa7ff", name: "Xanh dương" },
];
const BG_COLORS = ["#ffffff", "#f7f0e6", "#141414", "#c8e03c", "#f1f8c8", "#7b68ee", "#e9e5ff", "#ff5fa2", "#ffe3ef", "#ffcf5c", "#a9c6e8"];
export const PX_UNIT = 300 / 96; // cỡ chữ "px" theo kích thước in thật (96 px = 1 inch)
export const SIZE_PRESETS = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96];
const ZOOM_MIN = 0.25, ZOOM_MAX = 4;
const FRAME_FILL = "#e9e6e1";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const nodeId = (page: number, id: string) => `n${page}_${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

// Ảnh từ src lưu trữ (idb:/sb:/URL thường)
function useSrcImage(src?: string | null) {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    let alive = true;
    if (!src) { setImg(undefined); return; }
    resolveSrc(src).then((url) => {
      if (!alive || !url) return;
      const i = new window.Image();
      if (!url.startsWith("blob:") && !url.startsWith("data:")) i.crossOrigin = "anonymous";
      i.onload = () => alive && setImg(i);
      i.src = url;
    });
    return () => { alive = false; };
  }, [src]);
  return img;
}
async function sizeOf(src: string) {
  const url = await resolveSrc(src);
  return new Promise<{ w: number; h: number }>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = rej;
    i.src = url ?? src;
  });
}
const frameSize = (e: El) => ({ w: (e.width ?? 100) * e.scaleX, h: (e.height ?? 100) * e.scaleY });
function frameClip(ctx: Konva.Context, shape: FrameShape | undefined, w: number, h: number) {
  if (shape === "circle") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (shape === "rounded") {
    const r = Math.min(w, h) * 0.12;
    ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath();
  } else ctx.rect(0, 0, w, h);
}
function cover(nw: number, nh: number, w: number, h: number, zoom = 1) {
  const k = Math.max(w / nw, h / nh) * zoom;
  return { dw: nw * k, dh: nh * k };
}
function fillFor(src: string, nw: number, nh: number, w: number, h: number): FrameFill {
  const { dw, dh } = cover(nw, nh, w, h);
  return { src, nw, nh, zoom: 1, ox: (w - dw) / 2, oy: (h - dh) / 2 };
}
function zoomFill(f: FrameFill, w: number, h: number, z: number): FrameFill {
  const zz = clamp(z, 1, 5);
  const o = cover(f.nw, f.nh, w, h, f.zoom), n = cover(f.nw, f.nh, w, h, zz);
  const ox = w / 2 - ((w / 2 - f.ox) * n.dw) / o.dw, oy = h / 2 - ((h / 2 - f.oy) * n.dh) / o.dh;
  return { ...f, zoom: zz, ox: clamp(ox, w - n.dw, 0), oy: clamp(oy, h - n.dh, 0) };
}

// ---------- Phần tử: ảnh / sticker / chữ / khung (mẫu) ----------
type ElProps = {
  el: El; page: number; s: number; fontTick: number; text?: string;
  editable: boolean; selectable: boolean; templateMode: boolean;
  onSelect: () => void; onChange: (p: Partial<El>) => void; onFrameClick?: () => void;
};
function ElNode({ el, page, s, fontTick, text, editable, selectable, templateMode, onSelect, onChange, onFrameClick }: ElProps) {
  const img = useSrcImage(el.kind === "image" || el.kind === "sticker" ? el.src : null);
  const view = useView(img, Math.max(el.width ?? 0, el.height ?? 0) * Math.max(el.scaleX, el.scaleY) * s);
  const common = {
    id: nodeId(page, el.id), x: el.x, y: el.y, rotation: el.rotation, scaleX: el.scaleX, scaleY: el.scaleY,
    draggable: editable, listening: selectable,
    onMouseDown: onSelect, onTouchStart: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      const p: Partial<El> = { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() };
      if (el.kind === "text") p.width = (n as Konva.Text).width();
      if (el.kind === "frame") { // khung: đưa tỉ lệ vào kích thước
        const nn = n as Konva.Node; const fw = nn.getAttr("fw") as number, fh = nn.getAttr("fh") as number;
        Object.assign(p, { width: fw * n.scaleX(), height: fh * n.scaleY(), scaleX: 1, scaleY: 1 });
        n.scaleX(1); n.scaleY(1);
      }
      onChange(p);
    },
  };
  if (el.kind === "text") {
    return (
      <Text key={`${el.id}-${fontTick}-${el.fontFamily}`} {...common} text={text ?? el.text} fontFamily={el.fontFamily} fontSize={el.fontSize}
        fill={el.fill} align={el.align ?? "left"} lineHeight={el.lineHeight ?? 1.2} width={el.width} wrap={el.width ? "word" : "none"} />
    );
  }
  if (el.kind === "frame") {
    // chỉ hiện trong chế độ tạo mẫu (khách: khung trống vẽ ở lớp hướng dẫn, ảnh khách vẽ riêng)
    if (!templateMode) return null;
    const { w, h } = frameSize(el);
    const shapeProps = { fill: FRAME_FILL, stroke: "#bdb8b0", strokeWidth: 1 / s };
    return (
      <Group {...common} fw={w} fh={h} onDblClick={onFrameClick}>
        {el.shape === "circle" ? <Ellipse x={w / 2} y={h / 2} radiusX={w / 2} radiusY={h / 2} {...shapeProps} />
          : <Rect width={w} height={h} cornerRadius={el.shape === "rounded" ? Math.min(w, h) * 0.12 : 0} {...shapeProps} />}
        <Text text="+" width={w} height={h} align="center" verticalAlign="middle" fontSize={Math.min(w, h) * 0.3} fill="#8a857e" listening={false} />
      </Group>
    );
  }
  return img && view ? <KImage {...common} image={view} fullImage={img} width={el.width} height={el.height} /> : null;
}

// Ảnh khách trong khung của mẫu (cắt theo hình khung). Bấm đúp → kéo/zoom ảnh trong khung.
function FrameFillNode({ el, fill, s, adjusting, panMode, onSelect, onAdjust, onChange }: {
  el: El; fill: FrameFill; s: number; adjusting: boolean; panMode: boolean;
  onSelect: () => void; onAdjust: () => void; onChange: (f: FrameFill) => void;
}) {
  const img = useSrcImage(fill.src);
  const { w, h } = frameSize(el);
  const { dw, dh } = cover(fill.nw, fill.nh, w, h, fill.zoom);
  const view = useView(img, Math.max(dw, dh) * s);
  return (
    <Group x={el.x} y={el.y} rotation={el.rotation} clipFunc={(ctx) => frameClip(ctx, el.shape, w, h)}>
      {img && view && (
        <KImage image={view} fullImage={img} x={fill.ox} y={fill.oy} width={dw} height={dh} draggable={adjusting && !panMode}
          onMouseDown={onSelect} onTouchStart={onSelect} onDblClick={onAdjust} onDblTap={onAdjust}
          onDragMove={(e) => { const n = e.target; n.x(clamp(n.x(), w - dw, 0)); n.y(clamp(n.y(), h - dh, 0)); }}
          onDragEnd={(e) => onChange({ ...fill, ox: e.target.x(), oy: e.target.y() })}
          onWheel={(e) => { if (!adjusting || e.evt.ctrlKey) return; e.evt.preventDefault(); e.cancelBubble = true; onChange(zoomFill(fill, w, h, fill.zoom * (e.evt.deltaY < 0 ? 1.06 : 1 / 1.06))); }} />
      )}
    </Group>
  );
}

// half: ảnh nền của cả cặp trải đôi → phủ kín 2 trang, trang này chỉ hiện nửa của nó
function BgImageNode({ src, x, W, H, s, half }: { src: string; x: number; W: number; H: number; s: number; half?: "L" | "R" }) {
  const img = useSrcImage(src);
  const CW = half ? W * 2 : W;
  const view = useView(img, Math.max(CW, H) * s);
  if (!img || !view) return null;
  const k = Math.max(CW / img.naturalWidth, H / img.naturalHeight); // phủ kín (tính cả vùng tràn viền)
  return <KImage name="bg" listening={false} image={view} fullImage={img} width={img.naturalWidth * k} height={img.naturalHeight * k}
    x={x - (half === "R" ? W : 0) + (CW - img.naturalWidth * k) / 2} y={(H - img.naturalHeight * k) / 2} />;
}

function Guides({ spec, W, H, s }: { spec: PrintSpec; W: number; H: number; s: number }) {
  const px = (mm: number) => (mm / spec.w) * W;
  const cut = px(spec.cut), safe = px(spec.safe);
  const thin = 1 / s, band = "rgba(255,95,162,0.3)";
  if (spec.shape === "disc") {
    const r = W / 2;
    return (
      <Group listening={false}>
        <Ring x={r} y={r} innerRadius={r - cut} outerRadius={r} fill={band} />
        <Circle x={r} y={r} radius={px(spec.hub! / 2)} fill={band} />
        <Circle x={r} y={r} radius={px(spec.hole! / 2)} stroke="#141414" strokeWidth={thin} />
        <Circle x={r} y={r} radius={r} stroke="#141414" strokeWidth={thin} />
        <Circle x={r} y={r} radius={r - safe} stroke={ACCENT} strokeWidth={thin} dash={[6 / s, 4 / s]} />
        <Circle x={r} y={r} radius={px(spec.hub! / 2) + px(2)} stroke={ACCENT} strokeWidth={thin} dash={[6 / s, 4 / s]} />
      </Group>
    );
  }
  return (
    <Group listening={false}>
      <Rect width={W} height={cut} fill={band} />
      <Rect y={H - cut} width={W} height={cut} fill={band} />
      <Rect y={cut} width={cut} height={H - cut * 2} fill={band} />
      <Rect x={W - cut} y={cut} width={cut} height={H - cut * 2} fill={band} />
      <Rect x={safe} y={safe} width={W - safe * 2} height={H - safe * 2} stroke={ACCENT} strokeWidth={thin} dash={[6 / s, 4 / s]} />
    </Group>
  );
}

type Sel = { page: number; id: string; type: "el" | "frame" | "tplText" } | null;

// ================================================================
export function CdDesigner({ ref, spec, mode = "customer", pages, onChange, view = "all", viewport, active, interactive = true,
  toolbarTarget, caption, guides, zones, onZoneClick, tray, onSnapshot, uploadImage, spreadDoc, onSpreadChange }: {
  ref?: React.Ref<CdDesignerHandle>;
  spec: PrintSpec;
  mode?: "customer" | "template";
  pages: PageInput[]; // 1 trang hoặc 2 trang (trải đôi)
  onChange: (page: number, doc: PageDoc) => void;
  view?: Half;
  viewport: { w: number; h: number };
  active: boolean;
  interactive?: boolean; // false = bản ẩn chỉ để xuất file / ảnh thu nhỏ
  toolbarTarget?: HTMLElement | null;
  caption?: string;
  guides: boolean;
  zones?: Zone[];
  onZoneClick?: (id: string) => void;
  tray?: { cx: number; cy: number; r: number; hole: number };
  onSnapshot?: (half: Half, dataUrl: string) => void;
  uploadImage?: (file: File) => Promise<string>; // mặc định: lưu kho cục bộ (idb:)
  // Trải đôi: artwork của cả cặp trang (1 vùng liền, toạ độ trên 2 trang) — chỉ cắt ở mép ngoài
  spreadDoc?: PageDoc;
  onSpreadChange?: (d: PageDoc) => void;
}) {
  const W1 = mmToPx(spec.w), H = mmToPx(spec.h);
  const spread = pages.length === 2;
  const W = spread ? W1 * 2 : W1;
  const isDisc = spec.shape === "disc";
  const templateMode = mode === "template";
  const upload = uploadImage ?? ((f: File) => storeLocalImage(f));

  const stageRef = useRef<Konva.Stage>(null);
  const guidesRef = useRef<Konva.Layer>(null);
  const paperRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const freeInput = useRef<HTMLInputElement>(null);
  const frameInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const pendingFrame = useRef<{ page: number; id: string } | null>(null);

  const [sel, setSel] = useState<Sel>(null);
  const [adjust, setAdjust] = useState<{ page: number; id: string } | null>(null);
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showFrames, setShowFrames] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const snapRef = useRef(onSnapshot);
  snapRef.current = onSnapshot;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // trang đang thao tác (spread 1 trang → trang được xem)
  const spreadRef = useRef(spreadDoc);
  spreadRef.current = spreadDoc;
  // -1 = doc của cả cặp trải đôi
  const focusPage = spreadDoc ? -1 : spread ? (view === "R" ? 1 : 0) : 0;
  const upd = useCallback((i: number, fn: (d: PageDoc) => PageDoc) => {
    if (i === -1) onSpreadChange?.(fn(spreadRef.current ?? emptyDoc()));
    else onChange(i, fn(pagesRef.current[i].doc));
  }, [onChange, onSpreadChange]);

  // ---------- Zoom & pan ----------
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [panMode, setPanMode] = useState(false);
  const regionX = view === "R" ? W1 : 0;
  const regionW = view === "all" ? W : W1;
  const reserveB = 44;
  const fit = Math.max(0.01, Math.min((viewport.w - 48) / regionW, (viewport.h - 32 - reserveB) / H));
  const s = fit * zoom;
  const centerPos = (sc: number) => ({ x: viewport.w / 2 - (regionX + regionW / 2) * sc, y: (viewport.h - reserveB) / 2 - (H / 2) * sc + 8 });
  const p = pos ?? centerPos(s);
  const fitScreen = useCallback(() => { setZoom(1); setPos(null); }, []);
  useEffect(() => { if (active) fitScreen(); }, [active, view, fitScreen]);
  useEffect(() => { setSel(null); setAdjust(null); }, [view, pages.length]);

  function zoomAt(nz: number, at?: { x: number; y: number }) {
    const z = clamp(nz, ZOOM_MIN, ZOOM_MAX);
    const pt = at ?? { x: viewport.w / 2, y: (viewport.h - reserveB) / 2 };
    const ns = fit * z;
    const cx = (pt.x - p.x) / s, cy = (pt.y - p.y) / s;
    setZoom(z);
    setPos({ x: pt.x - cx * ns, y: pt.y - cy * ns });
  }
  useEffect(() => {
    if (!active || !interactive) return;
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !isField(e.target)) { e.preventDefault(); setPanMode(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setPanMode(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [active, interactive]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !interactive) return;
    let start: { x: number; y: number; px: number; py: number } | null = null;
    const pd = (e: PointerEvent) => {
      if (!(panMode || e.button === 1)) return;
      e.preventDefault();
      const cur = pos ?? centerPos(s);
      start = { x: e.clientX, y: e.clientY, px: cur.x, py: cur.y };
      el.setPointerCapture(e.pointerId);
    };
    const pm = (e: PointerEvent) => { if (start) setPos({ x: start.px + e.clientX - start.x, y: start.py + e.clientY - start.y }); };
    const pu = () => { start = null; };
    el.addEventListener("pointerdown", pd, true);
    el.addEventListener("pointermove", pm);
    el.addEventListener("pointerup", pu);
    el.addEventListener("pointercancel", pu);
    return () => { el.removeEventListener("pointerdown", pd, true); el.removeEventListener("pointermove", pm); el.removeEventListener("pointerup", pu); el.removeEventListener("pointercancel", pu); };
  });
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!interactive) return;
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) zoomAt(zoom * Math.exp(-e.evt.deltaY * 0.0025), stageRef.current?.getPointerPosition() ?? undefined);
    else setPos({ x: p.x - e.evt.deltaX, y: p.y - e.evt.deltaY });
  };

  useEffect(() => { document.fonts?.ready.then(() => setFontTick((t) => t + 1)); }, []);

  // ---------- Phần tử đang chọn ----------
  // trong chế độ mẫu: phần tử mẫu = doc.els. Chế độ khách: phần tử của khách = doc.els, của mẫu = tpl.els
  const selDoc = sel ? (sel.page === -1 ? spreadDoc : pages[sel.page]?.doc) : null;
  const selEl: El | undefined = sel && selDoc
    ? (sel.type === "el" ? selDoc.els.find((e) => e.id === sel.id) : pages[sel.page].tpl?.els.find((e) => e.id === sel.id))
    : undefined;
  const isText = selEl?.kind === "text";
  const updEl = (page: number, id: string, pp: Partial<El>) => upd(page, (d) => ({ ...d, els: d.els.map((e) => (e.id === id ? { ...e, ...pp } : e)) }));

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = sel && sel.type === "el" ? stageRef.current?.findOne(`#${nodeId(sel.page, sel.id)}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [sel, pages, fontTick]);

  function removeSelected() {
    if (!sel) return;
    if (sel.type === "el") upd(sel.page, (d) => ({ ...d, els: d.els.filter((e) => e.id !== sel.id) }));
    if (sel.type === "frame") upd(sel.page, (d) => { const f = { ...d.fills }; delete f[sel.id]; return { ...d, fills: f }; });
    if (sel.type === "tplText") upd(sel.page, (d) => { const t = { ...d.texts }; delete t[sel.id]; return { ...d, texts: t }; });
    setSel(null); setAdjust(null);
  }
  useEffect(() => {
    if (!active || !interactive) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel && sel.type !== "tplText") { e.preventDefault(); removeSelected(); }
      if (e.key === "Escape") setAdjust(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function moveLayer(dir: 1 | -1) {
    if (!sel || sel.type !== "el") return;
    upd(sel.page, (d) => {
      const i = d.els.findIndex((e) => e.id === sel.id);
      const j = clamp(i + dir, 0, d.els.length - 1);
      const els = [...d.els];
      const [x] = els.splice(i, 1);
      els.splice(j, 0, x);
      return { ...d, els };
    });
  }

  // ---------- Thêm ----------
  // vị trí góc trên-trái để phần tử (w×h) nằm giữa: trải đôi → giữa vùng đang nhìn; 1 trang → giữa trang
  const placeAt = (w: number, h: number) => {
    if (focusPage !== -1) return { x: (W1 - w) / 2, y: (H - h) / 2 };
    const cx = clamp((viewport.w / 2 - p.x) / s, 0, W), cy = clamp(((viewport.h - reserveB) / 2 - p.y) / s, 0, H);
    return { x: cx - w / 2, y: cy - h / 2 };
  };
  async function addImage(src: string, kind: "image" | "sticker", ratio: number) {
    try {
      const { w, h } = await sizeOf(src);
      const k = (Math.min(W1, H) * ratio) / Math.max(w, h);
      const el: El = { id: uid(), kind, src, nw: w, nh: h, width: w * k, height: h * k, ...placeAt(w * k, h * k), rotation: 0, scaleX: 1, scaleY: 1,
        ...(templateMode ? { layer: "above" as const } : {}) };
      upd(focusPage, (d) => ({ ...d, els: [...d.els, el] }));
      setSel({ page: focusPage, id: el.id, type: "el" });
      setErr("");
    } catch { setErr("Không đọc được ảnh này."); }
  }
  async function onFreeFile(f: File) {
    setBusy(true);
    try { await addImage(await upload(f), "image", 0.5); } catch (e) { setErr(e instanceof Error ? e.message : "Tải ảnh thất bại"); }
    setBusy(false);
  }
  function addText() {
    const el: El = { id: uid(), kind: "text", text: "Chữ của bạn", fontFamily: "Be Vietnam Pro", fontSize: Math.round(24 * PX_UNIT), fill: "#050505",
      align: "left", lineHeight: 1.2, ...(focusPage === -1 ? placeAt(W1 * 0.5, 24 * PX_UNIT) : { x: W1 * 0.12, y: H * 0.45 }), rotation: 0, scaleX: 1, scaleY: 1 };
    upd(focusPage, (d) => ({ ...d, els: [...d.els, el] }));
    setSel({ page: focusPage, id: el.id, type: "el" });
  }
  function addFrame(shape: FrameShape) {
    const sz = Math.min(W1, H) * 0.4;
    const w = shape === "rect" || shape === "rounded" ? sz * 1.3 : sz;
    const el: El = { id: uid(), kind: "frame", shape, x: (W1 - w) / 2, y: (H - sz) / 2, width: w, height: sz, rotation: 0, scaleX: 1, scaleY: 1 };
    upd(focusPage, (d) => ({ ...d, els: [...d.els, el] }));
    setSel({ page: focusPage, id: el.id, type: "el" });
    setShowFrames(false);
  }
  async function onBgFile(f: File) {
    setBusy(true);
    try { const src = await upload(f); upd(focusPage, (d) => ({ ...d, bgImage: { src } })); } catch (e) { setErr(e instanceof Error ? e.message : "Tải ảnh thất bại"); }
    setBusy(false);
  }
  async function onFrameFile(f: File) {
    const t = pendingFrame.current;
    if (!t) return;
    const fr = pages[t.page].tpl?.els.find((e) => e.id === t.id);
    if (!fr) return;
    setBusy(true);
    try {
      const src = await upload(f);
      const { w, h } = await sizeOf(src);
      const fs = frameSize(fr);
      upd(t.page, (d) => ({ ...d, fills: { ...d.fills, [t.id]: fillFor(src, w, h, fs.w, fs.h) } }));
      setSel({ page: t.page, id: t.id, type: "frame" });
    } catch { setErr("Không đọc được ảnh này."); }
    setBusy(false);
  }
  const pickFrame = (page: number, id: string) => { pendingFrame.current = { page, id }; frameInput.current?.click(); };

  // Ảnh: vừa khung / phủ kín trang
  function fitImage(m: "contain" | "cover") {
    if (!sel || sel.type !== "el" || !selEl || selEl.kind === "text" || selEl.kind === "frame") return;
    const ratio = selEl.nw && selEl.nh ? selEl.nw / selEl.nh : (selEl.width ?? 1) / (selEl.height ?? 1);
    const RW = sel.page === -1 ? W : W1; // trải đôi: vừa / phủ kín cả cặp trang
    const h = m === "contain" ? Math.min(RW / ratio, H) : Math.max(RW / ratio, H), w = h * ratio;
    updEl(sel.page, selEl.id, { width: w, height: h, scaleX: 1, scaleY: 1, rotation: 0, x: (RW - w) / 2, y: (H - h) / 2 });
  }

  // ---------- Xuất / ảnh vùng ----------
  function renderRegion(rx: number, rw: number, ratio: number, opts?: { hideZones?: boolean; withFrames?: boolean }) {
    const stage = stageRef.current;
    if (!stage) return null;
    const tr = trRef.current;
    tr?.visible(false);
    guidesRef.current?.visible(false);
    paperRef.current?.visible(false);
    const hidden: Konva.Node[] = [];
    if (opts?.hideZones) stage.find(".zone-content").forEach((n) => { if (n.visible()) { n.visible(false); hidden.push(n); } });
    const swapped: [Konva.Image, CanvasImageSource][] = [];
    if (ratio >= 0.5 / s) stage.find("Image").forEach((n) => {
      const k = n as Konva.Image;
      const full = k.getAttr("fullImage") as HTMLImageElement | undefined;
      if (full && full !== k.image()) { swapped.push([k, k.image()!]); k.image(full); }
    });
    try {
      return stage.toCanvas({ x: p.x + rx * s, y: p.y, width: rw * s, height: H * s, pixelRatio: ratio });
    } finally {
      swapped.forEach(([k, v]) => k.image(v));
      hidden.forEach((n) => n.visible(true));
      tr?.visible(true);
      guidesRef.current?.visible(true);
      paperRef.current?.visible(true);
      stage.batchDraw();
    }
  }
  const halfRange = (half: Half = "all") => (half === "R" ? { x: W1, w: W1 } : half === "L" ? { x: 0, w: W1 } : { x: 0, w: W });
  useImperativeHandle(ref, () => ({
    exportBlob: async (half: Half = "all") => {
      const r = halfRange(spread ? half : "all");
      setSel(null);
      try {
        const canvas = renderRegion(r.x, r.w, 1 / s);
        if (!canvas) throw new Error("Không xuất được ảnh");
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
        if (!blob) throw new Error("Không xuất được ảnh");
        return await setPngDpi(blob, 300);
      } catch (e) {
        throw new Error(e instanceof Error && e.name === "SecurityError" ? "Ảnh mẫu chặn xuất file (CORS). Báo tiệm giúp nhé!" : e instanceof Error ? e.message : "Lỗi xuất ảnh");
      }
    },
    regionCanvas: (x: number, w: number) => { try { return renderRegion(x, w, 1 / s, { hideZones: true }); } catch { return null; } },
    snapshot: (size: number) => { try { return renderRegion(0, W, size / (W * s))?.toDataURL("image/png") ?? null; } catch { return null; } },
  }));
  useEffect(() => {
    if (!snapRef.current || viewport.w === 0) return;
    const t = setTimeout(() => {
      try {
        for (const half of (spread ? ["L", "R"] : ["all"]) as Half[]) {
          const r = halfRange(half);
          const c = renderRegion(r.x, r.w, 110 / (r.w * s));
          if (c) snapRef.current?.(half, c.toDataURL("image/png"));
        }
      } catch { /* CORS: bỏ qua ảnh thu nhỏ */ }
    }, 500);
    return () => clearTimeout(t);
  }, [pages, zones, fontTick, viewport.w, viewport.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const deselect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === "bg") { setSel(null); setAdjust(null); }
  };
  const discClip = (ctx: Konva.Context) => {
    const r = W / 2, hole = (spec.hole! / 2 / spec.w) * W;
    ctx.arc(r, r, r, 0, Math.PI * 2, false);
    ctx.moveTo(r + hole, r);
    ctx.arc(r, r, hole, 0, Math.PI * 2, true);
  };
  const setCursor = (c: string) => { const el = stageRef.current?.container(); if (el) el.style.cursor = c; };
  const onTextTransform = () => {
    const tr = trRef.current;
    const n = tr?.nodes()[0] as Konva.Text | undefined;
    if (!tr || !n || n.getClassName() !== "Text") return;
    const a = tr.getActiveAnchor();
    if (a === "middle-left" || a === "middle-right") n.setAttrs({ width: Math.max(30, n.width() * n.scaleX()), scaleX: n.scaleY() });
  };

  // ---------- Vẽ 1 trang ----------
  // part: "all" = cả trang; trải đôi chia làm "base" (nền riêng của trang/mẫu) và "tpl" (nội dung mẫu)
  const renderPage = (pg: PageInput, i: number, part: "all" | "base" | "tpl" = "all") => {
    const d = pg.doc;
    const tplEls = templateMode ? d.els : (pg.tpl?.els ?? []);
    const userEls = templateMode || spreadDoc ? [] : d.els;
    const bg = spreadDoc ? (d.bg ?? pg.tpl?.bg ?? null) : (d.bg ?? pg.tpl?.bg ?? "#ffffff");
    const bgImg = d.bgImage ?? (templateMode ? null : pg.tpl?.bgImage ?? null);
    const below = tplEls.filter((e) => (e.kind === "image" || e.kind === "sticker") && e.layer === "below");
    const frames = tplEls.filter((e) => e.kind === "frame");
    const rest = tplEls.filter((e) => !below.includes(e) && !frames.includes(e));
    const tplNode = (e: El) => (
      <ElNode key={e.id} el={e} page={i} s={s} fontTick={fontTick} text={!templateMode && e.kind === "text" ? d.texts[e.id] : undefined}
        templateMode={templateMode}
        editable={templateMode && interactive && !panMode}
        selectable={interactive && (templateMode || e.kind === "text")}
        onSelect={() => setSel({ page: i, id: e.id, type: templateMode ? "el" : "tplText" })}
        onChange={(pp) => updEl(i, e.id, pp)} />
    );
    // nội dung mẫu luôn nằm trong trang của nó
    const base = (
      <Group clipFunc={isDisc ? undefined : (ctx) => ctx.rect(0, 0, W1, H)}>
        {bg && <Rect name="bg" width={W1} height={H} fill={bg} preventDefault={false} />}
        {bgImg && <BgImageNode src={bgImg.src} x={0} W={W1} H={H} s={s} half={bgImg.half} />}
      </Group>
    );
    if (part === "base") return <Group key={`b${i}`} x={i * W1}>{base}</Group>;
    return (
      <Group key={`p${i}`} x={i * W1} clipFunc={isDisc ? undefined : (ctx) => ctx.rect(0, 0, W1, H)}>
        {part === "all" && base}
        {below.map(tplNode)}
        {!templateMode && frames.map((fr) => d.fills[fr.id] ? (
          <FrameFillNode key={fr.id} el={fr} fill={d.fills[fr.id]} s={s} panMode={panMode}
            adjusting={adjust?.page === i && adjust.id === fr.id}
            onSelect={() => setSel({ page: i, id: fr.id, type: "frame" })}
            onAdjust={() => { setSel({ page: i, id: fr.id, type: "frame" }); setAdjust({ page: i, id: fr.id }); }}
            onChange={(f) => upd(i, (dd) => ({ ...dd, fills: { ...dd.fills, [fr.id]: f } }))} />
        ) : null)}
        {templateMode && frames.map(tplNode)}
        {rest.map(tplNode)}
        {userEls.map((e) => (
          <ElNode key={e.id} el={e} page={i} s={s} fontTick={fontTick} templateMode={false}
            editable={interactive && !panMode} selectable={interactive}
            onSelect={() => setSel({ page: i, id: e.id, type: "el" })} onChange={(pp) => updEl(i, e.id, pp)} />
        ))}
      </Group>
    );
  };

  // ---------- Thanh công cụ ----------
  const fDoc = focusPage === -1 ? spreadDoc : pages[focusPage]?.doc;
  const curBg = fDoc?.bg ?? (focusPage === -1 ? null : pages[focusPage]?.tpl?.bg) ?? "#ffffff";
  const selFrame = sel?.type === "frame" ? pages[sel.page].tpl?.els.find((e) => e.id === sel.id) : undefined;
  const selFill = sel?.type === "frame" ? pages[sel.page].doc.fills[sel.id] : undefined;
  const sizeUnit = selEl?.fontSize ? Math.round((selEl.fontSize / PX_UNIT) * 10) / 10 : 24;
  const canStyleText = isText && sel?.type === "el";
  const toolbar = (
    <div className="divide-y divide-[#ecebe7]">
      <div className="flex flex-wrap gap-1.5 pb-3">
        <button className="tool-btn" disabled={busy} onClick={() => freeInput.current?.click()}><Icon name="image" /> {templateMode ? "Ảnh trang trí" : "Ảnh"}</button>
        {templateMode && (
          <div className="relative">
            <button className="tool-btn" aria-pressed={showFrames} onClick={() => setShowFrames(!showFrames)}><Icon name="frame" /> Khung ảnh</button>
            {showFrames && (
              <div className="absolute left-0 top-9 z-20 w-40 rounded-[10px] border border-[#dedad3] bg-white p-1 shadow-lg">
                {([["rect", "Chữ nhật"], ["square", "Vuông"], ["circle", "Tròn"], ["rounded", "Bo góc"]] as const).map(([k, l]) => (
                  <button key={k} className="block w-full rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-[#f4f2ee]" onClick={() => addFrame(k)}>{l}</button>
                ))}
              </div>
            )}
          </div>
        )}
        <button className="tool-btn" onClick={addText}><Icon name="text" /> Chữ</button>
        <button className="tool-btn" aria-pressed={showStickers} onClick={() => setShowStickers(!showStickers)}><Icon name="sticker" /> Sticker</button>
      </div>
      {showStickers && (
        <div className="grid grid-cols-7 gap-1 py-3">
          {stickers.map((st) => (
            <button key={st.id} className="rounded-[6px] p-0.5 hover:bg-[#f4f2ee]" onClick={() => addImage(st.src, "sticker", 0.25)} aria-label={`Sticker ${st.id}`} title="Thêm sticker">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={st.src} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}

      {(selEl || (sel?.type === "frame" && selFill)) && (
        <div className="space-y-2.5 py-3">
          <div className="flex items-center justify-between">
            <p className="tool-label">Thuộc tính · {sel?.type === "frame" ? "ảnh trong khung" : sel?.type === "tplText" ? "chữ của mẫu" : isText ? "chữ" : selEl?.kind === "frame" ? "khung ảnh" : selEl?.kind === "sticker" ? "sticker" : "ảnh"}</p>
            <div className="flex gap-1">
              {sel?.type === "el" && <>
                <button className="tool-btn tool-icon" title="Đưa lên trên" aria-label="Đưa lên trên" onClick={() => moveLayer(1)}><Icon name="up" /></button>
                <button className="tool-btn tool-icon" title="Đưa xuống dưới" aria-label="Đưa xuống dưới" onClick={() => moveLayer(-1)}><Icon name="down" /></button>
              </>}
              {sel?.type !== "tplText" && <button className="tool-btn tool-icon !text-[#d0303f]" title="Xoá" aria-label="Xoá" onClick={removeSelected}><Icon name="trash" /></button>}
            </div>
          </div>

          {sel?.type === "frame" && selFrame && selFill && (() => {
            const fs = frameSize(selFrame);
            const on = adjust?.page === sel.page && adjust.id === sel.id;
            return (
              <>
                <button className="tool-btn w-full" aria-pressed={on} onClick={() => setAdjust(on ? null : { page: sel.page, id: sel.id })}>
                  {on ? "Xong căn chỉnh" : "Căn chỉnh ảnh trong khung"}
                </button>
                <label className="flex items-center gap-2">
                  <span className="w-16 text-[12px] text-[#77726b]">Phóng to</span>
                  <input type="range" min={1} max={5} step={0.01} value={selFill.zoom} className="flex-1" style={{ accentColor: ACCENT }}
                    onChange={(e) => upd(sel.page, (d) => ({ ...d, fills: { ...d.fills, [sel.id]: zoomFill(d.fills[sel.id], fs.w, fs.h, Number(e.target.value)) } }))} />
                </label>
                <button className="tool-btn" onClick={() => pickFrame(sel.page, sel.id)}>Đổi ảnh</button>
                <p className="text-[11px] text-[#8a857e]">Bấm đúp vào ảnh để kéo căn chỉnh trong khung.</p>
              </>
            );
          })()}

          {sel?.type === "el" && selEl && (selEl.kind === "image" || selEl.kind === "sticker") && (
            <>
              <div className="flex gap-1.5">
                <button className="tool-btn flex-1" onClick={() => fitImage("contain")} title="Vừa trang theo cạnh nhỏ hơn, căn giữa">Vừa khung</button>
                <button className="tool-btn flex-1" onClick={() => fitImage("cover")} title="Phủ kín toàn trang">Phủ kín</button>
              </div>
              {templateMode && (
                <div className="flex gap-1.5">
                  <button className="tool-btn flex-1" aria-pressed={selEl.layer !== "below"} onClick={() => updEl(sel.page, selEl.id, { layer: "above" })}>Nằm trên ảnh khách</button>
                  <button className="tool-btn flex-1" aria-pressed={selEl.layer === "below"} onClick={() => updEl(sel.page, selEl.id, { layer: "below" })}>Nằm dưới ảnh khách</button>
                </div>
              )}
            </>
          )}

          {sel?.type === "el" && selEl?.kind === "frame" && (
            <div className="grid grid-cols-4 gap-1">
              {([["rect", "Chữ nhật"], ["square", "Vuông"], ["circle", "Tròn"], ["rounded", "Bo góc"]] as const).map(([k, l]) => (
                <button key={k} className="tool-btn !px-1 !text-[11px]" aria-pressed={selEl.shape === k}
                  onClick={() => { const fs = frameSize(selEl); const sq = k === "square" || k === "circle"; const m = Math.min(fs.w, fs.h);
                    updEl(sel.page, selEl.id, { shape: k, ...(sq ? { width: m, height: m, scaleX: 1, scaleY: 1 } : {}) }); }}>{l}</button>
              ))}
            </div>
          )}

          {sel?.type === "tplText" && selEl && (
            <>
              <textarea className="tool-input !h-auto w-full py-1.5" rows={2} value={pages[sel.page].doc.texts[sel.id] ?? selEl.text ?? ""}
                onChange={(e) => upd(sel.page, (d) => ({ ...d, texts: { ...d.texts, [sel.id]: e.target.value } }))} />
              <p className="text-[11px] text-[#8a857e]">Chữ của mẫu: chỉ sửa được nội dung.</p>
            </>
          )}

          {canStyleText && selEl && sel && (
            <>
              <textarea className="tool-input !h-auto w-full py-1.5" rows={2} value={selEl.text} onChange={(e) => updEl(sel.page, selEl.id, { text: e.target.value })} />
              <select className="tool-input w-full" value={selEl.fontFamily} style={{ fontFamily: selEl.fontFamily }}
                onChange={(e) => { const f = e.target.value; updEl(sel.page, selEl.id, { fontFamily: f }); document.fonts?.load(`40px "${f}"`).then(() => setFontTick((t) => t + 1)); }}>
                {FONTS.map((f) => <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>)}
              </select>
              <div className="flex gap-1.5">
                <div className="flex flex-1 items-center">
                  <input type="number" min={4} max={400} step={1} value={sizeUnit} aria-label="Cỡ chữ (px)" title="Cỡ chữ (px theo kích thước in)" className="tool-input w-full rounded-r-none"
                    onChange={(e) => { const v = Number(e.target.value); if (v > 0) updEl(sel.page, selEl.id, { fontSize: Math.round(v * PX_UNIT) }); }} />
                  <select aria-label="Chọn nhanh cỡ chữ" className="tool-input -ml-px w-9 rounded-l-none !px-1" value=""
                    onChange={(e) => { const v = Number(e.target.value); if (v) updEl(sel.page, selEl.id, { fontSize: Math.round(v * PX_UNIT) }); }}>
                    <option value="" disabled>▾</option>
                    {SIZE_PRESETS.map((n) => <option key={n} value={n}>{n} px</option>)}
                  </select>
                </div>
                <label className="flex w-[92px] items-center gap-1" title="Khoảng cách dòng">
                  <Icon name="lineHeight" />
                  <input type="number" min={0.5} max={3} step={0.1} value={selEl.lineHeight ?? 1.2} aria-label="Khoảng cách dòng" className="tool-input w-full"
                    onChange={(e) => updEl(sel.page, selEl.id, { lineHeight: Number(e.target.value) || 1.2 })} />
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <ColorSelect value={selEl.fill ?? "#050505"} colors={TEXT_COLORS} onChange={(c) => updEl(sel.page, selEl.id, { fill: c })} />
                <div className="flex">
                  {(["left", "center", "right"] as const).map((a, k) => (
                    <button key={a} title={{ left: "Canh trái", center: "Canh giữa", right: "Canh phải" }[a]} aria-label={a} aria-pressed={(selEl.align ?? "left") === a}
                      className={`tool-btn tool-icon ${k === 0 ? "rounded-r-none" : k === 2 ? "-ml-px rounded-l-none" : "-ml-px rounded-none"}`}
                      onClick={() => updEl(sel.page, selEl.id, { align: a, width: selEl.width ?? (stageRef.current?.findOne(`#${nodeId(sel.page, selEl.id)}`) as Konva.Text | undefined)?.width() })}>
                      <Icon name={a === "left" ? "alignL" : a === "center" ? "alignC" : "alignR"} />
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#8a857e]">Kéo nút cạnh trái/phải để đổi độ rộng khung chữ (tự xuống dòng).</p>
            </>
          )}
        </div>
      )}

      {/* Màu nền & ảnh nền */}
      <div className="pt-3">
        <p className="tool-label mb-2">Nền</p>
        <div className="flex flex-wrap items-center gap-1">
          {BG_COLORS.map((c) => (
            <button key={c} aria-label={`Nền ${c}`} title={c} aria-pressed={curBg.toLowerCase() === c} onClick={() => upd(focusPage, (d) => ({ ...d, bg: c }))} className="swatch" style={{ background: c }} />
          ))}
          <label className="swatch relative overflow-hidden bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu tuỳ chọn">
            <input type="color" value={curBg} onChange={(e) => upd(focusPage, (d) => ({ ...d, bg: e.target.value }))} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu nền tuỳ chọn" />
          </label>
          <button className="tool-btn !h-[22px] !px-2 !text-[12px]" disabled={busy} onClick={() => bgInput.current?.click()}>
            <Icon name="image" /> {fDoc?.bgImage ? "Đổi ảnh nền" : "Ảnh nền"}
          </button>
          {fDoc?.bgImage && (
            <button className="grid h-[22px] w-[22px] place-items-center rounded-[6px] border border-[#dedad3] text-[13px] leading-none hover:bg-[#f4f2ee]" title="Xoá ảnh nền" aria-label="Xoá ảnh nền"
              onClick={() => upd(focusPage, (d) => ({ ...d, bgImage: null }))}>×</button>
          )}
        </div>
      </div>
      {err && <p className="pt-3 text-[12px] text-[#d0303f]">{err}</p>}
    </div>
  );

  const stroke = 1 / s;
  return (
    <div ref={boxRef} className="relative select-none overflow-hidden" style={{ width: viewport.w, height: viewport.h, cursor: panMode ? "grab" : undefined }}>
      <Stage ref={stageRef} width={viewport.w} height={viewport.h} x={p.x} y={p.y} scaleX={s} scaleY={s}
        onMouseDown={deselect} onTouchStart={deselect} onWheel={onWheel} listening={interactive}>
        <Layer ref={paperRef} listening={false}>
          {isDisc
            ? <Circle x={W / 2} y={W / 2} radius={W / 2} fill="#ffffff" shadowColor="#000" shadowOpacity={0.18} shadowBlur={18 / s} shadowOffsetY={4 / s} />
            : <Rect width={W} height={H} fill="#ffffff" shadowColor="#000" shadowOpacity={0.18} shadowBlur={18 / s} shadowOffsetY={4 / s} />}
        </Layer>
        <Layer>
          <Group clipFunc={isDisc ? discClip : (ctx) => ctx.rect(0, 0, W, H)}>
            {spreadDoc ? (
              <>
                {/* Trải đôi: 1 vùng liền 2 trang — nền, ảnh nền, ảnh, chữ, sticker tràn qua gáy giữa, chỉ cắt ở mép ngoài */}
                <Rect name="bg" width={W} height={H} fill={spreadDoc.bg ?? "#ffffff"} preventDefault={false} />
                {pages.map((pg, i) => renderPage(pg, i, "base"))}
                {spreadDoc.bgImage && <BgImageNode src={spreadDoc.bgImage.src} x={0} W={W} H={H} s={s} />}
                {pages.map((pg, i) => renderPage(pg, i, "tpl"))}
                {spreadDoc.els.map((e) => (
                  <ElNode key={e.id} el={e} page={-1} s={s} fontTick={fontTick} templateMode={false}
                    editable={interactive && !panMode} selectable={interactive}
                    onSelect={() => setSel({ page: -1, id: e.id, type: "el" })} onChange={(pp) => updEl(-1, e.id, pp)} />
                ))}
              </>
            ) : pages.map((pg, i) => renderPage(pg, i))}
            {(zones ?? []).map((z) => z.side && (
              <Group key={z.id} name="zone-content" {...zonePlacement(z, H)} listening={false}>
                <SpineContent side={z.side} len={H} thick={z.w} />
              </Group>
            ))}
          </Group>
          <Transformer ref={trRef} rotateAnchorOffset={22} anchorSize={10} borderStroke={ACCENT} anchorStroke={ACCENT} anchorFill="#ffffff"
            anchorCornerRadius={2} ignoreStroke flipEnabled={false}
            keepRatio={!(selEl?.kind === "frame" && (selEl.shape === "rect" || selEl.shape === "rounded"))}
            enabledAnchors={isText || (selEl?.kind === "frame" && (selEl.shape === "rect" || selEl.shape === "rounded"))
              ? ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", ...(selEl?.kind === "frame" ? ["top-center", "bottom-center"] : [])]
              : ["top-left", "top-right", "bottom-left", "bottom-right"]}
            onTransform={onTextTransform} />
        </Layer>

        {/* Lớp hướng dẫn — KHÔNG có trong file xuất */}
        <Layer ref={guidesRef}>
          {guides && pages.map((_, i) => <Group key={i} x={i * W1}><Guides spec={spec} W={W1} H={H} s={s} /></Group>)}
          {spread && view === "all" && (
            <Group listening={false}>
              <Rect x={W1 - 40} width={80} height={H} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 80, y: 0 }}
                fillLinearGradientColorStops={[0, "rgba(0,0,0,0)", 0.5, "rgba(0,0,0,0.14)", 1, "rgba(0,0,0,0)"]} />
              <Line points={[W1, 0, W1, H]} stroke="#141414" strokeWidth={stroke} dash={[6 / s, 4 / s]} />
            </Group>
          )}
          {spread && view !== "all" && <Rect x={view === "R" ? -W1 * 4 : W1} y={-H * 4} width={W1 * 5} height={H * 9} fill="#ece1d0" />}
          {guides && tray && (
            <Group listening={false} opacity={0.55}>
              <Circle x={tray.cx} y={tray.cy} radius={tray.r} stroke="#7b68ee" strokeWidth={1.5 * stroke} fill="rgba(123,104,238,0.08)" />
              <Circle x={tray.cx} y={tray.cy} radius={tray.hole} stroke="#7b68ee" strokeWidth={stroke} />
              <Line points={[tray.cx - 10 / s, tray.cy, tray.cx + 10 / s, tray.cy]} stroke="#7b68ee" strokeWidth={stroke} />
              <Line points={[tray.cx, tray.cy - 10 / s, tray.cx, tray.cy + 10 / s]} stroke="#7b68ee" strokeWidth={stroke} />
            </Group>
          )}
          {(zones ?? []).map((z) => {
            const editable = !!z.side && guides && interactive;
            const hov = editable && hoverZone === z.id;
            const fs = Math.min(z.w * 0.5, 11 / s);
            const lines = [z.x, z.x + z.w].filter((x) => x > 0.5 && x < W - 0.5);
            return (
              <Group key={z.id} listening={editable}
                onMouseEnter={() => { setHoverZone(z.id); setCursor("pointer"); }}
                onMouseLeave={() => { setHoverZone(null); setCursor("default"); }}
                onClick={() => onZoneClick?.(z.id)} onTap={() => onZoneClick?.(z.id)}>
                <Rect x={z.x} y={0} width={z.w} height={H} fill={hov ? "rgba(255,95,162,0.35)" : "rgba(0,0,0,0)"} />
                {lines.map((lx) => <Line key={lx} points={[lx, 0, lx, H]} stroke="#141414" strokeWidth={stroke} dash={[6 / s, 4 / s]} listening={false} />)}
                {z.side && z.label && (
                  <Group {...zonePlacement(z, H)} listening={false}>
                    <Text text={hov ? "Bấm để sửa" : z.label} y={(z.w - fs) / 2} width={H} align={hov ? "center" : "left"}
                      padding={hov ? 0 : 8 / s} fontFamily="Be Vietnam Pro" fontStyle="bold" fontSize={fs} fill="#141414" opacity={hov ? 1 : 0.6} />
                  </Group>
                )}
              </Group>
            );
          })}
          {/* Khung ảnh trống của mẫu (phía khách): nền xám + dấu "+", bấm để tải ảnh */}
          {!templateMode && pages.map((pg, i) => (pg.tpl?.els ?? []).filter((e) => e.kind === "frame").map((fr) => {
            const filled = !!pg.doc.fills[fr.id];
            const selected = sel?.type === "frame" && sel.page === i && sel.id === fr.id;
            if (filled && !selected) return null;
            const { w, h } = frameSize(fr);
            const Shape = fr.shape === "circle" ? Ellipse : Rect;
            const sp = fr.shape === "circle" ? { x: w / 2, y: h / 2, radiusX: w / 2, radiusY: h / 2 } : { width: w, height: h, cornerRadius: fr.shape === "rounded" ? Math.min(w, h) * 0.12 : 0 };
            return (
              <Group key={`${i}-${fr.id}`} x={i * W1 + fr.x} y={fr.y} rotation={fr.rotation} listening={!filled && interactive && !panMode}
                onMouseDown={(e) => { if (e.evt.button === 0) pickFrame(i, fr.id); }} onTap={() => pickFrame(i, fr.id)}
                onMouseEnter={() => setCursor("pointer")} onMouseLeave={() => setCursor("default")}>
                <Shape {...sp} fill={filled ? undefined : FRAME_FILL} stroke={filled ? ACCENT : "#bdb8b0"} strokeWidth={(filled ? 2 : 1) * stroke} dash={filled ? [6 / s, 4 / s] : undefined} />
                {!filled && <Text text="+" width={w} height={h} align="center" verticalAlign="middle" fontSize={Math.min(w, h) * 0.3} fill="#8a857e" />}
              </Group>
            );
          }))}
        </Layer>
      </Stage>

      {interactive && <>
        {caption && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[12px] font-medium text-[#4d4a46]">{caption}</p>}
        <div className="absolute bottom-2 left-2 flex items-center gap-0.5 rounded-[8px] border border-[#dedad3] bg-white p-0.5 text-[12px] shadow-sm">
          <button className="grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[#f4f2ee]" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => zoomAt(zoom / 1.25)}>−</button>
          <span className="w-11 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[#f4f2ee]" title="Phóng to" aria-label="Phóng to" onClick={() => zoomAt(zoom * 1.25)}>+</button>
          <button className="h-7 rounded-[6px] px-2 hover:bg-[#f4f2ee]" title="Vừa màn hình" onClick={fitScreen}>Vừa màn hình</button>
        </div>
        {adjust && <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[#141414] px-3 py-1 text-[12px] text-white">Đang căn chỉnh ảnh trong khung · kéo để di chuyển · Esc để xong</p>}
      </>}

      <input ref={freeInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFreeFile(f); }} />
      <input ref={frameInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFrameFile(f); }} />
      <input ref={bgInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onBgFile(f); }} />

      {interactive && toolbarTarget && createPortal(toolbar, toolbarTarget)}
    </div>
  );
}

// Đo chữ (để tách/ghép trải đôi)
export { sideHasContent };
