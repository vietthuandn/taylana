"use client";

/* Trình chỉnh riêng cho trang Custom CD (react-konva).
   - Toạ độ nội dung = pixel bản in 300 DPI. Màn hình: Stage phủ cả vùng làm việc, nội dung được
     thu phóng (zoom) và dịch chuyển (pan); khung chọn & nút kéo luôn giữ kích thước trên màn hình.
   - spread = 2 trang cạnh nhau như cuốn sách mở (booklet); xuất file vẫn tách từng trang. */
import "@fontsource/itim/400.css";
import "@fontsource/pangolin/400.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/dancing-script/600.css";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Stage, Layer, Group, Rect, Ellipse, Circle, Ring, Line, Text, Image as KImage, Transformer } from "react-konva";
import type Konva from "konva";
import { mmToPx, type PrintSpec } from "@/lib/print";
import type { DesignBase, Slot } from "@/lib/templates";
import { stickers } from "@/lib/stickers";
import { setPngDpi } from "@/lib/png";
import { useView } from "@/components/designer/smoothImage";
import { SpineContent, sideHasContent, zonePlacement, type Zone } from "@/components/designer/Spine";
import { ColorSelect } from "./ColorSelect";
import { Icon } from "./icons";

export type Half = "L" | "R" | "all";
export type CdDesignerHandle = {
  exportBlob: (half?: Half) => Promise<Blob>;
  isEmpty: (half?: Half) => boolean;
  regionCanvas: (x: number, w: number) => HTMLCanvasElement | null; // vùng trang (px bản in), không guideline/không nội dung dải
};

type SlotData = { src: string; nw: number; nh: number; zoom: number; ox: number; oy: number };
type FreeEl = {
  id: string;
  kind: "image" | "sticker" | "text";
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  width?: number; height?: number; src?: string; nw?: number; nh?: number;
  text?: string; fontFamily?: string; fontSize?: number; fill?: string; align?: "left" | "center" | "right"; lineHeight?: number;
};
type Sel = { type: "slot"; key: string } | { type: "el"; id: string } | null;

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
// Cỡ chữ hiển thị theo "px" của kích thước in thật (96 px = 1 inch) → đổi sang px bản in 300 DPI
export const PX_UNIT = 300 / 96;
export const SIZE_PRESETS = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96];
const ZOOM_MIN = 0.25, ZOOM_MAX = 4;

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function useHtmlImage(src?: string | null) {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!src) { setImg(undefined); return; }
    const i = new window.Image();
    if (!src.startsWith("blob:") && !src.startsWith("data:")) i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.onerror = () => setImg(undefined);
    i.src = src;
    return () => { i.onload = null; };
  }, [src]);
  return img;
}
function loadSize(src: string) {
  return new Promise<{ w: number; h: number }>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = rej;
    i.src = src;
  });
}
function coverSlot(nw: number, nh: number, w: number, h: number, zoom = 1) {
  const base = Math.max(w / nw, h / nh) * zoom;
  return { dw: nw * base, dh: nh * base };
}
function clipShape(ctx: Konva.Context, shape: Slot["shape"], w: number, h: number) {
  if (shape === "circle") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else ctx.rect(0, 0, w, h);
}
function zoomSlot(data: SlotData, slot: AbsSlot, zoom: number): SlotData {
  const z = clamp(zoom, 1, 5);
  const old = coverSlot(data.nw, data.nh, slot.w, slot.h, data.zoom);
  const next = coverSlot(data.nw, data.nh, slot.w, slot.h, z);
  const cx = slot.w / 2, cy = slot.h / 2;
  const ox = cx - ((cx - data.ox) * next.dw) / old.dw;
  const oy = cy - ((cy - data.oy) * next.dh) / old.dh;
  return { ...data, zoom: z, ox: clamp(ox, slot.w - next.dw, 0), oy: clamp(oy, slot.h - next.dh, 0) };
}
function centered(src: string, nw: number, nh: number, slot: AbsSlot): SlotData {
  const { dw, dh } = coverSlot(nw, nh, slot.w, slot.h);
  return { src, nw, nh, zoom: 1, ox: (slot.w - dw) / 2, oy: (slot.h - dh) / 2 };
}

// Ô ảnh của mẫu, đã đổi sang toạ độ tuyệt đối (px bản in) của canvas
type AbsSlot = { key: string; half: number; shape: Slot["shape"]; x: number; y: number; w: number; h: number; rotation: number };

function SlotImage({ slot, s, data, panMode, onSelect, onChange }: {
  slot: AbsSlot; s: number; data: SlotData; panMode: boolean; onSelect: () => void; onChange: (d: SlotData) => void;
}) {
  const img = useHtmlImage(data.src);
  const { dw, dh } = coverSlot(data.nw, data.nh, slot.w, slot.h, data.zoom);
  const view = useView(img, Math.max(dw, dh) * s);
  return (
    <Group x={slot.x} y={slot.y} rotation={slot.rotation} clipFunc={(ctx) => clipShape(ctx, slot.shape, slot.w, slot.h)}>
      {img && view && (
        <KImage image={view} fullImage={img} x={data.ox} y={data.oy} width={dw} height={dh} draggable={!panMode}
          onMouseDown={onSelect} onTouchStart={onSelect}
          onDragMove={(e) => { const n = e.target; n.x(clamp(n.x(), slot.w - dw, 0)); n.y(clamp(n.y(), slot.h - dh, 0)); }}
          onDragEnd={(e) => onChange({ ...data, ox: e.target.x(), oy: e.target.y() })} />
      )}
    </Group>
  );
}

function FreeNode({ el, fontTick, s, panMode, onSelect, onChange }: {
  el: FreeEl; fontTick: number; s: number; panMode: boolean; onSelect: () => void; onChange: (e: Partial<FreeEl>) => void;
}) {
  const img = useHtmlImage(el.kind === "text" ? null : el.src);
  const view = useView(img, Math.max(el.width ?? 0, el.height ?? 0) * Math.max(el.scaleX, el.scaleY) * s);
  const common = {
    id: el.id, name: "free", x: el.x, y: el.y, rotation: el.rotation, scaleX: el.scaleX, scaleY: el.scaleY, draggable: !panMode,
    onMouseDown: onSelect, onTouchStart: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      const p: Partial<FreeEl> = { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() };
      if (el.kind === "text") p.width = (n as Konva.Text).width();
      onChange(p);
    },
  };
  if (el.kind === "text") {
    return (
      <Text key={`${el.id}-${fontTick}-${el.fontFamily}`} {...common} text={el.text} fontFamily={el.fontFamily} fontSize={el.fontSize}
        fill={el.fill} align={el.align ?? "left"} lineHeight={el.lineHeight ?? 1.2}
        width={el.width} wrap={el.width ? "word" : "none"} />
    );
  }
  return img && view ? <KImage {...common} image={view} fullImage={img} width={el.width} height={el.height} /> : null;
}

// Đường cắt & vùng an toàn (không xuất ra file)
function Guides({ spec, W, H, s }: { spec: PrintSpec; W: number; H: number; s: number }) {
  const px = (mm: number) => (mm / spec.w) * W;
  const cut = px(spec.cut), safe = px(spec.safe);
  const thin = 1 / s;
  const band = "rgba(255,95,162,0.35)";
  if (spec.shape === "disc") {
    const r = W / 2;
    return (
      <Group listening={false}>
        <Ring x={r} y={r} innerRadius={r - cut} outerRadius={r} fill={band} />
        <Circle x={r} y={r} radius={px(spec.hub! / 2)} fill={band} />
        <Circle x={r} y={r} radius={px(spec.hole! / 2)} stroke="#141414" strokeWidth={thin} />
        <Circle x={r} y={r} radius={r} stroke="#141414" strokeWidth={thin} />
        <Circle x={r} y={r} radius={r - safe} stroke="#7b68ee" strokeWidth={thin} dash={[6 / s, 4 / s]} />
        <Circle x={r} y={r} radius={px(spec.hub! / 2) + px(2)} stroke="#7b68ee" strokeWidth={thin} dash={[6 / s, 4 / s]} />
      </Group>
    );
  }
  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={W} height={cut} fill={band} />
      <Rect x={0} y={H - cut} width={W} height={cut} fill={band} />
      <Rect x={0} y={cut} width={cut} height={H - cut * 2} fill={band} />
      <Rect x={W - cut} y={cut} width={cut} height={H - cut * 2} fill={band} />
      <Rect x={safe} y={safe} width={W - safe * 2} height={H - safe * 2} stroke="#7b68ee" strokeWidth={thin} dash={[6 / s, 4 / s]} />
    </Group>
  );
}

// ================================================================
export function CdDesigner({ ref, spec, spread = false, view = "all", viewport, templates, active, toolbarTarget, caption,
  guides, zones, onZoneClick, tray, onSnapshot }: {
  ref?: React.Ref<CdDesignerHandle>;
  spec: PrintSpec;
  spread?: boolean; // 2 trang cạnh nhau
  view?: Half; // trang hiển thị (spread ở chế độ 1 trang: "L"/"R")
  viewport: { w: number; h: number };
  templates: (DesignBase | null)[]; // 1 mẫu, hoặc [trái, phải] khi spread
  active: boolean;
  toolbarTarget?: HTMLElement | null;
  caption?: string;
  guides: boolean;
  zones?: Zone[];
  onZoneClick?: (id: string) => void;
  tray?: { cx: number; cy: number; r: number; hole: number };
  onSnapshot?: (half: Half, dataUrl: string) => void;
}) {
  const W1 = mmToPx(spec.w), H = mmToPx(spec.h);
  const W = spread ? W1 * 2 : W1;
  const isDisc = spec.shape === "disc";
  const halves = spread ? [0, 1] : [0];

  // ---------- Ô ảnh của mẫu (mỗi nửa 1 mẫu) ----------
  const slots = useMemo<AbsSlot[]>(() => halves.flatMap((h) => (templates[h]?.slots ?? []).map((sl, i) => ({
    key: `${h}-${i}`, half: h, shape: sl.shape, rotation: sl.rotation ?? 0,
    x: h * W1 + sl.x * W1, y: sl.y * H, w: sl.w * W1, h: sl.h * H,
  }))), [templates, W1, H, spread]); // eslint-disable-line react-hooks/exhaustive-deps

  const stageRef = useRef<Konva.Stage>(null);
  const guidesRef = useRef<Konva.Layer>(null);
  const paperRef = useRef<Konva.Layer>(null);
  const contentRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const freeInput = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<string>("");

  const [bgColor, setBgColor] = useState(templates[0]?.background_color || "#ffffff");
  const [slotData, setSlotData] = useState<Record<string, SlotData>>({});
  const [els, setEls] = useState<FreeEl[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [err, setErr] = useState("");
  const snapRef = useRef(onSnapshot);
  snapRef.current = onSnapshot;

  // ---------- Zoom & pan ----------
  const [zoom, setZoom] = useState(1); // 1 = vừa màn hình
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // null = căn giữa
  const [panMode, setPanMode] = useState(false); // đang giữ Space
  const regionX = view === "R" ? W1 : 0;
  const regionW = view === "all" ? W : W1;
  const reserveB = 44; // chừa chỗ cho chú thích & thanh zoom
  const fit = Math.max(0.01, Math.min((viewport.w - 48) / regionW, (viewport.h - 32 - reserveB) / H));
  const s = fit * zoom;
  const centerPos = (sc: number) => ({ x: viewport.w / 2 - (regionX + regionW / 2) * sc, y: (viewport.h - reserveB) / 2 - (H / 2) * sc + 8 });
  const p = pos ?? centerPos(s);

  const fitScreen = useCallback(() => { setZoom(1); setPos(null); }, []);
  useEffect(() => { if (active) fitScreen(); }, [active, view, fitScreen]); // mở/đổi trang → vừa màn hình

  function zoomAt(nextZoom: number, at?: { x: number; y: number }) {
    const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
    const pt = at ?? { x: viewport.w / 2, y: (viewport.h - reserveB) / 2 };
    const ns = fit * z;
    const cx = (pt.x - p.x) / s, cy = (pt.y - p.y) / s; // điểm nội dung dưới con trỏ
    setZoom(z);
    setPos({ x: pt.x - cx * ns, y: pt.y - cy * ns });
  }

  // Space (giữ) / chuột giữa để kéo canvas
  useEffect(() => {
    if (!active) return;
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !isField(e.target)) { e.preventDefault(); setPanMode(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setPanMode(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [active]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
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
    return () => {
      el.removeEventListener("pointerdown", pd, true);
      el.removeEventListener("pointermove", pm);
      el.removeEventListener("pointerup", pu);
      el.removeEventListener("pointercancel", pu);
    };
  });

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pt = stageRef.current?.getPointerPosition() ?? undefined;
      zoomAt(zoom * Math.exp(-e.evt.deltaY * 0.0025), pt);
    } else {
      setPos({ x: p.x - e.evt.deltaX, y: p.y - e.evt.deltaY });
    }
  };

  // ---------- Ảnh mẫu ----------
  const ovL = useHtmlImage(templates[0]?.overlay_url), ovR = useHtmlImage(spread ? templates[1]?.overlay_url : null);
  const bgL = useHtmlImage(templates[0]?.background_url), bgR = useHtmlImage(spread ? templates[1]?.background_url : null);
  const ovLView = useView(ovL, Math.max(W1, H) * s), ovRView = useView(ovR, Math.max(W1, H) * s);
  const bgLView = useView(bgL, Math.max(W1, H) * s), bgRView = useView(bgR, Math.max(W1, H) * s);

  // Đổi mẫu: giữ ảnh theo thứ tự ô, căn lại cho vừa ô mới
  useEffect(() => {
    setSlotData((prev) => {
      const next: Record<string, SlotData> = {};
      for (const [k, d] of Object.entries(prev)) {
        const sl = slots.find((x) => x.key === k);
        next[k] = sl ? centered(d.src, d.nw, d.nh, sl) : d; // ô không còn → tạm ẩn
      }
      return next;
    });
    if (templates[0]?.background_color) setBgColor(templates[0].background_color);
    setSel(null);
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.fonts?.ready.then(() => setFontTick((t) => t + 1)); }, []);

  const selectedEl = sel?.type === "el" ? els.find((e) => e.id === sel.id) : undefined;
  const isText = selectedEl?.kind === "text";

  // Gắn khung chọn vào phần tử đang chọn
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = sel?.type === "el" ? stageRef.current?.findOne(`#${sel.id}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [sel, els, fontTick]);

  const updateEl = useCallback((id: string, p: Partial<FreeEl>) => setEls((cur) => cur.map((e) => (e.id === id ? { ...e, ...p } : e))), []);

  function removeSelected() {
    if (sel?.type === "el") setEls((cur) => cur.filter((e) => e.id !== sel.id));
    if (sel?.type === "slot") setSlotData((cur) => { const n = { ...cur }; delete n[sel.key]; return n; });
    setSel(null);
  }
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); removeSelected(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function moveLayer(dir: 1 | -1) {
    if (sel?.type !== "el") return;
    setEls((cur) => {
      const i = cur.findIndex((e) => e.id === sel.id);
      const j = clamp(i + dir, 0, cur.length - 1);
      const next = [...cur];
      const [x] = next.splice(i, 1);
      next.splice(j, 0, x);
      return next;
    });
  }

  // Trang (nửa) đang xem → vùng đặt phần tử mới / vừa khung
  const pageRect = (cx?: number) => {
    const h = spread ? (cx !== undefined ? (cx >= W1 ? 1 : 0) : view === "R" ? 1 : 0) : 0;
    return { x: h * W1, w: W1 };
  };

  function pickSlot(key: string) { pendingSlot.current = key; slotInput.current?.click(); }
  async function onSlotFile(file: File) {
    const sl = slots.find((x) => x.key === pendingSlot.current);
    if (!sl) return;
    const src = URL.createObjectURL(file);
    try {
      const { w, h } = await loadSize(src);
      setSlotData((cur) => ({ ...cur, [sl.key]: centered(src, w, h, sl) }));
      setSel({ type: "slot", key: sl.key });
      setErr("");
    } catch { setErr("Không đọc được ảnh này. Bạn thử ảnh JPG/PNG khác nhé."); }
  }

  async function addImage(src: string, kind: "image" | "sticker", ratio: number) {
    try {
      const { w, h } = await loadSize(src);
      const pr = pageRect();
      const k = (Math.min(W1, H) * ratio) / Math.max(w, h);
      const el: FreeEl = { id: uid(), kind, src, nw: w, nh: h, width: w * k, height: h * k, x: pr.x + (W1 - w * k) / 2, y: (H - h * k) / 2, rotation: 0, scaleX: 1, scaleY: 1 };
      setEls((cur) => [...cur, el]);
      setSel({ type: "el", id: el.id });
      setErr("");
    } catch { setErr("Không đọc được ảnh này."); }
  }

  function addText() {
    const pr = pageRect();
    const el: FreeEl = {
      id: uid(), kind: "text", text: "Chữ của bạn", fontFamily: "Be Vietnam Pro", fontSize: Math.round(24 * PX_UNIT), fill: "#050505",
      align: "left", lineHeight: 1.2, x: pr.x + W1 * 0.12, y: H * 0.45, rotation: 0, scaleX: 1, scaleY: 1,
    };
    setEls((cur) => [...cur, el]);
    setSel({ type: "el", id: el.id });
  }

  // Ảnh: vừa khung / phủ kín trang (theo trang chứa tâm ảnh)
  function fitImage(mode: "contain" | "cover") {
    if (!selectedEl || selectedEl.kind === "text") return;
    const ratio = (selectedEl.nw && selectedEl.nh) ? selectedEl.nw / selectedEl.nh : (selectedEl.width ?? 1) / (selectedEl.height ?? 1);
    const cx = selectedEl.x + ((selectedEl.width ?? 0) * selectedEl.scaleX) / 2;
    const pr = pageRect(cx);
    const k = mode === "contain" ? Math.min(pr.w / ratio, H) : Math.max(pr.w / ratio, H); // chiều cao
    const h = k, w = k * ratio;
    updateEl(selectedEl.id, { width: w, height: h, scaleX: 1, scaleY: 1, rotation: 0, x: pr.x + (pr.w - w) / 2, y: (H - h) / 2 });
  }

  // ---------- Xuất file / ảnh vùng ----------
  // Vẽ lại nội dung ra canvas riêng (đúng px bản in), không có guideline, khung chọn, nền giấy
  function renderRegion(rx: number, rw: number, ratio: number, opts?: { hideZones?: boolean }) {
    const stage = stageRef.current;
    if (!stage) return null;
    const tr = trRef.current;
    tr?.visible(false);
    guidesRef.current?.visible(false);
    paperRef.current?.visible(false);
    const hidden: Konva.Node[] = [];
    if (opts?.hideZones) stage.find(".zone-content").forEach((n) => { if (n.visible()) { n.visible(false); hidden.push(n); } });
    const swapped: [Konva.Image, CanvasImageSource][] = [];
    if (ratio >= 0.5 / s) {
      stage.find("Image").forEach((n) => {
        const k = n as Konva.Image;
        const full = k.getAttr("fullImage") as HTMLImageElement | undefined;
        if (full && full !== k.image()) { swapped.push([k, k.image()!]); k.image(full); }
      });
    }
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
    isEmpty: (half: Half = "all") => {
      const r = halfRange(spread ? half : "all");
      const hs = r.x === 0 && r.w === W ? halves : [r.x === 0 ? 0 : 1];
      if (hs.some((h) => templates[h]?.overlay_url || templates[h]?.background_url)) return false;
      if (Object.keys(slotData).some((k) => slots.some((sl) => sl.key === k && hs.includes(sl.half)))) return false;
      if ((zones ?? []).some((z) => sideHasContent(z.side))) return false;
      const grp = contentRef.current;
      return !els.some((el) => {
        const n = stageRef.current?.findOne(`#${el.id}`);
        if (!n || !grp) return true;
        const b = n.getClientRect({ relativeTo: grp });
        return b.x < r.x + r.w && b.x + b.width > r.x;
      });
    },
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
        throw new Error(e instanceof Error && e.name === "SecurityError" ? "Ảnh khung mẫu chặn xuất file (CORS). Báo tiệm giúp nhé!" : e instanceof Error ? e.message : "Lỗi xuất ảnh");
      }
    },
    regionCanvas: (x: number, w: number) => {
      try { return renderRegion(x, w, 1 / s, { hideZones: true }); } catch { return null; }
    },
  }));

  // Ảnh thu nhỏ từng trang (không guideline) sau mỗi thay đổi
  useEffect(() => {
    if (!snapRef.current || viewport.w === 0) return;
    const t = setTimeout(() => {
      try {
        for (const half of (spread ? ["L", "R"] : ["all"]) as Half[]) {
          const r = halfRange(half);
          const c = renderRegion(r.x, r.w, 110 / (r.w * s));
          if (c) snapRef.current?.(half, c.toDataURL("image/png"));
        }
      } catch { /* ảnh mẫu chặn CORS: bỏ qua ảnh thu nhỏ */ }
    }, 450);
    return () => clearTimeout(t);
  }, [slotData, els, bgColor, templates, zones, ovL, ovR, bgL, bgR, fontTick, viewport.w, viewport.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const deselect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === "bg") setSel(null);
  };
  const discClip = (ctx: Konva.Context) => {
    const r = W / 2, hole = (spec.hole! / 2 / spec.w) * W;
    ctx.arc(r, r, r, 0, Math.PI * 2, false);
    ctx.moveTo(r + hole, r);
    ctx.arc(r, r, hole, 0, Math.PI * 2, true);
  };
  const selSlot = sel?.type === "slot" ? sel.key : "";
  const setCursor = (c: string) => { const el = stageRef.current?.container(); if (el) el.style.cursor = c; };

  // Chữ: kéo nút cạnh trái/phải → đổi chiều rộng (tự xuống dòng), giữ nguyên cỡ chữ
  const onTextTransform = () => {
    const tr = trRef.current;
    const n = tr?.nodes()[0] as Konva.Text | undefined;
    if (!tr || !n || n.getClassName() !== "Text") return;
    const a = tr.getActiveAnchor();
    if (a === "middle-left" || a === "middle-right") {
      n.setAttrs({ width: Math.max(30, n.width() * n.scaleX()), scaleX: n.scaleY() });
    }
  };

  // ---------- Thanh công cụ (đặt trong panel bên phải) ----------
  const sizeUnit = selectedEl?.fontSize ? Math.round((selectedEl.fontSize / PX_UNIT) * 10) / 10 : 24;
  const toolbar = (
    <div className="divide-y divide-[#ecebe7]">
      {/* Thêm */}
      <div className="flex flex-wrap gap-1.5 pb-3">
        <button className="tool-btn" onClick={() => freeInput.current?.click()}><Icon name="image" /> Ảnh</button>
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

      {/* Thuộc tính mục đang chọn */}
      {(selectedEl || (sel?.type === "slot" && slotData[sel.key])) && (
        <div className="space-y-2.5 py-3">
          <div className="flex items-center justify-between">
            <p className="tool-label">Thuộc tính · {sel?.type === "slot" ? "ảnh trong ô" : isText ? "chữ" : selectedEl?.kind === "sticker" ? "sticker" : "ảnh"}</p>
            <div className="flex gap-1">
              {selectedEl && <>
                <button className="tool-btn tool-icon" title="Đưa lên trên" aria-label="Đưa lên trên" onClick={() => moveLayer(1)}><Icon name="up" /></button>
                <button className="tool-btn tool-icon" title="Đưa xuống dưới" aria-label="Đưa xuống dưới" onClick={() => moveLayer(-1)}><Icon name="down" /></button>
              </>}
              <button className="tool-btn tool-icon !text-[#d0303f]" title="Xoá" aria-label="Xoá" onClick={removeSelected}><Icon name="trash" /></button>
            </div>
          </div>

          {sel?.type === "slot" && slotData[sel.key] && (() => {
            const sl = slots.find((x) => x.key === sel.key)!;
            return (
              <>
                <label className="flex items-center gap-2">
                  <span className="w-16 text-[12px] text-[#77726b]">Phóng to</span>
                  <input type="range" min={1} max={5} step={0.01} value={slotData[sel.key].zoom} className="flex-1 accent-[#141414]"
                    onChange={(e) => { const k = sel.key; setSlotData((cur) => ({ ...cur, [k]: zoomSlot(cur[k], sl, Number(e.target.value)) })); }} />
                </label>
                <button className="tool-btn" onClick={() => pickSlot(sel.key)}>Đổi ảnh</button>
              </>
            );
          })()}

          {selectedEl && selectedEl.kind !== "text" && (
            <div className="flex gap-1.5">
              <button className="tool-btn flex-1" onClick={() => fitImage("contain")} title="Vừa trang theo cạnh nhỏ hơn, căn giữa">Vừa khung</button>
              <button className="tool-btn flex-1" onClick={() => fitImage("cover")} title="Phủ kín toàn trang">Phủ kín</button>
            </div>
          )}

          {isText && selectedEl && (
            <>
              <textarea className="tool-input !h-auto w-full py-1.5" rows={2} value={selectedEl.text} onChange={(e) => updateEl(selectedEl.id, { text: e.target.value })} />
              <select className="tool-input w-full" value={selectedEl.fontFamily} style={{ fontFamily: selectedEl.fontFamily }}
                onChange={(e) => { const f = e.target.value; updateEl(selectedEl.id, { fontFamily: f }); document.fonts?.load(`40px "${f}"`).then(() => setFontTick((t) => t + 1)); }}>
                {FONTS.map((f) => <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>)}
              </select>
              <div className="flex gap-1.5">
                <div className="flex flex-1 items-center">
                  <input type="number" min={4} max={400} step={1} value={sizeUnit} aria-label="Cỡ chữ (px)" title="Cỡ chữ (px theo kích thước in)"
                    className="tool-input w-full rounded-r-none"
                    onChange={(e) => { const v = Number(e.target.value); if (v > 0) updateEl(selectedEl.id, { fontSize: Math.round(v * PX_UNIT) }); }} />
                  <select aria-label="Chọn nhanh cỡ chữ" className="tool-input -ml-px w-9 rounded-l-none !px-1" value=""
                    onChange={(e) => { const v = Number(e.target.value); if (v) updateEl(selectedEl.id, { fontSize: Math.round(v * PX_UNIT) }); }}>
                    <option value="" disabled>▾</option>
                    {SIZE_PRESETS.map((n) => <option key={n} value={n}>{n} px</option>)}
                  </select>
                </div>
                <label className="flex w-[92px] items-center gap-1" title="Khoảng cách dòng">
                  <Icon name="lineHeight" />
                  <input type="number" min={0.5} max={3} step={0.1} value={selectedEl.lineHeight ?? 1.2} aria-label="Khoảng cách dòng"
                    className="tool-input w-full" onChange={(e) => updateEl(selectedEl.id, { lineHeight: Number(e.target.value) || 1.2 })} />
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <ColorSelect value={selectedEl.fill ?? "#050505"} colors={TEXT_COLORS} onChange={(c) => updateEl(selectedEl.id, { fill: c })} />
                <div className="flex">
                  {(["left", "center", "right"] as const).map((a, i) => (
                    <button key={a} title={{ left: "Canh trái", center: "Canh giữa", right: "Canh phải" }[a]} aria-label={a}
                      aria-pressed={(selectedEl.align ?? "left") === a}
                      className={`tool-btn tool-icon ${i === 0 ? "rounded-r-none" : i === 2 ? "-ml-px rounded-l-none" : "-ml-px rounded-none"}`}
                      onClick={() => updateEl(selectedEl.id, { align: a, width: selectedEl.width ?? (stageRef.current?.findOne(`#${selectedEl.id}`) as Konva.Text | undefined)?.width() })}>
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

      {/* Màu nền trang */}
      <div className="pt-3">
        <p className="tool-label mb-2">Màu nền</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {BG_COLORS.map((c) => (
            <button key={c} aria-label={`Nền ${c}`} title={c} aria-pressed={bgColor === c} onClick={() => setBgColor(c)} className="swatch" style={{ background: c }} />
          ))}
          <label className="swatch relative overflow-hidden bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu tuỳ chọn">
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu nền tuỳ chọn" />
          </label>
        </div>
      </div>
      {err && <p className="pt-3 text-[12px] text-[#d0303f]">{err}</p>}
    </div>
  );

  const stroke = 1 / s;
  return (
    <div ref={boxRef} className="relative h-full w-full select-none overflow-hidden" style={{ width: viewport.w, height: viewport.h, cursor: panMode ? "grab" : undefined }}>
      <Stage ref={stageRef} width={viewport.w} height={viewport.h} x={p.x} y={p.y} scaleX={s} scaleY={s}
        onMouseDown={deselect} onTouchStart={deselect} onWheel={onWheel}>
        {/* Nền "tờ giấy" (bóng đổ) — không xuất ra file */}
        <Layer ref={paperRef} listening={false}>
          {isDisc
            ? <Circle x={W / 2} y={W / 2} radius={W / 2} fill="#ffffff" shadowColor="#000" shadowOpacity={0.18} shadowBlur={18 / s} shadowOffsetY={4 / s} />
            : <Rect width={W} height={H} fill="#ffffff" shadowColor="#000" shadowOpacity={0.18} shadowBlur={18 / s} shadowOffsetY={4 / s} />}
        </Layer>
        <Layer>
          <Group ref={contentRef} clipFunc={isDisc ? discClip : (ctx) => ctx.rect(0, 0, W, H)}>
            <Rect name="bg" width={W} height={H} fill={bgColor} preventDefault={false} />
            {halves.map((h) => {
              const img = h ? bgR : bgL, v = h ? bgRView : bgLView;
              if (!img || !v) return null;
              const k = Math.max(W1 / img.naturalWidth, H / img.naturalHeight);
              return (
                <Group key={h} clipFunc={(ctx) => ctx.rect(h * W1, 0, W1, H)}>
                  <KImage name="bg" preventDefault={false} image={v} fullImage={img} width={img.naturalWidth * k} height={img.naturalHeight * k}
                    x={h * W1 + (W1 - img.naturalWidth * k) / 2} y={(H - img.naturalHeight * k) / 2} />
                </Group>
              );
            })}
            {slots.map((sl) => slotData[sl.key] ? (
              <SlotImage key={sl.key} slot={sl} s={s} data={slotData[sl.key]} panMode={panMode}
                onSelect={() => setSel({ type: "slot", key: sl.key })} onChange={(d) => setSlotData((cur) => ({ ...cur, [sl.key]: d }))} />
            ) : null)}
            {halves.map((h) => {
              const img = h ? ovR : ovL, v = h ? ovRView : ovLView;
              return img && v ? <KImage key={h} image={v} fullImage={img} x={h * W1} width={W1} height={H} listening={false} /> : null;
            })}
            {els.map((el) => (
              <FreeNode key={el.id} el={el} fontTick={fontTick} s={s} panMode={panMode} onSelect={() => setSel({ type: "el", id: el.id })} onChange={(pp) => updateEl(el.id, pp)} />
            ))}
            {/* Nội dung gáy / Spine — xoay đúng chiều, có trong file xuất */}
            {(zones ?? []).map((z) => z.side && (
              <Group key={z.id} name="zone-content" {...zonePlacement(z, H)} listening={false}>
                <SpineContent side={z.side} len={H} thick={z.w} />
              </Group>
            ))}
          </Group>
          <Transformer ref={trRef} rotateAnchorOffset={22} anchorSize={10} borderStroke="#7b68ee" anchorStroke="#7b68ee" anchorFill="#ffffff"
            anchorCornerRadius={2} keepRatio ignoreStroke flipEnabled={false}
            enabledAnchors={isText ? ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"] : ["top-left", "top-right", "bottom-left", "bottom-right"]}
            onTransform={onTextTransform} />
        </Layer>

        {/* Lớp hướng dẫn — KHÔNG có trong file xuất */}
        <Layer ref={guidesRef}>
          {guides && halves.map((h) => <Group key={h} x={h * W1}><Guides spec={spec} W={W1} H={H} s={s} /></Group>)}
          {/* gáy sách giữa 2 trang trải đôi */}
          {spread && view === "all" && (
            <Group listening={false}>
              <Rect x={W1 - 40} width={80} height={H} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 80, y: 0 }}
                fillLinearGradientColorStops={[0, "rgba(0,0,0,0)", 0.5, "rgba(0,0,0,0.14)", 1, "rgba(0,0,0,0)"]} />
              <Line points={[W1, 0, W1, H]} stroke="#141414" strokeWidth={stroke} dash={[6 / s, 4 / s]} />
            </Group>
          )}
          {/* spread ở chế độ 1 trang: che trang còn lại */}
          {spread && view !== "all" && (
            <Rect x={view === "R" ? -W1 * 4 : W1} y={-H * 4} width={W1 * 5} height={H * 9} fill="#ece1d0" />
          )}
          {guides && tray && (
            <Group listening={false} opacity={0.55}>
              <Circle x={tray.cx} y={tray.cy} radius={tray.r} stroke="#7b68ee" strokeWidth={1.5 * stroke} fill="rgba(123,104,238,0.08)" />
              <Circle x={tray.cx} y={tray.cy} radius={tray.hole} stroke="#7b68ee" strokeWidth={stroke} />
              <Line points={[tray.cx - 10 / s, tray.cy, tray.cx + 10 / s, tray.cy]} stroke="#7b68ee" strokeWidth={stroke} />
              <Line points={[tray.cx, tray.cy - 10 / s, tray.cx, tray.cy + 10 / s]} stroke="#7b68ee" strokeWidth={stroke} />
            </Group>
          )}
          {/* Đường chia gáy / Spine: luôn hiện. Hover/bấm để sửa chỉ khi đang bật guideline */}
          {(zones ?? []).map((z) => {
            const editable = !!z.side && guides;
            const hov = editable && hoverZone === z.id;
            const fs = Math.min(z.w * 0.5, 11 / s);
            const lines = [z.x, z.x + z.w].filter((x) => x > 0.5 && x < W - 0.5);
            const pl = zonePlacement(z, H);
            return (
              <Group key={z.id} listening={editable}
                onMouseEnter={() => { setHoverZone(z.id); setCursor("pointer"); }}
                onMouseLeave={() => { setHoverZone(null); setCursor("default"); }}
                onClick={() => onZoneClick?.(z.id)} onTap={() => onZoneClick?.(z.id)}>
                <Rect x={z.x} y={0} width={z.w} height={H} fill={hov ? "rgba(200,224,60,0.55)" : "rgba(0,0,0,0)"} />
                {lines.map((lx) => <Line key={lx} points={[lx, 0, lx, H]} stroke="#141414" strokeWidth={stroke} dash={[6 / s, 4 / s]} listening={false} />)}
                {z.side && z.label && (
                  <Group {...pl} listening={false}>
                    <Text text={hov ? "Bấm để sửa" : z.label} x={0} y={(z.w - fs) / 2} width={H} align={hov ? "center" : "left"}
                      padding={hov ? 0 : 8 / s} fontFamily="Be Vietnam Pro" fontStyle="bold" fontSize={fs} fill="#141414" opacity={hov ? 1 : 0.6} />
                  </Group>
                )}
              </Group>
            );
          })}
          {slots.map((sl) => {
            const empty = !slotData[sl.key];
            if (!empty && selSlot !== sl.key) return null;
            const Shape = sl.shape === "circle" ? Ellipse : Rect;
            const shapeProps = sl.shape === "circle" ? { x: sl.w / 2, y: sl.h / 2, radiusX: sl.w / 2, radiusY: sl.h / 2 } : { width: sl.w, height: sl.h };
            return (
              <Group key={sl.key} x={sl.x} y={sl.y} rotation={sl.rotation} listening={empty && !panMode}
                onMouseDown={(e) => { if (e.evt.button === 0) pickSlot(sl.key); }} onTap={() => pickSlot(sl.key)}>
                <Shape {...shapeProps} fill={empty ? "rgba(255,255,255,0.55)" : undefined} stroke="#7b68ee" strokeWidth={2 * stroke} dash={[8 / s, 6 / s]} />
                {empty && (
                  <Text text={"＋\nThêm ảnh"} width={sl.w} height={sl.h} align="center" verticalAlign="middle"
                    fontFamily="Be Vietnam Pro" fontStyle="bold" fontSize={Math.max(12 / s, Math.min(sl.w, sl.h) * 0.1)} fill="#4d4a46" lineHeight={1.2} />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Chú thích trang & thanh zoom */}
      {caption && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[12px] font-medium text-[#4d4a46]">{caption}</p>}
      <div className="absolute bottom-2 left-2 flex items-center gap-0.5 rounded-[8px] border border-[#dedad3] bg-white p-0.5 text-[12px] shadow-sm">
        <button className="grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[#f4f2ee]" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => zoomAt(zoom / 1.25)}>−</button>
        <span className="w-11 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[#f4f2ee]" title="Phóng to" aria-label="Phóng to" onClick={() => zoomAt(zoom * 1.25)}>+</button>
        <button className="h-7 rounded-[6px] px-2 hover:bg-[#f4f2ee]" title="Vừa màn hình" onClick={fitScreen}>Vừa màn hình</button>
      </div>

      <input ref={slotInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onSlotFile(f); }} />
      <input ref={freeInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addImage(URL.createObjectURL(f), "image", 0.5); }} />

      {toolbarTarget && createPortal(toolbar, toolbarTarget)}
    </div>
  );
}
