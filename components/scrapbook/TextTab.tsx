"use client";

/* CD Scrapbook → tab "Chữ": danh sách các lớp chữ trên đĩa (gồm chữ có sẵn của mẫu) + "Thêm chữ".
   Sửa lớp đang chọn: nội dung (nhiều dòng), font thường (cỡ, màu, đậm, nghiêng, viền trắng)
   hoặc chữ cắt dán (cỡ, thẳng / cong, độ cong, độ lộn xộn, khoảng cách, đổi mảnh). */
import { Dices, Plus, Trash2 } from "lucide-react";
import type { CutoutFont } from "@/lib/scrapbook/cutout";
import type { DiscText, Layer } from "@/lib/scrapbook/types";
import { textOf } from "@/lib/scrapbook/render";
import { cx } from "@/components/ui/styles";

type T = Extract<Layer, { k: "text" }>;
export const FAMILIES = ["Dancing Script", "Patrick Hand", "Pangolin", "Itim", "Be Vietnam Pro", "Oswald"];
const COLORS = ["#18181b", "#ffffff", "#ff5fa2", "#e63946", "#f4a261", "#2a9d8f", "#1d3557", "#7b2cbf"];

export function TextTab({ layers, sel, text, fonts, previews, onSelect, onAdd, onRemove, onPatch, onBegin, onText }: {
  layers: Layer[]; sel: number | null; text: DiscText; fonts: CutoutFont[]; previews: Record<string, string>;
  onSelect: (i: number) => void; onAdd: () => void; onRemove: (i: number) => void;
  onPatch: (i: number, v: Partial<T>) => void; onBegin: () => void; // onBegin: lưu mốc hoàn tác trước khi kéo thanh trượt / gõ
  onText: (role: "main" | "sub", v: string) => void;
}) {
  const list = layers.map((l, i) => ({ l, i })).filter((x) => x.l.k === "text" && !x.l.locked) as { l: T; i: number }[];
  const cur = sel !== null && layers[sel]?.k === "text" ? (layers[sel] as T) : null;
  const value = cur ? textOf(cur, text) : "";
  const fontValue = cur?.cutout ? `cut:${cur.cutout.font}` : cur?.family ?? "";
  const toggle = (on: boolean) => cx("h-8 min-w-[36px] rounded-[6px] border px-2 text-[13px]", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b]");
  return (
    <div className="space-y-4">
      <button type="button" onClick={onAdd} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] border-[1.5px] border-dashed border-[#d4d4d8] text-[14px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Plus size={16} /> Thêm chữ</button>
      <ul className="space-y-1">
        {list.map(({ l, i }) => (
          <li key={i} className={cx("flex items-center gap-2 rounded-[8px] border px-2 py-1.5", sel === i ? "border-[#ff5fa2] bg-[#fff5f9]" : "border-[#e5e5e7]")}>
            <button type="button" onClick={() => onSelect(i)} className="min-w-0 flex-1 truncate text-left text-[13px]">
              {textOf(l, text).replace(/\n/g, " / ") || <span className="text-[#a1a1aa]">(trống)</span>}
              <span className="ml-1 text-[11px] text-[#a1a1aa]">{l.cutout ? "· cắt dán" : l.role === "custom" ? "" : "· chữ của mẫu"}</span>
            </button>
            <button type="button" onClick={() => onRemove(i)} aria-label="Xoá lớp chữ" className="text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>

      {cur && sel !== null && (
        <div className="space-y-3 rounded-[10px] border border-[#e5e5e7] p-3">
          <textarea value={value} rows={2} onFocus={onBegin} maxLength={120} placeholder="Nội dung"
            onChange={(e) => (cur.role === "custom" ? onPatch(sel, { value: e.target.value }) : onText(cur.role, e.target.value))}
            className="w-full rounded-[8px] border border-[#e5e5e7] px-3 py-2 text-[14px] outline-none focus:border-[#ff5fa2]" />
          <label className="block text-[12px] text-[#52525b]">Font
            <select value={fontValue} onChange={(e) => {
              onBegin();
              const v = e.target.value;
              if (v.startsWith("cut:")) onPatch(sel, { cutout: { font: v.slice(4), curve: cur.cutout?.curve ?? 0, chaos: cur.cutout?.chaos ?? 0.35, spacing: cur.cutout?.spacing ?? 0, seed: cur.cutout?.seed ?? Math.floor(Math.random() * 1e6) }, size: Math.max(cur.size, 6), arc: undefined });
              else onPatch(sel, { cutout: undefined, family: v || undefined });
            }} className="mt-1 h-9 w-full rounded-[8px] border border-[#e5e5e7] px-2 text-[14px]">
              <optgroup label="Font thường">
                {cur.role !== "custom" && <option value="">Theo mẫu</option>}
                {FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </optgroup>
              {fonts.length > 0 && <optgroup label="Chữ cắt dán">{fonts.map((f) => <option key={f.id} value={`cut:${f.id}`}>{f.name}</option>)}</optgroup>}
            </select>
          </label>
          {fonts.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {fonts.map((f) => (
                <button key={f.id} type="button" title={f.name} onClick={() => { onBegin(); onPatch(sel, { cutout: { font: f.id, curve: cur.cutout?.curve ?? 0, chaos: cur.cutout?.chaos ?? 0.35, spacing: cur.cutout?.spacing ?? 0, seed: cur.cutout?.seed ?? Math.floor(Math.random() * 1e6) }, size: Math.max(cur.size, 6), arc: undefined }); }}
                  className={cx("grid h-12 place-items-center overflow-hidden rounded-[8px] border bg-[#fafafa] px-1", cur.cutout?.font === f.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/25" : "border-[#e5e5e7]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {previews[f.id] ? <img src={previews[f.id]} alt={f.name} className="max-h-10 max-w-full" /> : <span className="text-[12px]">{f.name}</span>}
                </button>
              ))}
            </div>
          )}

          {!cur.cutout ? (
            <>
              <Range label="Cỡ chữ" value={cur.size} min={2} max={16} step={0.2} unit="mm" onBegin={onBegin} onChange={(v) => onPatch(sel, { size: v, w: Math.max(cur.w, v * 10) })} />
              <div className="flex flex-wrap items-center gap-1.5">
                {COLORS.map((c) => <button key={c} type="button" onClick={() => onPatch(sel, { color: c })} aria-label={c} className={cx("h-7 w-7 rounded-full border-2", cur.color === c ? "border-[#ff5fa2]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />)}
                <input type="color" value={cur.color} onChange={(e) => onPatch(sel, { color: e.target.value })} aria-label="Màu tuỳ chọn" className="h-7 w-9" />
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => onPatch(sel, { bold: !cur.bold, family: cur.family ?? "Be Vietnam Pro" })} className={cx(toggle(!!cur.bold), "font-bold")}>B</button>
                <button type="button" onClick={() => onPatch(sel, { italic: !cur.italic, family: cur.family ?? "Be Vietnam Pro" })} className={cx(toggle(!!cur.italic), "italic")}>I</button>
                <button type="button" onClick={() => onPatch(sel, { stroke: !cur.stroke })} className={toggle(!!cur.stroke)}>Viền trắng</button>
              </div>
            </>
          ) : (
            <>
              <Range label="Cỡ chữ (chiều cao mảnh)" value={cur.size} min={4} max={20} step={0.5} unit="mm" onBegin={onBegin} onChange={(v) => onPatch(sel, { size: v })} />
              <div className="flex gap-1.5">
                <button type="button" onClick={() => onPatch(sel, { cutout: { ...cur.cutout!, curve: 0 } })} className={toggle(cur.cutout.curve === 0)}>Thẳng hàng</button>
                <button type="button" onClick={() => onPatch(sel, { cutout: { ...cur.cutout!, curve: cur.cutout!.curve || 0.4 } })} className={toggle(cur.cutout.curve !== 0)}>Cong</button>
              </div>
              {cur.cutout.curve !== 0 && <Range label="Độ cong (− nụ cười · + cầu vồng)" value={Math.round(cur.cutout.curve * 100)} min={-100} max={100} step={1} unit="%" onBegin={onBegin} onChange={(v) => onPatch(sel, { cutout: { ...cur.cutout!, curve: v / 100 || 0.01 } })} />}
              <Range label="Độ lộn xộn" value={Math.round(cur.cutout.chaos * 100)} min={0} max={100} step={1} unit="%" onBegin={onBegin} onChange={(v) => onPatch(sel, { cutout: { ...cur.cutout!, chaos: v / 100 } })} />
              <Range label="Khoảng cách chữ" value={cur.cutout.spacing} min={-2} max={6} step={0.25} unit="mm" onBegin={onBegin} onChange={(v) => onPatch(sel, { cutout: { ...cur.cutout!, spacing: v } })} />
              <button type="button" onClick={() => { onBegin(); onPatch(sel, { cutout: { ...cur.cutout!, seed: Math.floor(Math.random() * 1e6) } }); }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /> Đổi mảnh</button>
            </>
          )}
        </div>
      )}
      <p className="text-[12px] text-[#a1a1aa]">Trên đĩa: bấm chữ để chọn, kéo để di chuyển, kéo góc để đổi cỡ, núm tròn để xoay.</p>
    </div>
  );
}

function Range({ label, value, min, max, step, unit, onChange, onBegin }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; onBegin: () => void }) {
  return (
    <label className="block text-[12px] text-[#52525b]">
      <span className="flex justify-between">{label}<span className="tabular-nums">{Math.round(value * 100) / 100}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onBegin} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#ff5fa2]" />
    </label>
  );
}
