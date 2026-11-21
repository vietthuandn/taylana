"use client";
/* Điện thoại: chọn 1 lớp chữ → khung menu nổi dưới đáy đổi thành công cụ chữ (icon + tên, cuộn ngang):
   Sửa chữ · Font · Cỡ chữ · Màu · Căn lề · Đậm · Nghiêng · Thêm tuỳ chỉnh (mở panel Chữ đầy đủ). Popover mở phía trên khung. */
import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Palette, PencilLine, SlidersHorizontal, Type, ALargeSmall } from "lucide-react";
import type { Layer } from "@/lib/scrapbook/types";
import { ToolPop } from "./PhotoToolbar";
import { cx } from "@/components/ui/styles";

const INKS = ["#18181b", "#3f3f46", "#ffffff", "#ff5fa2", "#e63946", "#f4a261", "#2a9d8f", "#1d3557", "#7b2cbf", "#fbbf24"];
type TL = Extract<Layer, { k: "text" | "wish" }>;

export function TextToolbar({ l, begin, patch, onEdit, onFont, onMore }: {
  l: TL; begin: () => void; patch: (v: Partial<Layer>) => void; onEdit: () => void; onFont: () => void; onMore: () => void;
}) {
  const [open, setOpen] = useState<{ id: string; el: HTMLElement } | null>(null);
  const tog = (id: string) => (e: React.MouseEvent<HTMLButtonElement>) => { const el = e.currentTarget; setOpen((o) => (o?.id === id ? null : { id, el })); };
  const cls = "flex min-w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1.5 py-1.5 text-[11px] font-medium text-[#3f3f46] disabled:opacity-40";
  const on = "bg-white text-[var(--c-primary)] shadow-sm";
  const isText = l.k === "text", cut = !!l.cutout;
  const ink = isText ? l.color : l.ink;
  const align = isText ? l.align ?? "center" : "center";
  const set = (v: Partial<Layer>) => { begin(); patch(v); };
  const AlignI = align === "left" ? AlignLeft : align === "right" ? AlignRight : AlignCenter;
  return (
    <>
      <button type="button" onClick={onEdit} className={cls}><PencilLine size={18} /><span>Sửa chữ</span></button>
      <button type="button" onClick={onFont} className={cls}><Type size={18} /><span>Font</span></button>
      {isText && <button type="button" onClick={tog("size")} className={cx(cls, open?.id === "size" && on)}><ALargeSmall size={18} /><span>Cỡ chữ</span></button>}
      {!cut && <button type="button" onClick={tog("ink")} className={cx(cls, open?.id === "ink" && on)}><Palette size={18} style={{ color: ink }} /><span>Màu</span></button>}
      {isText && <button type="button" onClick={() => set({ align: align === "left" ? "center" : align === "center" ? "right" : "left" } as Partial<Layer>)} className={cls}><AlignI size={18} /><span>Căn lề</span></button>}
      {isText && !cut && <button type="button" onClick={() => set({ bold: !l.bold, weight: undefined, family: l.family ?? "Be Vietnam Pro" } as Partial<Layer>)} className={cx(cls, l.bold && on)}><Bold size={18} /><span>Đậm</span></button>}
      {isText && !cut && <button type="button" onClick={() => set({ italic: !l.italic, family: l.family ?? "Be Vietnam Pro" } as Partial<Layer>)} className={cx(cls, l.italic && on)}><Italic size={18} /><span>Nghiêng</span></button>}
      <button type="button" onClick={onMore} className={cls}><SlidersHorizontal size={18} /><span>Tuỳ chỉnh</span></button>
      {open?.id === "size" && isText && (
        <ToolPop anchor={open.el} onClose={() => setOpen(null)} w={260}>
          <label className="block"><span className="mb-1 flex justify-between text-[#52525b]">Cỡ chữ<span className="tabular-nums">{Math.round(l.size * 10) / 10} mm</span></span>
            <input type="range" min={2} max={24} step={0.2} value={l.size} onPointerDown={begin} onChange={(e) => patch({ size: Number(e.target.value) } as Partial<Layer>)} className="w-full accent-[var(--c-primary)]" /></label>
        </ToolPop>
      )}
      {open?.id === "ink" && (
        <ToolPop anchor={open.el} onClose={() => setOpen(null)} w={260}>
          <p className="mb-2 font-semibold">Màu chữ</p>
          <div className="flex flex-wrap items-center gap-2">
            {INKS.map((c) => <button key={c} type="button" onClick={() => set((isText ? { color: c } : { ink: c }) as Partial<Layer>)} aria-label={c} className={cx("h-8 w-8 rounded-full border-2", ink?.toLowerCase() === c ? "border-[var(--c-primary)]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />)}
            <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-[#d4d4d8] bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu riêng">
              <input type="color" value={ink ?? "#18181b"} onChange={(e) => set((isText ? { color: e.target.value } : { ink: e.target.value }) as Partial<Layer>)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu riêng" />
            </label>
          </div>
        </ToolPop>
      )}
    </>
  );
}
