"use client";
/* Chế độ sửa ẢNH NỀN (bấm đúp vào ảnh nền): kéo để dịch, cuộn / thanh trượt để phóng · Thay ảnh nền · Độ trong suốt · Chỉnh màu ·
   Lật · Tách khỏi nền (thành lớp ảnh thường) · Xoá nền · Xong (hoặc bấm ra ngoài bề mặt). */
import { useRef, useState } from "react";
import { FlipHorizontal2, ImageUp, Layers, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Bg } from "@/lib/scrapbook/types";
import { PRESETS } from "@/lib/scrapbook/render";
import { ToolPop } from "./PhotoToolbar";
import { cx } from "@/components/ui/styles";

const ib = "grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-[#3f3f46] hover:bg-[#f4f4f5] max-md:h-11 max-md:w-11";
export function BgEditBar({ bg, onPatch, onBegin, onUpload, onDetach, onDone }: {
  bg: Bg; onPatch: (v: Partial<Bg>) => void; onBegin: () => void; onUpload: (f: File) => void; onDetach: () => void; onDone: () => void;
}) {
  const [open, setOpen] = useState<{ id: string; el: HTMLElement } | null>(null);
  const tog = (id: string) => (e: React.MouseEvent<HTMLButtonElement>) => { const el = e.currentTarget; setOpen((o) => (o?.id === id ? null : { id, el })); };
  const fileIn = useRef<HTMLInputElement>(null);
  const adj = bg.iadj ?? {};
  const setAdj = (v: Partial<NonNullable<Bg["iadj"]>>) => { const n = { ...adj, ...v }; onPatch({ iadj: Object.values(n).some((x) => x) ? n : undefined }); };
  const S = (label: string, value: number, min: number, max: number, step: number, on: (v: number) => void) => (
    <label className="mb-2 block"><span className="mb-1 flex justify-between text-[#52525b]">{label}<span className="tabular-nums">{Math.round(value * 100) / 100}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onBegin} onChange={(e) => on(Number(e.target.value))} className="w-full accent-[var(--c-primary)]" /></label>
  );
  return (
    <div data-bg-bar className="absolute left-1/2 top-2 z-50 flex max-w-[calc(100%-8px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-full bg-white/95 px-2 py-1 text-[12px] shadow" onPointerDown={(e) => e.stopPropagation()}>
      <span className="hidden whitespace-nowrap px-1 text-[#52525b] sm:inline">Kéo để dịch nền</span>
      <input type="range" min={0.5} max={4} step={0.01} value={bg.iz ?? 1} onPointerDown={onBegin} onChange={(e) => onPatch({ iz: Number(e.target.value) })} aria-label="Phóng ảnh nền" className="w-20 shrink-0 accent-[var(--c-primary)]" />
      <button type="button" title="Thay ảnh nền" aria-label="Thay ảnh nền" onClick={() => fileIn.current?.click()} className={ib}><ImageUp size={16} /></button>
      <button type="button" title="Độ trong suốt" aria-label="Độ trong suốt" onClick={tog("op")} className={cx(ib, open?.id === "op" && "bg-[var(--c-secondary)]")}><span className="text-[11px] font-bold">%</span></button>
      <button type="button" title="Chỉnh màu" aria-label="Chỉnh màu" onClick={tog("adj")} className={cx(ib, (open?.id === "adj" || bg.iadj) && "text-[var(--c-primary)]")}><SlidersHorizontal size={16} /></button>
      <button type="button" title="Lật" aria-label="Lật" onClick={tog("flip")} className={cx(ib, (bg.ifx || bg.ify) && "text-[var(--c-primary)]")}><FlipHorizontal2 size={16} /></button>
      <button type="button" title="Tách khỏi nền (thành lớp ảnh)" aria-label="Tách khỏi nền" onClick={onDetach} className={ib}><Layers size={16} /></button>
      <button type="button" title="Xoá ảnh nền" aria-label="Xoá ảnh nền" onClick={() => { onBegin(); onPatch({ image: undefined, ix: undefined, iy: undefined, iz: undefined, ifx: undefined, ify: undefined, iadj: undefined }); onDone(); }} className={cx(ib, "text-[#dc2626] hover:bg-[#fef2f2]")}><Trash2 size={16} /></button>
      <button type="button" onClick={onDone} className="ml-1 shrink-0 rounded-full bg-[var(--c-primary)] px-3 py-1 font-medium text-white">Xong</button>
      <input ref={fileIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
      {open?.id === "op" && <ToolPop anchor={open.el} onClose={() => setOpen(null)} w={220}>{S("Độ trong suốt (%)", Math.round((1 - (bg.imageOpacity ?? 1)) * 100), 0, 100, 1, (n) => onPatch({ imageOpacity: 1 - n / 100 }))}</ToolPop>}
      {open?.id === "flip" && (
        <ToolPop anchor={open.el} onClose={() => setOpen(null)} w={200}>
          <button type="button" onClick={() => { onBegin(); onPatch({ ifx: !bg.ifx || undefined }); }} className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#f4f4f5]"><FlipHorizontal2 size={15} /> Lật ngang</button>
          <button type="button" onClick={() => { onBegin(); onPatch({ ify: !bg.ify || undefined }); }} className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#f4f4f5]"><FlipHorizontal2 size={15} className="rotate-90" /> Lật dọc</button>
        </ToolPop>
      )}
      {open?.id === "adj" && (
        <ToolPop anchor={open.el} onClose={() => setOpen(null)} w={260}>
          <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Chỉnh màu nền</span><button type="button" onClick={() => { onBegin(); onPatch({ iadj: undefined }); }} className="text-[var(--c-primary)]">Đặt lại</button></div>
          <div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto">{PRESETS.map((p) => <button key={p.id || "goc"} type="button" onClick={() => { onBegin(); setAdj({ preset: p.id || undefined }); }} className={cx("h-7 shrink-0 rounded-full border px-2", (adj.preset ?? "") === p.id ? "border-[var(--c-primary)] text-[var(--c-primary)]" : "border-[#e5e5e7]")}>{p.name}</button>)}</div>
          {S("Độ sáng", adj.b ?? 0, -100, 100, 1, (n) => setAdj({ b: n || undefined }))}
          {S("Tương phản", adj.c ?? 0, -100, 100, 1, (n) => setAdj({ c: n || undefined }))}
          {S("Bão hoà", adj.s ?? 0, -100, 100, 1, (n) => setAdj({ s: n || undefined }))}
          {S("Ấm / Lạnh", adj.t ?? 0, -100, 100, 1, (n) => setAdj({ t: n || undefined }))}
          {S("Làm mờ", adj.blur ?? 0, 0, 10, 0.5, (n) => setAdj({ blur: n || undefined }))}
        </ToolPop>
      )}
    </div>
  );
}
