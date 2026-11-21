"use client";
/* Thanh công cụ của ẢNH TỰ DO (chỉ icon, tooltip khi rê chuột), theo thứ tự:
   Thay ảnh · Cắt · Xoá nền · Viền · Độ trong suốt · Bo góc · Lật · Tràn viền · Chỉnh màu · Xuống / Lên 1 lớp · Xoá · Thêm (⋯: Đặt làm nền,
   Nhân bản, Căn vị trí, Bóng đổ). Mọi hiệu ứng lưu theo lớp (không sửa ảnh gốc) — vẽ ở lib/scrapbook/render.ts, đúng cả bản in 300 DPI.
   Popover mở ra bằng portal (cố định theo nút), không bị thanh cuộn ngang trên điện thoại cắt mất. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Blend, Copy, Expand,
  FlipHorizontal2, Frame, ImageOff, ImageUp, MoreHorizontal, RefreshCw, Scissors, SlidersHorizontal, SquareRoundCorner, Wallpaper } from "lucide-react";
import { PRESETS, filterCss } from "@/lib/scrapbook/render";
import { imgAr } from "@/lib/scrapbook/edit";
import type { Surface } from "@/lib/scrapbook/surface";
import type { Layer } from "@/lib/scrapbook/types";
import { cx } from "@/components/ui/styles";

type SL = Extract<Layer, { k: "sticker" }>;
type Adj = NonNullable<SL["adj"]>;
const OL = ["#ffffff", "#18181b", "#ff5fa2", "#fde047", "#60a5fa", "#4ade80"];

/** popover cố định theo nút (portal) — dưới nút, thiếu chỗ thì lên trên */
export function ToolPop({ anchor, onClose, children, w = 248 }: { anchor: HTMLElement | null; onClose: () => void; children: React.ReactNode; w?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect(), H = ref.current?.offsetHeight ?? 260, W = window.innerWidth, Hh = window.innerHeight;
    const left = Math.max(8, Math.min(W - w - 8, r.left + r.width / 2 - w / 2)), below = r.bottom + 6;
    setPos({ left, top: below + H <= Hh - 8 ? below : Math.max(8, r.top - 6 - H) });
  }, [anchor, w, children]);
  useEffect(() => {
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", h, true); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("pointerdown", h, true); document.removeEventListener("keydown", k); };
  }, [anchor, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} data-keep-sel className="fixed z-[95] rounded-[10px] border border-[#e5e5e7] bg-white p-3 text-[12px] text-[#18181b] shadow-[0_8px_24px_rgb(0_0_0/0.14)]" style={{ width: w, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      onPointerDown={(e) => e.stopPropagation()}>{children}</div>, document.body);
}
function Slider({ label, value, min, max, step = 1, unit = "", onBegin, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onBegin: () => void; onChange: (v: number) => void }) {
  return (
    <label className="mb-2 block"><span className="mb-1 flex justify-between text-[#52525b]">{label}<span className="tabular-nums">{Math.round(value * 100) / 100}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onBegin} onKeyDown={onBegin} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--c-primary)]" /></label>
  );
}

/** variant: "bar" = thanh bo tròn ở đầu khu làm việc (máy tính, icon + tên) · "mobile" = trong khung menu nổi dưới đáy (icon, tên bên dưới) */
export function PhotoToolbar({ l, S, img, photos, photoUrl, cutting, begin, patch, onCut, onDuplicate, onSetBg, onReplace, onUpload, variant = "bar" }: {
  l: SL; S: Surface; img?: { width: number; height: number }; photos: { id: string; url: string }[]; photoUrl?: string; cutting: boolean;
  begin: () => void; patch: (v: Partial<SL>) => void; onCut: () => void;
  onDuplicate: () => void; onSetBg: () => void; onReplace: (photoId: string) => void; onUpload: (f: File) => void; variant?: "bar" | "mobile";
}) {
  const [open, setOpen] = useState<{ id: string; el: HTMLElement } | null>(null);
  const tog = (id: string) => (e: React.MouseEvent<HTMLButtonElement>) => { const el = e.currentTarget; setOpen((o) => (o?.id === id ? null : { id, el })); };
  const close = () => setOpen(null);
  const set = (v: Partial<SL>) => { begin(); patch(v); };
  const adj: Adj = l.adj ?? {};
  const setAdj = (v: Partial<Adj>) => { const n = { ...adj, ...v }; patch({ adj: Object.values(n).some((x) => x) ? n : undefined }); };
  const ar = imgAr(l, img), w = ar > 1 ? l.s / ar : l.s, h = ar > 1 ? l.s : l.s * ar;
  const fill = (m: "w" | "h" | "all") => {
    if (m === "w") return set({ x: S.w / 2, rot: 0, s: ar > 1 ? S.w * ar : S.w });
    if (m === "h") return set({ y: S.h / 2, rot: 0, s: ar > 1 ? S.h : S.h / ar });
    if (!img) return;
    const t = S.h / S.w, src = img.height / img.width;
    const crop = src > t ? { x: 0, w: 1, h: (t * img.width) / img.height, y: 0 } : { y: 0, h: 1, w: img.height / (t * img.width), x: 0 };
    crop.x = (1 - crop.w) / 2; crop.y = (1 - crop.h) / 2;
    set({ x: S.w / 2, y: S.h / 2, rot: 0, crop, s: Math.max(S.w, S.h) });
  };
  const align = (a: string) => {
    const nx = a === "l" ? w / 2 : a === "r" ? S.w - w / 2 : a === "c" ? S.w / 2 : l.x, ny = a === "t" ? h / 2 : a === "b" ? S.h - h / 2 : a === "m" ? S.h / 2 : l.y;
    set({ x: nx, y: ny });
  };
  const fileIn = useRef<HTMLInputElement>(null);
  const cls = variant === "mobile"
    ? "flex min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1.5 py-1.5 text-[11px] font-medium text-[#3f3f46] disabled:opacity-40"
    : "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium text-[#3f3f46] hover:bg-white/80 disabled:opacity-40";
  const B = (id: string, title: string, icon: React.ReactNode, onClick: React.MouseEventHandler<HTMLButtonElement>, on = false, disabled = false) => (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={cx(cls, (on || open?.id === id) && (variant === "mobile" ? "bg-[var(--c-secondary)] text-[var(--c-primary)]" : "bg-white text-[var(--c-primary)] shadow-sm"))}>{icon}<span>{title}</span></button>
  );
  return (
    <>
      {B("replace", "Thay ảnh", <RefreshCw size={16} />, tog("replace"))}
      {B("cut", "Xoá nền", <Scissors size={16} />, () => { close(); onCut(); }, false, cutting)}
      {B("ol", "Viền", <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3c3 2 7 2 8 6s-3 10-8 12C7 19 3 13 4 9s5-4 8-6z" /></svg>, tog("ol"), !!l.ol?.w)}
      {B("op", "Trong suốt", <Blend size={16} />, tog("op"), l.op != null && l.op < 1)}
      {B("rad", "Bo góc", <SquareRoundCorner size={16} />, tog("rad"), !!l.rad)}
      {B("flip", "Lật", <FlipHorizontal2 size={16} />, tog("flip"), !!(l.fx || l.fy))}
      {B("fill", "Tràn viền", <Expand size={16} />, tog("fill"))}
      {B("adj", "Chỉnh màu", <SlidersHorizontal size={16} />, tog("adj"), !!l.adj)}
      {B("more", "Thêm", <MoreHorizontal size={16} />, tog("more"))}
      <input ref={fileIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { onUpload(f); close(); } }} />

      {open?.id === "replace" && (
        <ToolPop anchor={open.el} onClose={close} w={264}>
          <p className="mb-2 font-semibold">Thay ảnh</p>
          <p className="mb-2 text-[#71717a]">Giữ nguyên vị trí, kích thước và hiệu ứng.</p>
          <div className="mb-2 grid max-h-[180px] grid-cols-4 gap-1.5 overflow-y-auto">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <button key={p.id} type="button" onClick={() => { onReplace(p.id); close(); }} className={cx("aspect-square overflow-hidden rounded-[6px] border", photoUrl === p.url ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/30" : "border-[#e5e5e7]")}><img src={p.url} alt="" className="h-full w-full object-cover" /></button>
            ))}
          </div>
          <button type="button" onClick={() => fileIn.current?.click()} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[var(--c-primary)] font-semibold text-white"><ImageUp size={14} /> Tải ảnh mới</button>
        </ToolPop>
      )}
      {open?.id === "ol" && (
        <ToolPop anchor={open.el} onClose={close} w={232}>
          {(() => { const on = !!l.ol?.w, v = l.ol ?? { w: 6, c: "#ffffff", sh: false }; return (<>
            <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Viền</span>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={on} onChange={(e) => set({ ol: e.target.checked ? { ...v, w: v.w || 6 } : undefined })} className="accent-[var(--c-primary)]" /> Bật</label></div>
            <Slider label="Độ dày" value={on ? v.w : 0} min={0} max={20} unit="px" onBegin={begin} onChange={(n) => patch({ ol: n ? { ...v, w: n } : undefined })} />
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {OL.map((c) => <button key={c} type="button" onClick={() => set({ ol: { ...v, w: v.w || 6, c } })} aria-label={c} className={cx("h-6 w-6 rounded-full border", v.c === c && on ? "ring-2 ring-[var(--c-primary)] ring-offset-1" : "border-[#d4d4d8]")} style={{ background: c }} />)}
              <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-[#d4d4d8] bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu riêng"><input type="color" value={v.c} onChange={(e) => set({ ol: { ...v, w: v.w || 6, c: e.target.value } })} className="absolute inset-0 opacity-0" /></label>
            </div>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!v.sh} disabled={!on} onChange={(e) => set({ ol: { ...v, sh: e.target.checked } })} className="accent-[var(--c-primary)]" /> Bóng đổ nhẹ</label>
          </>); })()}
        </ToolPop>
      )}
      {open?.id === "op" && <ToolPop anchor={open.el} onClose={close} w={220}><Slider label="Độ trong suốt" value={Math.round((1 - (l.op ?? 1)) * 100)} min={0} max={100} unit="%" onBegin={begin} onChange={(n) => patch({ op: n ? 1 - n / 100 : undefined })} /></ToolPop>}
      {open?.id === "rad" && <ToolPop anchor={open.el} onClose={close} w={220}><Slider label="Bo góc" value={Math.round((l.rad ?? 0) * 100)} min={0} max={50} unit="%" onBegin={begin} onChange={(n) => patch({ rad: n ? n / 100 : undefined })} /></ToolPop>}
      {open?.id === "flip" && (
        <ToolPop anchor={open.el} onClose={close} w={200}>
          <button type="button" onClick={() => set({ fx: !l.fx || undefined })} className={cx("mb-1 flex h-8 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#f4f4f5]", l.fx && "text-[var(--c-primary)]")}><FlipHorizontal2 size={15} /> Lật ngang</button>
          <button type="button" onClick={() => set({ fy: !l.fy || undefined })} className={cx("flex h-8 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#f4f4f5]", l.fy && "text-[var(--c-primary)]")}><FlipHorizontal2 size={15} className="rotate-90" /> Lật dọc</button>
        </ToolPop>
      )}
      {open?.id === "fill" && (
        <ToolPop anchor={open.el} onClose={close} w={210}>
          {([["w", "Tràn ngang (rộng bằng bề mặt)"], ["h", "Tràn dọc (cao bằng bề mặt)"], ["all", "Tràn toàn bộ (phủ kín, cắt phần thừa)"]] as const).map(([m, n]) => (
            <button key={m} type="button" onClick={() => { fill(m); close(); }} className="flex min-h-8 w-full items-center rounded-[6px] px-2 py-1 text-left hover:bg-[#f4f4f5]">{n}</button>
          ))}
        </ToolPop>
      )}
      {open?.id === "adj" && (
        <ToolPop anchor={open.el} onClose={close} w={272}>
          <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Chỉnh màu</span><button type="button" onClick={() => set({ adj: undefined })} className="text-[var(--c-primary)]">Đặt lại</button></div>
          <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {PRESETS.map((p) => (
              <button key={p.id || "goc"} type="button" onClick={() => { begin(); setAdj({ preset: p.id || undefined }); }} className="w-12 shrink-0 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className={cx("block aspect-square overflow-hidden rounded-[6px] border", (adj.preset ?? "") === p.id ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/30" : "border-[#e5e5e7]")}>{photoUrl && <img src={photoUrl} alt="" className="h-full w-full object-cover" style={{ filter: p.css || undefined }} />}</span>
                <span className="mt-0.5 block truncate text-[10px]">{p.name}</span>
              </button>
            ))}
          </div>
          <Slider label="Độ sáng" value={adj.b ?? 0} min={-100} max={100} onBegin={begin} onChange={(n) => setAdj({ b: n || undefined })} />
          <Slider label="Tương phản" value={adj.c ?? 0} min={-100} max={100} onBegin={begin} onChange={(n) => setAdj({ c: n || undefined })} />
          <Slider label="Bão hoà" value={adj.s ?? 0} min={-100} max={100} onBegin={begin} onChange={(n) => setAdj({ s: n || undefined })} />
          <Slider label="Ấm / Lạnh" value={adj.t ?? 0} min={-100} max={100} onBegin={begin} onChange={(n) => setAdj({ t: n || undefined })} />
          <Slider label="Làm mờ" value={adj.blur ?? 0} min={0} max={10} step={0.5} onBegin={begin} onChange={(n) => setAdj({ blur: n || undefined })} />
          <p className="text-[10px] text-[#a1a1aa]">Xem trước: <span className="inline-block h-3 w-8 rounded-sm align-middle" style={{ background: "linear-gradient(90deg,#f87171,#facc15,#4ade80,#60a5fa)", filter: filterCss(adj) || undefined }} /></p>
        </ToolPop>
      )}
      {open?.id === "more" && (
        <ToolPop anchor={open.el} onClose={close} w={240}>
          <button type="button" onClick={() => { onSetBg(); close(); }} className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#f4f4f5]"><Wallpaper size={15} /> Đặt làm nền</button>
          <button type="button" onClick={() => { onDuplicate(); close(); }} className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#f4f4f5]"><Copy size={15} /> Nhân bản</button>
          <p className="mb-1 mt-2 font-semibold">Căn vị trí</p>
          <div className="mb-2 grid grid-cols-6 gap-1">
            {([["l", "Trái", AlignStartVertical], ["c", "Giữa", AlignCenterVertical], ["r", "Phải", AlignEndVertical], ["t", "Trên", AlignStartHorizontal], ["m", "Giữa dọc", AlignCenterHorizontal], ["b", "Dưới", AlignEndHorizontal]] as const).map(([a, n, I]) => (
              <button key={a} type="button" title={n} aria-label={n} onClick={() => align(a)} className="grid h-8 place-items-center rounded-[6px] border border-[#e5e5e7] hover:border-[var(--c-primary)]"><I size={15} /></button>
            ))}
          </div>
          {(() => { const sh = l.sh ?? { on: false, blur: 2, d: 1.5, c: "rgba(0,0,0,0.35)" }; const hex = /^#/.test(sh.c) ? sh.c.slice(0, 7) : "#000000"; return (<>
            <label className="mb-1 flex items-center justify-between font-semibold">Bóng đổ <input type="checkbox" checked={!!l.sh?.on} onChange={(e) => set({ sh: { ...sh, on: e.target.checked } })} className="accent-[var(--c-primary)]" /></label>
            {l.sh?.on && <>
              <Slider label="Độ mờ" value={sh.blur} min={0} max={8} step={0.5} unit="mm" onBegin={begin} onChange={(n) => patch({ sh: { ...sh, blur: n } })} />
              <Slider label="Độ lệch" value={sh.d} min={0} max={6} step={0.5} unit="mm" onBegin={begin} onChange={(n) => patch({ sh: { ...sh, d: n } })} />
              <label className="flex items-center gap-2">Màu <input type="color" value={hex} onChange={(e) => set({ sh: { ...sh, c: `${e.target.value}66` } })} className="h-6 w-8" /></label>
            </>}
          </>); })()}
        </ToolPop>
      )}
    </>
  );
}

/** Thanh công cụ của KHUNG ẢNH (ô ảnh) đang chọn — cùng kiểu thanh ảnh: Thay khung · Thay ảnh · Xoá ảnh (ảnh quay về "Ảnh của bạn") */
export function SlotToolbar({ hasPhoto, canPhoto, photos, photoUrl, onFrame, onPick, onUpload, onClear, variant = "bar" }: {
  hasPhoto: boolean; canPhoto: boolean; photos: { id: string; url: string }[]; photoUrl?: string;
  onFrame: () => void; onPick: (photoId: string) => void; onUpload: (f: File) => void; onClear: () => void; variant?: "bar" | "mobile";
}) {
  const [open, setOpen] = useState<HTMLElement | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const cls = variant === "mobile"
    ? "flex min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1.5 py-1.5 text-[11px] font-medium text-[#3f3f46] disabled:opacity-40"
    : "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium text-[#3f3f46] hover:bg-white/80 disabled:opacity-40";
  return (
    <>
      <button type="button" title="Thay khung" aria-label="Thay khung" onClick={onFrame} className={cls}><Frame size={16} /><span>Thay khung</span></button>
      {canPhoto && <button type="button" title="Thay ảnh" aria-label="Thay ảnh" onClick={(e) => { const el = e.currentTarget; setOpen((o) => (o ? null : el)); }} className={cx(cls, open && (variant === "mobile" ? "bg-[var(--c-secondary)] text-[var(--c-primary)]" : "bg-white text-[var(--c-primary)] shadow-sm"))}><RefreshCw size={16} /><span>{hasPhoto ? "Thay ảnh" : "Chọn ảnh"}</span></button>}
      {canPhoto && <button type="button" title="Xoá ảnh khỏi khung" aria-label="Xoá ảnh" onClick={onClear} disabled={!hasPhoto} className={cls}><ImageOff size={16} /><span>Xoá ảnh</span></button>}
      <input ref={fileIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { onUpload(f); setOpen(null); } }} />
      {open && (
        <ToolPop anchor={open} onClose={() => setOpen(null)} w={264}>
          <p className="mb-2 font-semibold">{hasPhoto ? "Thay ảnh trong khung" : "Chọn ảnh cho khung"}</p>
          {photos.length > 0 && (
            <div className="mb-2 grid max-h-[180px] grid-cols-4 gap-1.5 overflow-y-auto">
              {photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <button key={p.id} type="button" onClick={() => { onPick(p.id); setOpen(null); }} className={cx("aspect-square overflow-hidden rounded-[6px] border", photoUrl === p.url ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/30" : "border-[#e5e5e7]")}><img src={p.url} alt="" className="h-full w-full object-cover" /></button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => fileIn.current?.click()} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[var(--c-primary)] font-semibold text-white"><ImageUp size={14} /> Tải ảnh mới</button>
        </ToolPop>
      )}
    </>
  );
}
