"use client";

/* Trình thiết kế dùng chung cho Custom CD & Photostrip (react-konva).
   Toạ độ bên trong = pixel bản in ở 300 DPI; màn hình chỉ là bản thu nhỏ. */
import "@fontsource/pangolin/400.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/dancing-script/600.css";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Ellipse, Circle, Ring, Line, Text, Image as KImage, Transformer } from "react-konva";
import type Konva from "konva";
import { mmToPx, type PrintSpec } from "@/lib/print";
import type { DesignBase, Slot } from "@/lib/templates";
import { stickers } from "@/lib/stickers";
import { setPngDpi } from "@/lib/png";

export type DesignerHandle = {
  exportBlob: () => Promise<Blob>;
  isEmpty: () => boolean;
};

type SlotData = { src: string; nw: number; nh: number; zoom: number; ox: number; oy: number };
type FreeEl = {
  id: string;
  kind: "image" | "sticker" | "text";
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  width?: number; height?: number; src?: string;
  text?: string; fontFamily?: string; fontSize?: number; fill?: string; outline?: boolean;
};
type Sel = { type: "slot"; index: number } | { type: "el"; id: string } | null;

export const FONTS = [
  { name: "Itim", label: "Itim (vẽ tay)" },
  { name: "Pangolin", label: "Pangolin" },
  { name: "Patrick Hand", label: "Patrick Hand" },
  { name: "Dancing Script", label: "Dancing Script (bay bổng)" },
  { name: "Be Vietnam Pro", label: "Be Vietnam Pro" },
];
const COLORS = ["#4b3329", "#ffffff", "#e2789b", "#f39bb4", "#7e9f5a", "#a6c37f", "#ffcf5c", "#7aa6d8", "#000000"];
const BG_COLORS = ["#ffffff", "#fff8ec", "#ffeef2", "#ffd9e3", "#f0f5e4", "#dfeac8", "#fff6d6", "#e8f1fb", "#4b3329", "#1f1f1f"];

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function useHtmlImage(src?: string | null) {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!src) {
      setImg(undefined);
      return;
    }
    const i = new window.Image();
    if (!src.startsWith("blob:") && !src.startsWith("data:")) i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.onerror = () => setImg(undefined);
    i.src = src;
    return () => {
      i.onload = null;
    };
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

// Đặt ảnh phủ kín ô và căn giữa
function coverSlot(nw: number, nh: number, w: number, h: number, zoom = 1) {
  const base = Math.max(w / nw, h / nh) * zoom;
  return { dw: nw * base, dh: nh * base };
}

function clipShape(ctx: Konva.Context, shape: Slot["shape"], w: number, h: number) {
  if (shape === "circle") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else ctx.rect(0, 0, w, h);
}

// ---------- Ảnh trong ô ----------
function SlotImage({ slot, W, H, data, selected, onSelect, onChange }: {
  slot: Slot; W: number; H: number; data: SlotData; selected: boolean;
  onSelect: () => void; onChange: (d: SlotData) => void;
}) {
  const img = useHtmlImage(data.src);
  const w = slot.w * W, h = slot.h * H;
  const { dw, dh } = coverSlot(data.nw, data.nh, w, h, data.zoom);
  return (
    <Group x={slot.x * W} y={slot.y * H} rotation={slot.rotation ?? 0} clipFunc={(ctx) => clipShape(ctx, slot.shape, w, h)}>
      {img && (
        <KImage
          image={img} x={data.ox} y={data.oy} width={dw} height={dh} draggable
          onMouseDown={onSelect} onTouchStart={onSelect}
          onDragMove={(e) => {
            const n = e.target;
            n.x(clamp(n.x(), w - dw, 0));
            n.y(clamp(n.y(), h - dh, 0));
          }}
          onDragEnd={(e) => onChange({ ...data, ox: e.target.x(), oy: e.target.y() })}
          onWheel={(e) => {
            e.evt.preventDefault();
            onSelect();
            onChange(zoomSlot(data, slot, W, H, data.zoom * (e.evt.deltaY < 0 ? 1.08 : 1 / 1.08)));
          }}
          opacity={selected ? 0.97 : 1}
        />
      )}
    </Group>
  );
}

function zoomSlot(data: SlotData, slot: Slot, W: number, H: number, zoom: number): SlotData {
  const z = clamp(zoom, 1, 5);
  const w = slot.w * W, h = slot.h * H;
  const old = coverSlot(data.nw, data.nh, w, h, data.zoom);
  const next = coverSlot(data.nw, data.nh, w, h, z);
  // giữ nguyên điểm giữa ô khi phóng to
  const cx = w / 2, cy = h / 2;
  const ox = cx - ((cx - data.ox) * next.dw) / old.dw;
  const oy = cy - ((cy - data.oy) * next.dh) / old.dh;
  return { ...data, zoom: z, ox: clamp(ox, w - next.dw, 0), oy: clamp(oy, h - next.dh, 0) };
}

function centered(src: string, nw: number, nh: number, slot: Slot, W: number, H: number): SlotData {
  const w = slot.w * W, h = slot.h * H;
  const { dw, dh } = coverSlot(nw, nh, w, h);
  return { src, nw, nh, zoom: 1, ox: (w - dw) / 2, oy: (h - dh) / 2 };
}

// ---------- Phần tử tự do: ảnh, sticker, chữ ----------
function FreeNode({ el, fontTick, onSelect, onChange }: { el: FreeEl; fontTick: number; onSelect: () => void; onChange: (e: Partial<FreeEl>) => void }) {
  const img = useHtmlImage(el.kind === "text" ? null : el.src);
  const common = {
    id: el.id, x: el.x, y: el.y, rotation: el.rotation, scaleX: el.scaleX, scaleY: el.scaleY, draggable: true,
    onMouseDown: onSelect, onTouchStart: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      onChange({ x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() });
    },
  };
  if (el.kind === "text") {
    return (
      <Text key={`${el.id}-${fontTick}-${el.fontFamily}`} {...common} text={el.text} fontFamily={el.fontFamily} fontSize={el.fontSize}
        fill={el.fill} align="center" lineHeight={1.15}
        stroke={el.outline ? "#ffffff" : undefined} strokeWidth={el.outline ? (el.fontSize ?? 60) * 0.12 : 0} fillAfterStrokeEnabled />
    );
  }
  return img ? <KImage {...common} image={img} width={el.width} height={el.height} /> : null;
}

// ---------- Đường cắt & vùng an toàn (không xuất ra file) ----------
function Guides({ spec, W, H, s }: { spec: PrintSpec; W: number; H: number; s: number }) {
  const px = (mm: number) => (mm / spec.w) * W;
  const cut = px(spec.cut), safe = px(spec.safe);
  const thin = 1.5 / s;
  const band = "rgba(243,155,180,0.45)";
  if (spec.shape === "disc") {
    const r = W / 2;
    return (
      <Group listening={false}>
        <Ring x={r} y={r} innerRadius={r - cut} outerRadius={r} fill={band} />
        <Circle x={r} y={r} radius={px(spec.hub! / 2)} fill={band} />
        <Circle x={r} y={r} radius={px(spec.hole! / 2)} stroke="#4b3329" strokeWidth={thin} />
        <Circle x={r} y={r} radius={r} stroke="#4b3329" strokeWidth={thin} />
        <Circle x={r} y={r} radius={r - safe} stroke="#ffffff" strokeWidth={thin * 1.5} dash={[8 / s, 6 / s]} />
        <Circle x={r} y={r} radius={px(spec.hub! / 2) + px(2)} stroke="#ffffff" strokeWidth={thin * 1.5} dash={[8 / s, 6 / s]} />
      </Group>
    );
  }
  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={W} height={cut} fill={band} />
      <Rect x={0} y={H - cut} width={W} height={cut} fill={band} />
      <Rect x={0} y={cut} width={cut} height={H - cut * 2} fill={band} />
      <Rect x={W - cut} y={cut} width={cut} height={H - cut * 2} fill={band} />
      <Rect x={safe} y={safe} width={W - safe * 2} height={H - safe * 2} stroke="#ffffff" strokeWidth={thin * 1.5} dash={[8 / s, 6 / s]} shadowColor="#000" shadowOpacity={0.3} shadowBlur={2 / s} />
      {spec.spine && (
        <>
          <Rect x={0} y={0} width={px(spec.spine)} height={H} fill="rgba(75,51,41,0.2)" />
          <Rect x={W - px(spec.spine)} y={0} width={px(spec.spine)} height={H} fill="rgba(75,51,41,0.2)" />
          <Line points={[px(spec.spine), 0, px(spec.spine), H]} stroke="#fff" strokeWidth={thin} dash={[6 / s, 4 / s]} />
          <Line points={[W - px(spec.spine), 0, W - px(spec.spine), H]} stroke="#fff" strokeWidth={thin} dash={[6 / s, 4 / s]} />
        </>
      )}
    </Group>
  );
}

// ================================================================
export function Designer({ ref, spec, width, template, extraTools, active = true }: {
  ref?: React.Ref<DesignerHandle>;
  spec: PrintSpec;
  width: number; // chiều rộng hiển thị (px)
  template: DesignBase | null;
  extraTools?: (api: { addText: (t: string) => void }) => React.ReactNode;
  active?: boolean;
}) {
  const W = mmToPx(spec.w), H = mmToPx(spec.h);
  const s = width / W;
  const slots = useMemo(() => template?.slots ?? [], [template]);

  const stageRef = useRef<Konva.Stage>(null);
  const guidesRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const freeInput = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<number>(-1);

  const [bgColor, setBgColor] = useState(template?.background_color || "#ffffff");
  const [slotData, setSlotData] = useState<Record<number, SlotData>>({});
  const [els, setEls] = useState<FreeEl[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [guides, setGuides] = useState(true);
  const [showStickers, setShowStickers] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [err, setErr] = useState("");

  const overlay = useHtmlImage(template?.overlay_url);
  const bgImg = useHtmlImage(template?.background_url);

  // Đổi mẫu: giữ ảnh đã chọn theo thứ tự ô, căn lại cho vừa ô mới
  useEffect(() => {
    setSlotData((prev) => {
      const next: Record<number, SlotData> = {};
      for (const [k, d] of Object.entries(prev)) {
        const i = Number(k);
        if (slots[i]) next[i] = centered(d.src, d.nw, d.nh, slots[i], W, H);
      }
      return next;
    });
    if (template?.background_color) setBgColor(template.background_color);
    setSel(null);
  }, [slots, template?.background_color, W, H]);

  // Font tải xong → vẽ lại chữ cho đúng
  useEffect(() => {
    document.fonts?.ready.then(() => setFontTick((t) => t + 1));
  }, []);

  // Gắn khung xoay/phóng to vào phần tử đang chọn
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = sel?.type === "el" ? stageRef.current?.findOne(`#${sel.id}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [sel, els, fontTick]);

  const selectedEl = sel?.type === "el" ? els.find((e) => e.id === sel.id) : undefined;
  const updateEl = useCallback((id: string, p: Partial<FreeEl>) => setEls((cur) => cur.map((e) => (e.id === id ? { ...e, ...p } : e))), []);

  function removeSelected() {
    if (sel?.type === "el") setEls((cur) => cur.filter((e) => e.id !== sel.id));
    if (sel?.type === "slot") setSlotData((cur) => { const n = { ...cur }; delete n[sel.index]; return n; });
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

  function pickSlot(index: number) {
    pendingSlot.current = index;
    slotInput.current?.click();
  }

  async function onSlotFile(file: File) {
    const i = pendingSlot.current;
    if (i < 0 || !slots[i]) return;
    const src = URL.createObjectURL(file);
    try {
      const { w, h } = await loadSize(src);
      setSlotData((cur) => ({ ...cur, [i]: centered(src, w, h, slots[i], W, H) }));
      setSel({ type: "slot", index: i });
      setErr("");
    } catch {
      setErr("Không đọc được ảnh này. Bạn thử ảnh JPG/PNG khác nhé.");
    }
  }

  async function addImage(src: string, kind: "image" | "sticker", ratio: number) {
    try {
      const { w, h } = await loadSize(src);
      const target = Math.min(W, H) * ratio;
      const k = target / Math.max(w, h);
      const el: FreeEl = { id: uid(), kind, src, width: w * k, height: h * k, x: (W - w * k) / 2, y: (H - h * k) / 2, rotation: 0, scaleX: 1, scaleY: 1 };
      setEls((cur) => [...cur, el]);
      setSel({ type: "el", id: el.id });
      setErr("");
    } catch {
      setErr("Không đọc được ảnh này.");
    }
  }

  const addText = useCallback((text: string) => {
    const fontSize = Math.round(Math.min(W, H) * (spec.kind === "photostrip" ? 0.11 : 0.08));
    const el: FreeEl = {
      id: uid(), kind: "text", text, fontFamily: "Itim", fontSize, fill: "#4b3329", outline: false,
      x: W * 0.15, y: spec.kind === "photostrip" ? H * 0.88 : H * 0.45, rotation: 0, scaleX: 1, scaleY: 1,
    };
    setEls((cur) => [...cur, el]);
    setSel({ type: "el", id: el.id });
  }, [W, H, spec.kind]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => !Object.keys(slotData).length && !els.length && !template?.overlay_url && !template?.background_url,
    exportBlob: async () => {
      const stage = stageRef.current!;
      const tr = trRef.current;
      tr?.nodes([]);
      guidesRef.current?.visible(false);
      try {
        const canvas = stage.toCanvas({ pixelRatio: W / width });
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
        if (!blob) throw new Error("Không xuất được ảnh");
        return await setPngDpi(blob, 300);
      } catch (e) {
        throw new Error(e instanceof Error && e.name === "SecurityError" ? "Ảnh khung mẫu chặn xuất file (CORS). Báo tiệm giúp nhé!" : e instanceof Error ? e.message : "Lỗi xuất ảnh");
      } finally {
        guidesRef.current?.visible(true);
        setSel(null);
      }
    },
  }), [slotData, els, template, W, width]);

  const deselect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === "bg") setSel(null);
  };

  const isDisc = spec.shape === "disc";
  const discClip = (ctx: Konva.Context) => {
    const r = W / 2;
    ctx.arc(r, r, r, 0, Math.PI * 2, false);
    ctx.moveTo(r + (spec.hole! / 2 / spec.w) * W, r);
    ctx.arc(r, r, (spec.hole! / 2 / spec.w) * W, 0, Math.PI * 2, true);
  };

  const selSlot = sel?.type === "slot" ? sel.index : -1;

  return (
    <div>
      <div className={`mx-auto ${isDisc ? "" : "pop-sm"} bg-[repeating-conic-gradient(#f3e2c3_0_25%,#fffdf8_0_50%)] bg-[length:16px_16px]`}
        style={{ width, height: width * (H / W), borderRadius: isDisc ? "50%" : 4 }}>
        <Stage ref={stageRef} width={width} height={width * (H / W)} scaleX={s} scaleY={s}
          onMouseDown={deselect} onTouchStart={deselect}>
          <Layer>
            <Group clipFunc={isDisc ? discClip : (ctx) => ctx.rect(0, 0, W, H)}>
              <Rect name="bg" width={W} height={H} fill={bgColor} preventDefault={false} />
              {bgImg && (() => {
                const k = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
                return <KImage name="bg" preventDefault={false} image={bgImg} width={bgImg.naturalWidth * k} height={bgImg.naturalHeight * k}
                  x={(W - bgImg.naturalWidth * k) / 2} y={(H - bgImg.naturalHeight * k) / 2} />;
              })()}
              {slots.map((slot, i) =>
                slotData[i] ? (
                  <SlotImage key={slot.id + i} slot={slot} W={W} H={H} data={slotData[i]} selected={selSlot === i}
                    onSelect={() => setSel({ type: "slot", index: i })}
                    onChange={(d) => setSlotData((cur) => ({ ...cur, [i]: d }))} />
                ) : null,
              )}
              {overlay && <KImage image={overlay} width={W} height={H} listening={false} />}
              {els.map((el) => (
                <FreeNode key={el.id} el={el} fontTick={fontTick} onSelect={() => setSel({ type: "el", id: el.id })} onChange={(p) => updateEl(el.id, p)} />
              ))}
            </Group>
            <Transformer ref={trRef} rotateAnchorOffset={24} anchorSize={14} borderStroke="#e2789b" anchorStroke="#e2789b"
              anchorCornerRadius={7} keepRatio enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              ignoreStroke flipEnabled={false} />
          </Layer>

          {/* Lớp hướng dẫn: ô trống, viền chọn, đường cắt — KHÔNG có trong file xuất */}
          <Layer ref={guidesRef}>
            {guides && <Guides spec={spec} W={W} H={H} s={s} />}
            {slots.map((slot, i) => {
              const w = slot.w * W, h = slot.h * H;
              const empty = !slotData[i];
              if (!empty && selSlot !== i) return null;
              const Shape = slot.shape === "circle" ? Ellipse : Rect;
              const shapeProps = slot.shape === "circle" ? { x: w / 2, y: h / 2, radiusX: w / 2, radiusY: h / 2 } : { width: w, height: h };
              return (
                <Group key={slot.id + i} x={slot.x * W} y={slot.y * H} rotation={slot.rotation ?? 0} listening={empty}
                  onMouseDown={(e) => { if (e.evt.button === 0) pickSlot(i); }} onTap={() => pickSlot(i)}>
                  <Shape {...shapeProps} fill={empty ? "rgba(255,255,255,0.55)" : undefined}
                    stroke="#e2789b" strokeWidth={3 / s} dash={[10 / s, 7 / s]} />
                  {empty && (
                    <Text text={"＋\nThêm ảnh"} width={w} height={h} align="center" verticalAlign="middle"
                      fontFamily="Itim" fontSize={Math.max(14 / s, Math.min(w, h) * 0.12)} fill="#7d5c48" lineHeight={1.2} />
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>

      <input ref={slotInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onSlotFile(f); }} />
      <input ref={freeInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addImage(URL.createObjectURL(f), "image", 0.5); }} />

      {err && <p className="mx-auto mt-3 max-w-md rounded-xl bg-pink-100 px-3 py-2 text-center text-sm text-pink-500">{err}</p>}

      {/* ---------- Thanh công cụ ---------- */}
      <div className="mx-auto mt-4 max-w-xl space-y-3">
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn bg-cream-50 !min-h-11 !text-base" onClick={() => freeInput.current?.click()}>＋ Ảnh</button>
          <button className="btn bg-cream-50 !min-h-11 !text-base" onClick={() => addText("Chữ của bạn")}>＋ Chữ</button>
          <button className={`btn !min-h-11 !text-base ${showStickers ? "bg-pink-200" : "bg-cream-50"}`} onClick={() => setShowStickers(!showStickers)}>＋ Sticker</button>
          {extraTools?.({ addText })}
        </div>

        {showStickers && (
          <div className="pop-sm grid grid-cols-5 gap-2 rounded-3xl bg-cream-50 p-3 sm:grid-cols-7">
            {stickers.map((st) => (
              <button key={st.id} className="rounded-2xl p-1 hover:bg-pink-100" onClick={() => addImage(st.src, "sticker", 0.25)} aria-label={`Sticker ${st.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={st.src} alt="" className="h-full w-full" />
              </button>
            ))}
          </div>
        )}

        {/* Bảng chỉnh phần đang chọn */}
        {sel?.type === "slot" && slotData[sel.index] && (
          <div className="pop-sm space-y-3 rounded-3xl bg-matcha-100 p-4">
            <p className="text-sm">Kéo ảnh trong ô để căn chỉnh. Phóng to:</p>
            <input type="range" min={1} max={5} step={0.01} value={slotData[sel.index].zoom} className="w-full accent-pink-400"
              onChange={(e) => { const i = sel.index; setSlotData((cur) => ({ ...cur, [i]: zoomSlot(cur[i], slots[i], W, H, Number(e.target.value)) })); }} />
            <div className="flex flex-wrap gap-2">
              <button className="rounded-full bg-white px-4 py-2 text-sm" onClick={() => pickSlot(sel.index)}>Đổi ảnh</button>
              <button className="rounded-full bg-pink-100 px-4 py-2 text-sm text-pink-500" onClick={removeSelected}>Xoá ảnh</button>
            </div>
          </div>
        )}

        {selectedEl && (
          <div className="pop-sm space-y-3 rounded-3xl bg-matcha-100 p-4">
            {selectedEl.kind === "text" && (
              <>
                <textarea className="field" rows={2} value={selectedEl.text} onChange={(e) => updateEl(selectedEl.id, { text: e.target.value })} />
                <select className="field" value={selectedEl.fontFamily} style={{ fontFamily: selectedEl.fontFamily }}
                  onChange={(e) => { const f = e.target.value; updateEl(selectedEl.id, { fontFamily: f }); document.fonts?.load(`40px "${f}"`).then(() => setFontTick((t) => t + 1)); }}>
                  {FONTS.map((f) => <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>)}
                </select>
                <div className="flex flex-wrap items-center gap-2">
                  {COLORS.map((c) => (
                    <button key={c} aria-label={c} onClick={() => updateEl(selectedEl.id, { fill: c })}
                      className={`h-8 w-8 rounded-full border-2 ${selectedEl.fill === c ? "border-pink-500 ring-2 ring-pink-300" : "border-cocoa-700"}`} style={{ background: c }} />
                  ))}
                  <input type="color" value={selectedEl.fill} onChange={(e) => updateEl(selectedEl.id, { fill: e.target.value })} className="h-8 w-10" aria-label="Màu khác" />
                </div>
                <label className="block text-sm">Cỡ chữ
                  <input type="range" min={Math.round(H * 0.015)} max={Math.round(Math.min(W, H) * 0.3)} value={selectedEl.fontSize}
                    onChange={(e) => updateEl(selectedEl.id, { fontSize: Number(e.target.value) })} className="w-full accent-pink-400" />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={!!selectedEl.outline} onChange={(e) => updateEl(selectedEl.id, { outline: e.target.checked })} /> Viền trắng quanh chữ
                </label>
              </>
            )}
            <p className="text-xs text-cocoa-500">Kéo để di chuyển · kéo góc để phóng to · kéo nút tròn phía trên để xoay.</p>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-full bg-white px-4 py-2 text-sm" onClick={() => moveLayer(1)}>Đưa lên trên</button>
              <button className="rounded-full bg-white px-4 py-2 text-sm" onClick={() => moveLayer(-1)}>Đưa xuống dưới</button>
              <button className="rounded-full bg-white px-4 py-2 text-sm" onClick={() => updateEl(selectedEl.id, { rotation: 0, scaleX: 1, scaleY: 1 })}>Bỏ xoay</button>
              <button className="rounded-full bg-pink-100 px-4 py-2 text-sm text-pink-500" onClick={removeSelected}>Xoá</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm">Màu nền:</span>
          {BG_COLORS.map((c) => (
            <button key={c} aria-label={`Nền ${c}`} onClick={() => setBgColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${bgColor === c ? "border-pink-500 ring-2 ring-pink-300" : "border-cocoa-700"}`} style={{ background: c }} />
          ))}
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-7 w-9" aria-label="Màu nền khác" />
        </div>
        <label className="flex items-center justify-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
          Hiện đường cắt & vùng an toàn <span className="text-xs text-cocoa-400">(không in ra)</span>
        </label>
      </div>
    </div>
  );
}
