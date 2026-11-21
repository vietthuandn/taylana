"use client";
/* Điện thoại: chọn 1 lớp chữ / lời chúc → khung menu nổi dưới đáy đổi thành công cụ chữ (kiểu Canva).
   Hàng chính: Sửa · Phông chữ · Cỡ chữ · Màu sắc · Định dạng · Giấy  + nút ✓ (bỏ chọn).
   Bấm 1 mục → hàng phụ nằm NGANG ngay phía trên (font hiện bằng chính font đó · màu: tự chọn → màu đã dùng → màu sẵn · căn lề bằng icon).
   Không mục nào mở panel Chữ. */
import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ALargeSmall, Bold, Check, Italic, Keyboard, Palette, Plus, StickyNote, Strikethrough, Type, AlignJustify, Underline, CaseUpper } from "lucide-react";
import type { CutoutFont } from "@/lib/scrapbook/cutout";
import type { Layer, WishCard } from "@/lib/scrapbook/types";
import { knownFont, loadFont, loadFontList, loadPreview, previewFamily } from "@/lib/fonts/load";
import { nearestWeight } from "@/lib/fonts/catalog";
import { WISH_FONT } from "@/lib/scrapbook/render";
import { CARDS, PASTELS } from "./TextTab";
import { cx } from "@/components/ui/styles";

const INKS = ["#18181b", "#3f3f46", "#ffffff", "#ff5fa2", "#e63946", "#f4a261", "#2a9d8f", "#1d3557", "#7b2cbf", "#fbbf24"];
type TL = Extract<Layer, { k: "text" | "wish" }>;
type Tool = "font" | "size" | "ink" | "format" | "paper";

export function TextToolbar({ l, begin, patch, onEdit, onPaper, onDone, used, onCustomColor, cutFonts, previews, usedFonts }: {
  l: TL; begin: () => void; patch: (v: Partial<Layer>) => void; onEdit: () => void; onPaper: (v: WishCard | "none") => void;
  onDone: () => void; used: string[]; onCustomColor: (c: string) => void; // used = màu đã dùng trong thiết kế (hiện trước)
  cutFonts: CutoutFont[]; previews: Record<string, string>; usedFonts: string[]; // font của tiệm (chữ cắt dán) · ảnh xem trước · font đã dùng trong thiết kế ("cut:<id>" | tên font)
}) {
  const [tool, setTool] = useState<Tool | null>(null);
  const isText = l.k === "text", cut = !!l.cutout;
  const ink = (isText ? l.color : l.ink) ?? "#18181b";
  const align = isText ? l.align ?? "center" : "center";
  const set = (v: Partial<Layer>) => { begin(); patch(v); };
  const tog = (t: Tool) => setTool((x) => (x === t ? null : t));

  // ---------- font: danh sách font đang bật, xem trước bằng chính font đó ----------
  const [fams, setFams] = useState<string[]>([]);
  useEffect(() => { if (tool === "font" && !fams.length) loadFontList().then((f) => setFams(f.map((x) => x.family))); }, [tool, fams.length]);
  useEffect(() => { if (tool === "font") fams.forEach((f) => loadPreview(f)); }, [tool, fams]);
  // thứ tự: font đang chọn → font đã dùng trong thiết kế → font của tiệm (chữ cắt dán) → font Google
  const curFam = l.cutout ? `cut:${l.cutout.font}` : l.family ?? (isText ? "" : WISH_FONT);
  const list = [...new Set([curFam, ...usedFonts, ...cutFonts.map((f) => `cut:${f.id}`), ...fams].filter(Boolean))];
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => { if (tool === "font") row.current?.scrollTo({ left: 0 }); }, [tool]);
  async function pickFont(v: string) {
    if (v.startsWith("cut:")) { const c = l.cutout; set({ cutout: { curve: 0, chaos: 0.35, spacing: 0, seed: Math.floor(Math.random() * 1e6), ...(c ?? {}), font: v.slice(4) } } as Partial<Layer>); return; }
    const nf = knownFont(v);
    if (isText) {
      const w = nearestWeight(nf, l.weight ?? (l.bold ? 700 : 400)), it = !!l.italic && (!nf || nf.italic);
      await loadFont(v, w, it);
      set({ cutout: undefined, family: v, weight: l.weight ? w : undefined, italic: it || undefined } as Partial<Layer>);
    } else { await loadFont(v, 400, false); set({ cutout: undefined, family: v } as Partial<Layer>); }
  }
  const fontChip = (f: string) => {
    if (f.startsWith("cut:")) {
      const id = f.slice(4), cf = cutFonts.find((x) => x.id === id);
      return <button key={f} type="button" onClick={() => pickFont(f)} className={cx(chip(f === curFam), "flex items-center")}>
        {previews[id] ? <img src={previews[id]} alt={cf?.name ?? "Chữ cắt dán"} className="max-h-7 w-auto" /> : <span className="whitespace-nowrap">{cf?.name ?? "Chữ cắt dán"}</span>}{/* eslint-disable-line @next/next/no-img-element */}
      </button>;
    }
    return <button key={f} type="button" onClick={() => pickFont(f)} className={cx(chip(f === curFam), "whitespace-nowrap text-[15px]")} style={{ fontFamily: previewFamily(f) }}>{f}</button>;
  };
  useEffect(() => { if (tool === "font") usedFonts.forEach((f) => { if (!f.startsWith("cut:")) loadPreview(f); }); }, [tool, usedFonts]);
  // định dạng: B / I theo font (font không có nét đậm / nghiêng thì tắt)
  const gf = isText ? knownFont(l.family ?? "Be Vietnam Pro") : undefined;
  const canB = isText && !cut && (!gf || gf.weights.some((w) => w >= 600)), canI = isText && !cut && (!gf || gf.italic);
  const bold = isText && (l.weight ? l.weight >= 600 : !!l.bold);

  // ---------- màu: tự chọn → đã dùng → màu sẵn ----------
  const usedC = [...new Set(used.map((c) => c.toLowerCase()))];
  const presets = INKS.filter((c) => !usedC.includes(c));
  const dot = (c: string) => (
    <button key={c} type="button" onClick={() => set((isText ? { color: c } : { ink: c }) as Partial<Layer>)} aria-label={c}
      className={cx("h-10 w-10 shrink-0 rounded-full border-2", ink.toLowerCase() === c ? "border-[var(--c-primary)] ring-2 ring-white" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />
  );

  const cls = "flex min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1.5 py-1.5 text-[11px] font-medium text-[#3f3f46]";
  const on = "bg-white text-[var(--c-primary)] shadow-sm";
  const chip = (a: boolean) => cx("h-10 shrink-0 rounded-[12px] border px-3 text-[13px] font-medium", a ? "border-[var(--c-primary)] bg-white text-[var(--c-primary)]" : "border-transparent bg-white/70 text-[#3f3f46]");
  const sub = tool && (
    <div data-keep-sel className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-[20px] bg-[var(--c-secondary)] p-1.5 shadow-[0_8px_28px_rgb(0_0_0/0.16)]" ref={row}>
      {tool === "font" && list.map(fontChip)}
      {tool === "size" && isText && (
        <label className="flex w-full items-center gap-3 px-2 py-1.5 text-[12px] text-[#52525b]">
          <input type="range" min={2} max={24} step={0.2} value={l.size} onPointerDown={begin} onChange={(e) => patch({ size: Number(e.target.value) } as Partial<Layer>)} className="min-w-0 flex-1 accent-[var(--c-primary)]" />
          <span className="w-14 shrink-0 text-right tabular-nums">{Math.round(l.size * 10) / 10} mm</span>
        </label>
      )}
      {tool === "ink" && (
        <>
          <label className="relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu tự chọn">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#18181b] text-white"><Plus size={14} /></span>
            <input type="color" value={ink} onClick={begin} onChange={(e) => patch((isText ? { color: e.target.value } : { ink: e.target.value }) as Partial<Layer>)} onBlur={(e) => onCustomColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu tự chọn" />
          </label>
          {usedC.map(dot)}
          {usedC.length > 0 && <span className="mx-0.5 h-6 w-px shrink-0 bg-[#d4d4d8]" />}
          {presets.map(dot)}
        </>
      )}
      {tool === "format" && isText && (
        <div className="flex w-full flex-col gap-1.5">
          <div className="grid grid-cols-5 gap-1.5">
            {([["b", Bold, bold, canB, () => set({ bold: !bold, weight: undefined, family: l.family ?? "Be Vietnam Pro" } as Partial<Layer>)],
              ["i", Italic, !!l.italic, canI, () => set({ italic: !l.italic || undefined, family: l.family ?? "Be Vietnam Pro" } as Partial<Layer>)],
              ["u", Underline, !!l.ul, !cut, () => set({ ul: !l.ul || undefined } as Partial<Layer>)],
              ["s", Strikethrough, !!l.strike, !cut, () => set({ strike: !l.strike || undefined } as Partial<Layer>)],
              ["a", CaseUpper, !!l.upper, true, () => set({ upper: !l.upper || undefined } as Partial<Layer>)]] as const).map(([k, I, a, en, fn]) => (
              <button key={k} type="button" disabled={!en} onClick={fn} aria-pressed={a} className={cx("grid h-11 place-items-center rounded-[12px] border disabled:opacity-35", a ? "border-[var(--c-primary)] bg-white text-[var(--c-primary)]" : "border-[#d4d4d8] bg-white/70 text-[#3f3f46]")}><I size={20} /></button>
            ))}
          </div>
          <div className="flex rounded-[14px] bg-white/70 p-1">
            {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, I]) => (
              <button key={a} type="button" onClick={() => set({ align: a } as Partial<Layer>)} aria-label={a} className={cx("grid h-10 flex-1 place-items-center rounded-[10px]", align === a ? "bg-white text-[var(--c-primary)] shadow-sm" : "text-[#3f3f46]")}><I size={20} /></button>
            ))}
          </div>
        </div>
      )}
      {tool === "paper" && (
        <>
          {CARDS.map(([k, name, bg]) => <button key={k} type="button" onClick={() => { if (isText) onPaper(k); else set({ card: k, color: k === l.card ? l.color : bg } as Partial<Layer>); }} className={chip(!isText && l.card === k)}>{name}</button>)}
          <button type="button" onClick={() => { if (!isText) onPaper("none"); }} className={chip(isText)}>Không giấy</button>
          {!isText && <span className="mx-0.5 h-6 w-px shrink-0 bg-[#d4d4d8]" />}
          {!isText && PASTELS.map((c) => <button key={c} type="button" onClick={() => set({ color: c } as Partial<Layer>)} aria-label={c} className={cx("h-10 w-10 shrink-0 rounded-full border-2", l.color.toLowerCase() === c ? "border-[var(--c-primary)] ring-2 ring-white" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />)}
        </>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      {sub}
      <div data-keep-sel className="flex items-center gap-1 rounded-[20px] bg-[var(--c-secondary)] p-1.5 shadow-[0_8px_28px_rgb(0_0_0/0.16)]">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          <button type="button" onClick={() => { setTool(null); onEdit(); }} className={cls}><Keyboard size={18} /><span>Sửa</span></button>
          <button type="button" onClick={() => tog("font")} className={cx(cls, tool === "font" && on)}><Type size={18} /><span>Phông chữ</span></button>
          {isText && <button type="button" onClick={() => tog("size")} className={cx(cls, tool === "size" && on)}><ALargeSmall size={18} /><span>Cỡ chữ</span></button>}
          {!cut && <button type="button" onClick={() => tog("ink")} className={cx(cls, tool === "ink" && on)}><Palette size={18} style={{ color: ink }} /><span>Màu sắc</span></button>}
          {isText && <button type="button" onClick={() => tog("format")} className={cx(cls, tool === "format" && on)}><AlignJustify size={18} /><span>Định dạng</span></button>}
          {(!isText || !cut) && <button type="button" onClick={() => tog("paper")} className={cx(cls, tool === "paper" && on)}><StickyNote size={18} /><span>{isText ? "Thêm giấy" : "Giấy"}</span></button>}
        </div>
        <button type="button" onClick={onDone} aria-label="Xong" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d4d4d8] bg-white text-[#3f3f46]"><Check size={20} /></button>
      </div>
    </div>
  );
}
