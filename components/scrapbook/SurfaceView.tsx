"use client";

/* Khung xem + sửa 1 bề mặt scrapbook (đĩa / trang / cặp trang): bấm chọn lớp, kéo di chuyển, kéo góc phóng / thu, núm xoay,
   bấm đúp ô ảnh để chỉnh ảnh trong khung (kéo dịch, cuộn / nút ± để phóng), bấm ô ảnh trống để chọn ảnh,
   thả sticker / ảnh từ danh sách lên bề mặt, menu chuột phải. Guideline vẽ ở lớp phủ riêng trên cùng (mảnh, mờ,
   pointer-events: none) — không che hay chặn thao tác.
   Chữ: bấm 1 lần chọn, bấm thêm lần nữa (hoặc bấm đúp) để sửa trực tiếp — ô nhập đè đúng lên lớp chữ (vị trí, góc xoay,
   độ rộng, font, cỡ, màu, căn lề, khoảng cách dòng); Esc / Ctrl+Enter / bấm ra ngoài để thoát. Kéo 2 nút cạnh trái / phải
   để đổi độ rộng khung (chữ tự xuống dòng, cỡ giữ nguyên); 4 góc phóng / thu cả khối chữ. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { FONTS, WISH_FONT, renderSurface, type RenderOpts, type TextHit } from "@/lib/scrapbook/render";
import { applyBox, applyWidth, boxOf, inside, resizeBox, snap, type Box as LBox } from "@/lib/scrapbook/edit";
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
  onEmptySlot?: (layer: number) => void;
  onTextEdit?: (layer: number) => void;
  // sửa chữ trực tiếp trên trang
  editText?: number | null; onEditText?: (layer: number | null) => void; selectAllText?: boolean;
  textValue?: (layer: number) => string; onTextValue?: (layer: number, v: string) => void;
  onBackgroundDbl?: (at: { x: number; y: number }) => void;
  tools?: React.ReactNode;
};

export function SurfaceView(p: SurfaceViewProps) {
  const { t, width } = p;
  const S = surfaceOf(t), k = width / S.w, height = S.h * k;
  const view = useRef<HTMLCanvasElement>(null);
  const textBoxes = useRef<Record<number, LBox>>({});
  const drag = useRef<{ mode: "move" | "scale" | "rotate" | "pan" | "width"; i: number; b0: LBox; sx: number; sy: number; adj0?: Adjust; layer0?: Layer; pid?: string; moved?: boolean; wasSel?: boolean; side?: -1 | 1; hx?: -1 | 0 | 1; hy?: -1 | 0 | 1 } | null>(null);
  const editing = p.editText ?? null;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [guide, setGuide] = useState<{ center?: boolean; ring?: number } | null>(null);
  const [, setTick] = useState(0);
  const L = t.layers;
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    const v = view.current;
    if (!v || width <= 0) return;
    const r = renderSurface({ template: t, ...p.render, size: Math.min(3200, Math.round(width * dpr)), editLayer: p.editLayer, hideLayer: editing });
    textBoxes.current = Object.fromEntries(r.texts.map((h: TextHit) => [h.layer, { x: h.x, y: h.y, w: h.w, h: h.h, rot: h.rot }]));
    v.width = r.canvas.width; v.height = r.canvas.height; v.getContext("2d")!.drawImage(r.canvas, 0, 0);
    setTick((x) => x + 1);
  }, [t, p.render, width, dpr, p.editLayer, editing]);

  const layerBox = (i: number) => { const l = L[i]; return l ? boxOf(l, l.k === "text" ? textBoxes.current[i] : undefined) : null; };
  const toMM = (e: { clientX: number; clientY: number }) => { const r = view.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * S.w, y: ((e.clientY - r.top) / r.height) * S.h }; };
  const layerAt = (x: number, y: number) => {
    // sticker khách thêm vẽ trên cùng → được ưu tiên bấm trúng
    const idx = L.map((_, i) => i).sort((a, b) => Number(top(L[a])) - Number(top(L[b])) || a - b);
    for (let j = idx.length - 1; j >= 0; j--) { const i = idx[j]; if (L[i].locked || L[i].hidden) continue; const b = layerBox(i); if (b && inside(x, y, b)) return i; }
    return -1;
  };
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    setMenu(null);
    if (e.button === 2) return;
    const pt = toMM(e);
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
    if (!b) return;
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
    const d = drag.current;
    if (!d) return;
    const pt = toMM(e), b0 = d.b0;
    if (d.mode === "pan") {
      const a = (-b0.rot * Math.PI) / 180, dx = pt.x - d.sx, dy = pt.y - d.sy;
      p.setAdjust(d.pid!, { ...d.adj0!, dx: d.adj0!.dx + dx * Math.cos(a) - dy * Math.sin(a), dy: d.adj0!.dy + dx * Math.sin(a) + dy * Math.cos(a) });
      return;
    }
    if (d.mode === "width") { const l0 = d.layer0!; p.setLayers((ls) => ls.map((l, j) => (j === d.i ? applyWidth(l0, b0, d.side!, pt.x, pt.y) : l)), l0); return; }
    let b: LBox = b0;
    if (d.mode === "move") {
      if (Math.hypot(pt.x - d.sx, pt.y - d.sy) > 0.6) d.moved = true;
      if (!d.moved) return;
      const nx = b0.x + pt.x - d.sx, ny = b0.y + pt.y - d.sy;
      const s = S.round ? snap(nx, ny) : { x: nx, y: ny, guide: {} as { center?: boolean; ring?: number } };
      setGuide(s.guide.center || s.guide.ring ? s.guide : null);
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
    const pt = toMM(e), i = layerAt(pt.x, pt.y), l = L[i];
    if (!l) { p.onBackgroundDbl?.(pt); return; }
    if (l.k === "photo") { if (l.photo === "") p.onEmptySlot?.(i); else { p.onEditLayer(i); p.onSel(null); } }
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
    if (!pid && !aid) return;
    e.preventDefault();
    const pt = toMM(e);
    if (pid) { const i = layerAt(pt.x, pt.y); const j = i >= 0 && L[i].k === "photo" ? i : L.findIndex((l, n) => l.k === "photo" && (() => { const b = layerBox(n); return b && inside(pt.x, pt.y, b); })()); if (j >= 0) p.onDropPhoto?.(pid, j); return; }
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
    const h = (e: WheelEvent) => { if (p.editLayer === null) return; e.preventDefault(); zoom(e.deltaY < 0 ? 0.08 : -0.08); };
    v.addEventListener("wheel", h, { passive: false });
    return () => v.removeEventListener("wheel", h);
  }, [p.editLayer, zoom]);
  useEffect(() => { if (p.sel === null) setMenu(null); }, [p.sel]);

  const SB = p.sel !== null && p.editLayer === null && editing === null ? layerBox(p.sel) : null;
  const selL = p.sel !== null ? L[p.sel] : null;
  const sideHandles = selL?.k === "text" && !selL.arc;
  // lớp kéo giãn tự do (thêm 4 nút giữa cạnh): ô ảnh chữ nhật / vuông / bo góc / giấy xé / tròn / tim, khung PNG admin cho phép, giấy, băng dính, lời chúc
  function stretchable(l: Layer) {
    if (l.k === "paper" || l.k === "tape" || l.k === "wish") return true;
    if (l.k !== "photo") return false;
    if (l.frame) return !!p.render.frames?.[l.frame]?.frame.allow_stretch;
    return l.shape !== "polaroid" && l.shape !== "frame";
  }
  const edgeHandles = !!selL && !sideHandles && stretchable(selL);
  return (
    <div className="relative" style={{ width, height }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(ASSET_DRAG) || e.dataTransfer.types.includes(PHOTO_DRAG)) e.preventDefault(); }} onDrop={onDrop}>
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
            </g>
          )}
        </svg>
      )}
      {guide && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${S.w} ${S.h}`}>
          {guide.center && <g stroke="#2563eb" strokeWidth="0.3" strokeDasharray="1.2 1"><line x1={C} y1="0" x2={C} y2={S.h} /><line x1="0" y1={C} x2={S.w} y2={C} /></g>}
          {guide.ring && <circle cx={C} cy={C} r={guide.ring} fill="none" stroke="#2563eb" strokeWidth="0.3" strokeDasharray="1.2 1" />}
        </svg>
      )}
      {SB && (
        <div className="pointer-events-none absolute border-2 border-[#2563eb]"
          style={{ left: (SB.x - SB.w / 2) * k, top: (SB.y - SB.h / 2) * k, width: SB.w * k, height: SB.h * k, transform: `rotate(${SB.rot}deg)` }}>
          {([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([hx, hy], i) => (
            <span key={i} onPointerDown={(e) => startHandle(e, "scale", hx, hy)} className={cx("pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-2 border-[#2563eb] bg-white", hx === hy ? "cursor-nwse-resize" : "cursor-nesw-resize")} style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%` }} />
          ))}
          {edgeHandles && ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).map(([hx, hy], i) => (
            <span key={`e${i}`} onPointerDown={(e) => startHandle(e, "scale", hx, hy)} title="Kéo để kéo giãn (Shift: giữ tỉ lệ · Alt: từ tâm)"
              className={cx("pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2563eb] bg-white", hx ? "h-5 w-2 cursor-ew-resize" : "h-2 w-5 cursor-ns-resize")} style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%` }} />
          ))}
          <span onPointerDown={(e) => startHandle(e, "rotate")} title="Kéo để xoay" className="pointer-events-auto absolute left-1/2 top-[-22px] h-3.5 w-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-[#2563eb] bg-white" />
          {sideHandles && ([-1, 1] as const).map((side) => (
            <span key={side} onPointerDown={(e) => startWidth(e, side)} title="Kéo để đổi độ rộng (chữ tự xuống dòng)"
              className="pointer-events-auto absolute top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[#2563eb] bg-white" style={{ left: side < 0 ? "0%" : "100%" }} />
          ))}
        </div>
      )}
      {editing !== null && (L[editing]?.k === "text" || L[editing]?.k === "wish") && p.textValue && p.onTextValue && (
        <InlineText key={editing} l={L[editing] as Extract<Layer, { k: "text" | "wish" }>} hit={textBoxes.current[editing]} k={k} value={p.textValue(editing)} selectAll={!!p.selectAllText}
          onChange={(v) => p.onTextValue!(editing, v)} onExit={() => p.onEditText?.(null)} />
      )}
      {SB && p.tools && !menu && (
        <div className="absolute z-10 flex max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-full flex-wrap justify-center gap-0.5 rounded-[8px] border border-[#e5e5e7] bg-white p-0.5 shadow"
          style={{ left: Math.min(Math.max(SB.x * k, 160), width - 160), top: Math.max(34, (SB.y - Math.max(SB.w, SB.h) / 2) * k - 26) }}>{p.tools}</div>
      )}
      {menu && p.sel !== null && p.tools && (
        <div className="absolute z-20 flex flex-col rounded-[8px] border border-[#e5e5e7] bg-white p-1 shadow-lg" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>{p.tools}</div>
      )}
      {p.editLayer !== null && (
        <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[12px] text-[#52525b] shadow">
          <span className="px-1">Kéo để dịch ảnh</span>
          <button type="button" onClick={() => zoom(-0.1)} aria-label="Thu nhỏ" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Minus size={14} /></button>
          <button type="button" onClick={() => zoom(0.1)} aria-label="Phóng to" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Plus size={14} /></button>
          <button type="button" onClick={() => p.onEditLayer(null)} className="rounded-full bg-[#ff5fa2] px-2.5 py-1 font-medium text-white">Xong</button>
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
