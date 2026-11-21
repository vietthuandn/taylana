"use client";

/* Scrapbook → tab "Chữ" (mỗi lúc chỉ làm 1 việc), từ trên xuống:
   1. "+ Thêm chữ" (nút chính).
   2. "Cài đặt chữ" (chỉ khi đang chọn 1 lớp chữ / khung lời chúc) — các dòng nhãn trái (88px) + nội dung phải:
      Font (dropdown tự làm: "Chữ cắt dán" trên cùng có ảnh xem trước "Taylana", rồi "Font thường" hiện bằng chính font đó),
      Loại giấy (khi có khung giấy), Màu chữ, Màu khung (pastel), Đã dùng (màu riêng đã chọn), cỡ chữ, căn lề, khoảng cách…
   3. "Lời chúc có sẵn": khối thu gọn, mặc định đóng. */
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronDown, Copy, Dices, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CutoutFont } from "@/lib/scrapbook/cutout";
import type { Layer, Wish, WishCard, WishTopic } from "@/lib/scrapbook/types";
import { WISH_FONT } from "@/lib/scrapbook/render";
import { cx } from "@/components/ui/styles";

type T = Extract<Layer, { k: "text" }>;
type WL = Extract<Layer, { k: "wish" }>;
const CARDS: [WishCard, string, string][] = [["card", "Thiệp", "#ffffff"], ["note", "Note", "#fff3a8"], ["lined", "Kẻ dòng", "#fffdf6"], ["label", "Nhãn", "#ffffff"]];
export const FAMILIES = ["Dancing Script", "Patrick Hand", "Pangolin", "Itim", "Be Vietnam Pro", "Oswald"];
const INKS = ["#18181b", "#3f3f46", "#ffffff", "#ff5fa2", "#e63946", "#f4a261", "#2a9d8f", "#1d3557", "#7b2cbf"];
const PASTELS = ["#fbcfe8", "#fdf6e3", "#c7f0db", "#cfe8fb", "#ddd6fe", "#fef3a8", "#fed7c3", "#e4e4e7"]; // hồng phấn, kem, bạc hà, trời nhạt, lavender, vàng bơ, cam đào, xám nhạt
const MORE = ["#000000", "#52525b", "#a1a1aa", "#ffffff", "#7f1d1d", "#dc2626", "#fb7185", "#f9a8d4", "#9a3412", "#f97316", "#fbbf24", "#fde68a",
  "#14532d", "#16a34a", "#86efac", "#0f766e", "#1e3a8a", "#2563eb", "#93c5fd", "#4c1d95", "#8b5cf6", "#c4b5fd", "#78350f", "#d6b88c"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[88px_1fr] items-center gap-2"><span className="text-[12px] text-[#52525b]">{label}</span><div className="min-w-0">{children}</div></div>;
}
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open, close]);
  return ref;
}
/** dropdown font tự làm: "Chữ cắt dán" (ảnh xem trước) ở trên, "Font thường" (tên hiện bằng chính font) ở dưới */
function FontSelect({ value, fonts, previews, families, onPick }: { value: string; fonts: CutoutFont[]; previews: Record<string, string>; families: string[]; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const show = (v: string) => {
    if (v.startsWith("cut:")) { const id = v.slice(4), f = fonts.find((x) => x.id === id); return previews[id] ? <img src={previews[id]} alt={f?.name} className="max-h-7 max-w-full" /> : <span className="text-[13px]">{f?.name ?? "Chữ cắt dán"}</span>; } // eslint-disable-line @next/next/no-img-element
    return <span className="truncate text-[15px]" style={{ fontFamily: v ? `"${v}"` : undefined }}>{v || "Theo mẫu"}</span>;
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-10 w-full items-center gap-2 rounded-[8px] border border-[#e5e5e7] bg-white px-2.5 text-left hover:border-[#a1a1aa]">
        <span className="flex min-w-0 flex-1 items-center">{show(value)}</span><ChevronDown size={15} className="shrink-0 text-[#71717a]" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[300px] overflow-y-auto rounded-[10px] border border-[#e5e5e7] bg-white p-1 shadow-lg">
          {fonts.length > 0 && <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Chữ cắt dán</p>}
          {fonts.map((f) => (
            <button key={f.id} type="button" onClick={() => { onPick(`cut:${f.id}`); setOpen(false); }} title={f.name}
              className={cx("flex h-11 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#fff5f9]", value === `cut:${f.id}` && "bg-[var(--c-secondary)]")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previews[f.id] ? <img src={previews[f.id]} alt={f.name} className="max-h-8 max-w-[80%]" /> : <span className="text-[13px]">{f.name}</span>}
              {value === `cut:${f.id}` && <Check size={14} className="ml-auto text-[var(--c-primary)]" />}
            </button>
          ))}
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Font thường</p>
          {families.map((f) => (
            <button key={f || "tpl"} type="button" onClick={() => { onPick(f); setOpen(false); }}
              className={cx("flex h-9 w-full items-center rounded-[6px] px-2 text-left text-[15px] hover:bg-[#fff5f9]", value === f && "bg-[var(--c-secondary)]")} style={{ fontFamily: f ? `"${f}"` : undefined }}>
              {f || "Theo mẫu"}{value === f && <Check size={14} className="ml-auto text-[var(--c-primary)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
/** hàng ô màu tròn 22px + ô "+" mở bảng chọn màu riêng (có ô nhập HEX) */
function Swatches({ colors, value, onPick, onCustom }: { colors: string[]; value: string; onPick: (c: string) => void; onCustom: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const ref = useOutside(open, () => setOpen(false));
  useEffect(() => { if (open) setHex(value); }, [open, value]);
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-1.5">
      {colors.map((c) => <button key={c} type="button" onClick={() => onPick(c)} aria-label={c} className={cx("h-[22px] w-[22px] rounded-full border-2", value.toLowerCase() === c.toLowerCase() ? "border-[var(--c-primary)]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />)}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Chọn màu riêng" className="grid h-[22px] w-[22px] place-items-center rounded-full border border-dashed border-[#a1a1aa] text-[#52525b] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"><Plus size={12} /></button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[232px] rounded-[10px] border border-[#e5e5e7] bg-white p-2.5 shadow-lg">
          <div className="grid grid-cols-8 gap-1.5">
            {MORE.map((c) => <button key={c} type="button" onClick={() => { onCustom(c); setOpen(false); }} aria-label={c} className="h-[22px] w-[22px] rounded-full ring-1 ring-[#e5e5e7]" style={{ background: c }} />)}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="h-7 w-7 shrink-0 rounded-[6px] ring-1 ring-[#e5e5e7]" style={{ background: valid ? hex : "#fff" }} />
            <input value={hex} onChange={(e) => setHex(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)} maxLength={7} aria-label="Mã HEX"
              onKeyDown={(e) => { if (e.key === "Enter" && valid) { onCustom(hex); setOpen(false); } }}
              className="h-7 min-w-0 flex-1 rounded-[6px] border border-[#e5e5e7] px-2 font-mono text-[12px] uppercase outline-none focus:border-[var(--c-primary)]" />
            <button type="button" disabled={!valid} onClick={() => { onCustom(hex); setOpen(false); }} className="h-7 rounded-[6px] bg-[var(--c-primary)] px-2.5 text-[12px] font-medium text-white disabled:opacity-40">Dùng</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TextTab({ layer, fonts, previews, colors, onCustomColor, onPaper, onAdd, onPatch, onBegin, onDuplicate, onRemove, topics, wishes, onWish, wishOpen, onWishOpen }: {
  layer: Layer | null; fonts: CutoutFont[]; previews: Record<string, string>;
  colors: string[]; onCustomColor: (c: string) => void; onPaper: (v: "none") => void; // màu riêng đã dùng · "Không giấy" (khung lời chúc → chữ thường)
  onAdd: () => void; onPatch: (v: Partial<T> | Partial<WL>) => void; onBegin: () => void; // onBegin: lưu mốc hoàn tác trước khi kéo thanh trượt
  onDuplicate: () => void; onRemove: () => void;
  topics?: WishTopic[]; wishes?: Wish[]; onWish?: (content: string) => void; wishOpen: boolean; onWishOpen: (v: boolean) => void;
}) {
  const [topic, setTopic] = useState<string | null>(null);
  const [target, setTarget] = useState<"ink" | "paper">("ink");
  const cur = layer?.k === "text" ? layer : null, wl = layer?.k === "wish" ? layer : null, L = cur ?? wl;
  const curTopic = topic ?? topics?.[0]?.id ?? null;
  const toggle = (on: boolean) => cx("grid h-8 min-w-[34px] place-items-center rounded-[6px] border px-2 text-[13px]", on ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b]");
  const chip = (on: boolean) => cx("h-7 rounded-full border px-2.5 text-[12px] font-medium", on ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  const ink = cur ? cur.color : wl?.ink ?? "#3f3f46";
  const setInk = (c: string) => { onBegin(); onPatch(cur ? { color: c } : { ink: c }); };
  const setPaperColor = (c: string) => { onBegin(); onPatch({ color: c }); };
  const fontValue = L?.cutout ? `cut:${L.cutout.font}` : L?.family ?? (wl ? WISH_FONT : "");
  const families = wl ? [WISH_FONT, ...FAMILIES.filter((f) => f !== WISH_FONT)] : cur && !cur.family ? ["", ...FAMILIES] : FAMILIES;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onAdd} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--c-primary)] text-[14px] font-semibold text-white hover:bg-[var(--c-primary-hover)]"><Plus size={17} /> Thêm chữ</button>

      {!wishOpen && L && (
        <section className="space-y-3 rounded-[10px] border border-[#e5e5e7] p-3">
          <p className="text-[13px] font-semibold">Cài đặt chữ</p>
          <Row label="Font">
            <FontSelect value={fontValue} fonts={fonts} previews={previews} families={families} onPick={(v) => {
              onBegin();
              const c = L.cutout;
              if (v.startsWith("cut:")) onPatch({ cutout: { curve: 0, chaos: 0.35, spacing: 0, seed: Math.floor(Math.random() * 1e6), ...(c ?? {}), font: v.slice(4) } });
              else onPatch({ cutout: undefined, family: v || undefined });
            }} />
          </Row>
          {wl && (
            <Row label="Loại giấy">
              <div className="flex flex-wrap gap-1.5">
                {CARDS.map(([k, name, bg]) => <button key={k} type="button" onClick={() => { onBegin(); onPatch({ card: k, color: k === wl.card ? wl.color : bg }); }} className={chip(wl.card === k)}>{name}</button>)}
                <button type="button" onClick={() => onPaper("none")} className={chip(false)}>Không giấy</button>
              </div>
            </Row>
          )}
          {!(cur?.cutout) && <Row label="Màu chữ"><Swatches colors={INKS} value={ink} onPick={setInk} onCustom={(c) => { onCustomColor(c); setInk(c); }} /></Row>}
          {wl && <Row label="Màu khung"><Swatches colors={PASTELS} value={wl.color} onPick={setPaperColor} onCustom={(c) => { onCustomColor(c); setPaperColor(c); }} /></Row>}
          {colors.length > 0 && (
            <Row label="Đã dùng">
              <div className="flex flex-wrap items-center gap-1.5">
                {wl && (
                  <span className="mr-1 inline-flex rounded-full border border-[#e5e5e7] p-0.5 text-[11px]">
                    <button type="button" onClick={() => setTarget("ink")} className={cx("rounded-full px-1.5", target === "ink" && "bg-[var(--c-secondary)] text-[var(--c-primary)]")}>Chữ</button>
                    <button type="button" onClick={() => setTarget("paper")} className={cx("rounded-full px-1.5", target === "paper" && "bg-[var(--c-secondary)] text-[var(--c-primary)]")}>Khung</button>
                  </span>
                )}
                {colors.map((c) => <button key={c} type="button" title={c} onClick={() => (wl && target === "paper" ? setPaperColor(c) : setInk(c))} className="h-[22px] w-[22px] rounded-full ring-1 ring-[#e5e5e7]" style={{ background: c }} />)}
              </div>
            </Row>
          )}

          {cur && (
            <>
              <Range label={cur.cutout ? "Cỡ chữ (chiều cao mảnh)" : "Cỡ chữ"} value={cur.size} min={2} max={24} step={0.2} unit="mm" onBegin={onBegin} onChange={(v) => onPatch({ size: v })} />
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
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"><Dices size={14} /> Đổi mảnh</button>
                </>
              ) : <Range label="Khoảng cách chữ" value={cur.ls ?? 0} min={-0.5} max={3} step={0.1} unit="mm" onBegin={onBegin} onChange={(v) => onPatch({ ls: v })} />}
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
                {topics.map((t) => <button key={t.id} type="button" onClick={() => setTopic(t.id)} className={cx("h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium", curTopic === t.id ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b]")}>{t.name}</button>)}
              </div>
              <ul className="max-h-[300px] space-y-1 overflow-y-auto">
                {wishes.filter((w) => w.topic_id === curTopic).map((w) => (
                  <li key={w.id}><button type="button" onClick={() => onWish(w.content)} className="w-full rounded-[8px] border border-[#efeff1] px-2.5 py-1.5 text-left text-[13px] leading-snug text-[#3f3f46] hover:border-[var(--c-primary)] hover:bg-[#fff5f9]">{w.content}</button></li>
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
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onBegin} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--c-primary)]" />
    </label>
  );
}
