"use client";
/* Điện thoại: bấm vào NỀN (chỗ trống trên bề mặt) → khung menu nổi dưới đáy đổi thành công cụ nền (kiểu Canva):
   Màu sắc (tự chọn → màu đã dùng trong thiết kế → màu có sẵn) · Kiểu giấy · Texture giấy (mở panel to) · Ảnh nền (ảnh hiện tại, độ mờ, xoá) + ✓. */
import { useRef, useState } from "react";
import { Check, Grid3x3, ImageIcon, Layers, Palette, Plus, Trash2 } from "lucide-react";
import type { Bg } from "@/lib/scrapbook/types";
import { BG_COLORS, PATTERNS } from "./BgTab";
import { cx } from "@/components/ui/styles";

type Tool = "color" | "pattern" | "image";
export function BgToolbar({ bg, preview, used, onSet, onBegin, onUpload, onCustomColor, onTexture, onDone }: {
  bg: Bg; preview?: string; used: string[]; onSet: (v: Partial<Bg>) => void; onBegin: () => void; onUpload: (f: File) => Promise<string>;
  onCustomColor: (c: string) => void; onTexture: () => void; onDone: () => void;
}) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [busy, setBusy] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const tog = (t: Tool) => setTool((x) => (x === t ? null : t));
  const usedC = [...new Set(used.map((c) => c.toLowerCase()))];
  const presets = BG_COLORS.filter((c) => !usedC.includes(c));
  const dot = (c: string) => (
    <button key={c} type="button" onClick={() => onSet({ color: c, inkL: bg.inkL ?? 0 })} aria-label={c}
      className={cx("h-10 w-10 shrink-0 rounded-full border-2", bg.color.toLowerCase() === c ? "border-[var(--c-primary)] ring-2 ring-white" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />
  );
  const cls = "flex min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1.5 py-1.5 text-[11px] font-medium text-[#3f3f46]";
  const on = "bg-white text-[var(--c-primary)] shadow-sm";
  const chip = (a: boolean) => cx("h-10 shrink-0 rounded-[12px] border px-3 text-[13px] font-medium", a ? "border-[var(--c-primary)] bg-white text-[var(--c-primary)]" : "border-transparent bg-white/70 text-[#3f3f46]");
  return (
    <div className="flex flex-col gap-2">
      {tool && (
        <div data-keep-sel className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-[20px] bg-[var(--c-secondary)] p-1.5 shadow-[0_8px_28px_rgb(0_0_0/0.16)]">
          {tool === "color" && (
            <>
              <label className="relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu tự chọn">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#18181b] text-white"><Plus size={14} /></span>
                <input type="color" value={bg.color} onClick={onBegin} onChange={(e) => onSet({ color: e.target.value, inkL: bg.inkL ?? 0 })} onBlur={(e) => onCustomColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu tự chọn" />
              </label>
              {usedC.map(dot)}
              {usedC.length > 0 && <span className="mx-0.5 h-6 w-px shrink-0 bg-[#d4d4d8]" />}
              {presets.map(dot)}
            </>
          )}
          {tool === "pattern" && PATTERNS.map(([k, l]) => <button key={k} type="button" onClick={() => onSet({ pattern: k, inkL: bg.inkL ?? 0 })} className={chip(bg.pattern === k)}>{l}</button>)}
          {tool === "image" && (
            <div className="flex w-full items-center gap-2.5 px-1">
              <button type="button" onClick={() => fileIn.current?.click()} disabled={busy} aria-label={bg.image ? "Thay ảnh nền" : "Tải ảnh nền"}
                className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-white text-[11px] text-[#52525b]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="grid place-items-center gap-0.5"><ImageIcon size={16} />{busy ? "Đang tải" : "Tải ảnh"}</span>}
              </button>
              {bg.image ? (
                <>
                  <label className="min-w-0 flex-1 text-[12px] text-[#52525b]">
                    <span className="flex justify-between">Độ mờ<span className="tabular-nums">{Math.round((bg.imageOpacity ?? 1) * 100)}%</span></span>
                    <input type="range" min={10} max={100} step={5} value={Math.round((bg.imageOpacity ?? 1) * 100)} onPointerDown={onBegin} onChange={(e) => onSet({ imageOpacity: Number(e.target.value) / 100 })} className="w-full accent-[var(--c-primary)]" />
                  </label>
                  <button type="button" onClick={() => onSet({ image: undefined, imageOpacity: undefined })} aria-label="Xoá ảnh nền" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#dc2626]"><Trash2 size={17} /></button>
                </>
              ) : <span className="text-[12px] text-[#71717a]">Ảnh phủ kín bề mặt</span>}
              <input ref={fileIn} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                setBusy(true);
                try { onSet({ image: await onUpload(f), imageOpacity: bg.imageOpacity ?? 1 }); } catch { /* lỗi tải ảnh */ }
                setBusy(false);
              }} />
            </div>
          )}
        </div>
      )}
      <div data-keep-sel className="flex items-center gap-1 rounded-[20px] bg-[var(--c-secondary)] p-1.5 shadow-[0_8px_28px_rgb(0_0_0/0.16)]">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          <button type="button" onClick={() => tog("color")} className={cx(cls, tool === "color" && on)}><Palette size={18} style={{ color: bg.color === "#ffffff" ? undefined : bg.color }} /><span>Màu sắc</span></button>
          <button type="button" onClick={() => tog("pattern")} className={cx(cls, tool === "pattern" && on)}><Grid3x3 size={18} /><span>Kiểu giấy</span></button>
          <button type="button" onClick={() => { setTool(null); onTexture(); }} className={cls}><Layers size={18} /><span>Texture giấy</span></button>
          <button type="button" onClick={() => tog("image")} className={cx(cls, tool === "image" && on)}><ImageIcon size={18} /><span>Ảnh nền</span></button>
        </div>
        <button type="button" onClick={onDone} aria-label="Xong" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d4d4d8] bg-white text-[#3f3f46]"><Check size={20} /></button>
      </div>
    </div>
  );
}
