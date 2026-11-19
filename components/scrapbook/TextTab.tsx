"use client";

/* Scrapbook → tab "Chữ" (mỗi lúc chỉ làm 1 việc), từ trên xuống:
   1. "+ Thêm chữ" (nút chính): chữ mẫu ở vùng trống lớn nhất, chọn luôn + sửa trực tiếp trên trang.
   2. "Cài đặt chữ": CHỈ hiện khi đang chọn 1 lớp chữ / khung lời chúc — font (thường / cắt dán), cỡ, màu, đậm / nghiêng,
      căn lề, khoảng cách dòng, khoảng cách chữ; cut-out thêm kiểu xếp, độ cong, độ lộn xộn, "Đổi mảnh". Cuối: Nhân bản · Xoá.
   3. "Lời chúc có sẵn": khối thu gọn, mặc định đóng. Mở khối → bỏ chọn lớp chữ (ẩn Cài đặt chữ). */
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, Copy, Dices, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { CutoutFont } from "@/lib/scrapbook/cutout";
import type { Layer, Wish, WishCard, WishTopic } from "@/lib/scrapbook/types";
import { WISH_FONT } from "@/lib/scrapbook/render";
import { cx } from "@/components/ui/styles";

type T = Extract<Layer, { k: "text" }>;
type WL = Extract<Layer, { k: "wish" }>;
const CARDS: [WishCard, string, string][] = [["card", "Thiệp nhỏ", "#ffffff"], ["note", "Giấy note", "#fff3a8"], ["lined", "Giấy kẻ dòng", "#fffdf6"], ["label", "Nhãn", "#ffffff"]];
export const FAMILIES = ["Dancing Script", "Patrick Hand", "Pangolin", "Itim", "Be Vietnam Pro", "Oswald"];
const COLORS = ["#18181b", "#3f3f46", "#ffffff", "#ff5fa2", "#e63946", "#f4a261", "#2a9d8f", "#1d3557", "#7b2cbf"];

export function TextTab({ layer, fonts, previews, onAdd, onPatch, onBegin, onDuplicate, onRemove, topics, wishes, onWish, wishOpen, onWishOpen }: {
  layer: Layer | null; fonts: CutoutFont[]; previews: Record<string, string>;
  onAdd: () => void; onPatch: (v: Partial<T> | Partial<WL>) => void; onBegin: () => void; // onBegin: lưu mốc hoàn tác trước khi kéo thanh trượt
  onDuplicate: () => void; onRemove: () => void;
  topics?: WishTopic[]; wishes?: Wish[]; onWish?: (content: string) => void; wishOpen: boolean; onWishOpen: (v: boolean) => void;
}) {
  const [topic, setTopic] = useState<string | null>(null);
  const cur = layer?.k === "text" ? layer : null, wl = layer?.k === "wish" ? layer : null;
  const curTopic = topic ?? topics?.[0]?.id ?? null;
  const toggle = (on: boolean) => cx("grid h-8 min-w-[34px] place-items-center rounded-[6px] border px-2 text-[13px]", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b]");
  const cutOpts = (seed?: number) => ({ font: "", curve: 0, chaos: 0.35, spacing: 0, seed: seed ?? Math.floor(Math.random() * 1e6) });
  const showSettings = !wishOpen && (cur || wl);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onAdd} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#ff5fa2] text-[14px] font-semibold text-white hover:bg-[#f0468f]"><Plus size={17} /> Thêm chữ</button>

      {showSettings && (
        <section className="space-y-3 rounded-[10px] border border-[#e5e5e7] p-3">
          <p className="text-[13px] font-semibold">Cài đặt chữ</p>
          {/* font */}
          <label className="block text-[12px] text-[#52525b]">Font
            <select value={(cur ?? wl)!.cutout ? `cut:${(cur ?? wl)!.cutout!.font}` : (cur ?? wl)!.family ?? (wl ? WISH_FONT : "")} onChange={(e) => {
              onBegin();
              const v = e.target.value, c = (cur ?? wl)!.cutout;
              if (v.startsWith("cut:")) onPatch({ cutout: { ...cutOpts(c?.seed), ...(c ?? {}), font: v.slice(4) } });
              else onPatch({ cutout: undefined, family: v || undefined });
            }} className="mt-1 h-9 w-full rounded-[8px] border border-[#e5e5e7] px-2 text-[14px]">
              <optgroup label="Font thường">
                {cur && !cur.family && <option value="">Theo mẫu</option>}
                {(wl ? [WISH_FONT, ...FAMILIES.filter((f) => f !== WISH_FONT)] : FAMILIES).map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </optgroup>
              {fonts.length > 0 && <optgroup label="Chữ cắt dán">{fonts.map((f) => <option key={f.id} value={`cut:${f.id}`}>{f.name}</option>)}</optgroup>}
            </select>
          </label>
          {fonts.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {fonts.map((f) => (
                <button key={f.id} type="button" title={f.name} onClick={() => { onBegin(); const c = (cur ?? wl)!.cutout; onPatch({ cutout: { ...cutOpts(c?.seed), ...(c ?? {}), font: f.id } }); }}
                  className={cx("grid h-10 place-items-center overflow-hidden rounded-[8px] border bg-[#fafafa] px-1", (cur ?? wl)!.cutout?.font === f.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/25" : "border-[#e5e5e7]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {previews[f.id] ? <img src={previews[f.id]} alt={f.name} className="max-h-8 max-w-full" /> : <span className="truncate text-[11px]">{f.name}</span>}
                </button>
              ))}
            </div>
          )}

          {cur && (
            <>
              <Range label={cur.cutout ? "Cỡ chữ (chiều cao mảnh)" : "Cỡ chữ"} value={cur.size} min={2} max={24} step={0.2} unit="mm" onBegin={onBegin} onChange={(v) => onPatch({ size: v })} />
              {!cur.cutout && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {COLORS.map((c) => <button key={c} type="button" onClick={() => { onBegin(); onPatch({ color: c }); }} aria-label={c} className={cx("h-7 w-7 rounded-full border-2", cur.color === c ? "border-[#ff5fa2]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />)}
                  <input type="color" value={cur.color} onChange={(e) => onPatch({ color: e.target.value })} aria-label="Màu tuỳ chọn" className="h-7 w-9" />
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {!cur.cutout && (
                  <>
                    <button type="button" onClick={() => { onBegin(); onPatch({ bold: !cur.bold, family: cur.family ?? "Be Vietnam Pro" }); }} className={cx(toggle(!!cur.bold), "font-bold")}>B</button>
                    <button type="button" onClick={() => { onBegin(); onPatch({ italic: !cur.italic, family: cur.family ?? "Be Vietnam Pro" }); }} className={cx(toggle(!!cur.italic), "italic")}>I</button>
                    <button type="button" onClick={() => { onBegin(); onPatch({ stroke: !cur.stroke }); }} className={toggle(!!cur.stroke)}>Viền trắng</button>
                    <span className="mx-1 w-px bg-[#e5e5e7]" />
                  </>
                )}
                {([["left", <AlignLeft key="l" size={15} />], ["center", <AlignCenter key="c" size={15} />], ["right", <AlignRight key="r" size={15} />]] as const).map(([a, icon]) => (
                  <button key={a} type="button" title={a === "left" ? "Căn trái" : a === "right" ? "Căn phải" : "Căn giữa"} onClick={() => { onBegin(); onPatch({ align: a }); }} className={toggle((cur.align ?? "center") === a)}>{icon}</button>
                ))}
              </div>
              {!cur.arc && <Range label="Khoảng cách dòng" value={cur.lh ?? 1.25} min={0.8} max={2.2} step={0.05} unit="×" onBegin={onBegin} onChange={(v) => onPatch({ lh: v })} />}
              {cur.cutout ? (
                <>
                  <Range label="Khoảng cách chữ" value={cur.cutout.spacing} min={-2} max={6} step={0.25} unit="mm" onBegin={onBegin} onChange={(v) => onPatch({ cutout: { ...cur.cutout!, spacing: v } })} />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => { onBegin(); onPatch({ cutout: { ...cur.cutout!, curve: 0 } }); }} className={toggle(cur.cutout.curve === 0)}>Thẳng hàng</button>
                    <button type="button" onClick={() => { onBegin(); onPatch({ cutout: { ...cur.cutout!, curve: cur.cutout!.curve || 0.4 } }); }} className={toggle(cur.cutout.curve !== 0)}>Cong</button>
                  </div>
                  {cur.cutout.curve !== 0 && <Range label="Độ cong (− nụ cười · + cầu vồng)" value={Math.round(cur.cutout.curve * 100)} min={-100} max={100} step={1} unit="%" onBegin={onBegin} onChange={(v) => onPatch({ cutout: { ...cur.cutout!, curve: v / 100 || 0.01 } })} />}
                  <Range label="Độ lộn xộn" value={Math.round(cur.cutout.chaos * 100)} min={0} max={100} step={1} unit="%" onBegin={onBegin} onChange={(v) => onPatch({ cutout: { ...cur.cutout!, chaos: v / 100 } })} />
                  <button type="button" onClick={() => { onBegin(); onPatch({ cutout: { ...cur.cutout!, seed: Math.floor(Math.random() * 1e6) } }); }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /> Đổi mảnh</button>
                </>
              ) : <Range label="Khoảng cách chữ" value={cur.ls ?? 0} min={-0.5} max={3} step={0.1} unit="mm" onBegin={onBegin} onChange={(v) => onPatch({ ls: v })} />}
            </>
          )}

          {wl && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {CARDS.map(([k, name, bg]) => <button key={k} type="button" onClick={() => { onBegin(); onPatch({ card: k, color: k === wl.card ? wl.color : bg }); }} className={cx("h-8 rounded-full border px-3 text-[12px]", wl.card === k ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b]")}>{name}</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-[#52525b]">Màu chữ</span>
                {COLORS.map((c) => <button key={c} type="button" onClick={() => { onBegin(); onPatch({ ink: c }); }} aria-label={c} className={cx("h-6 w-6 rounded-full border-2", wl.ink === c ? "border-[#ff5fa2]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />)}
                <span className="ml-2 text-[12px] text-[#52525b]">Màu khung</span>
                <input type="color" value={wl.color} onChange={(e) => onPatch({ color: e.target.value })} aria-label="Màu khung" className="h-6 w-8" />
              </div>
            </>
          )}
          <div className="flex gap-2 border-t border-[#efeff1] pt-3">
            <button type="button" onClick={onDuplicate} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-[#e5e5e7] text-[12px] font-medium hover:border-[#a1a1aa]"><Copy size={13} /> Nhân bản</button>
            <button type="button" onClick={onRemove} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-[#fecaca] text-[12px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 size={13} /> Xoá</button>
          </div>
        </section>
      )}

      {topics && wishes && onWish && topics.length > 0 && (
        <section className="rounded-[10px] border border-[#e5e5e7]">
          <button type="button" onClick={() => onWishOpen(!wishOpen)} aria-expanded={wishOpen} className="flex w-full items-center justify-between px-3 py-2.5 text-[13px] font-semibold">
            Lời chúc có sẵn <ChevronDown size={16} className={cx("transition-transform", wishOpen && "rotate-180")} />
          </button>
          {wishOpen && (
            <div className="space-y-2 border-t border-[#efeff1] p-3">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {topics.map((t) => <button key={t.id} type="button" onClick={() => setTopic(t.id)} className={cx("h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium", curTopic === t.id ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b]")}>{t.name}</button>)}
              </div>
              <ul className="max-h-[300px] space-y-1 overflow-y-auto">
                {wishes.filter((w) => w.topic_id === curTopic).map((w) => (
                  <li key={w.id}><button type="button" onClick={() => onWish(w.content)} className="w-full rounded-[8px] border border-[#efeff1] px-2.5 py-1.5 text-left text-[13px] leading-snug text-[#3f3f46] hover:border-[#ff5fa2] hover:bg-[#fff5f9]">{w.content}</button></li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
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
