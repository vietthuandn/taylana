"use client";

/* Scrapbook → tab "Chữ" (mỗi lúc chỉ làm 1 việc), từ trên xuống:
   1. "+ Thêm chữ" (nút chính).
   2. "Cài đặt chữ" (chỉ khi đang chọn 1 lớp chữ / khung lời chúc) — các dòng nhãn trái (88px) + nội dung phải:
      Font (dropdown tự làm: "Chữ cắt dán" trên cùng có ảnh xem trước "Taylana", rồi "Font thường" hiện bằng chính font đó),
      Loại giấy (khi có khung giấy), Màu chữ, Màu khung (pastel), Đã dùng (màu riêng đã chọn), cỡ chữ, căn lề, khoảng cách…
   3. "Lời chúc có sẵn": khối thu gọn, mặc định đóng. */
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronDown, Copy, Dices, Loader2, Plus, Trash2 } from "lucide-react";
import { FONT_GROUPS, WEIGHT_NAMES, nearestWeight, type FontGroup } from "@/lib/fonts/catalog";
import { knownFont, loadFont, loadFontList, loadPreview, previewFamily } from "@/lib/fonts/load";
import { useEffect, useRef, useState } from "react";
import type { CutoutFont } from "@/lib/scrapbook/cutout";
import type { Layer, Wish, WishCard, WishTopic } from "@/lib/scrapbook/types";
import { WISH_FONT } from "@/lib/scrapbook/render";
import { cx } from "@/components/ui/styles";

type T = Extract<Layer, { k: "text" }>;
type WL = Extract<Layer, { k: "wish" }>;
export const CARDS: [WishCard, string, string][] = [["card", "Thiệp", "#ffffff"], ["note", "Note", "#fff3a8"], ["lined", "Kẻ dòng", "#fffdf6"], ["label", "Nhãn", "#ffffff"]];
export const FAMILIES = ["Dancing Script", "Patrick Hand", "Pangolin", "Itim", "Be Vietnam Pro", "Oswald"];
const INKS = ["#18181b", "#3f3f46", "#ffffff", "#ff5fa2", "#e63946", "#f4a261", "#2a9d8f", "#1d3557", "#7b2cbf"];
export const PASTELS = ["#fbcfe8", "#fdf6e3", "#c7f0db", "#cfe8fb", "#ddd6fe", "#fef3a8", "#fed7c3", "#e4e4e7"]; // hồng phấn, kem, bạc hà, trời nhạt, lavender, vàng bơ, cam đào, xám nhạt
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
const RECENT_KEY = "taylana-recent-fonts";
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : []; } catch { return []; } };
const pushRecent = (f: string) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([f, ...readRecent().filter((x) => x !== f)].slice(0, 5))); } catch { /* bỏ qua */ } };
/** 1 dòng font: tên hiện bằng chính font đó — chỉ tải bản xem trước (đúng các chữ của tên) khi dòng hiện trong danh sách */
function FontRow({ f, on, onPick }: { f: string; on: boolean; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !f || !knownFont(f)) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); loadPreview(f).then(() => setReady(true)); } }, { root: el.closest("[data-font-list]"), rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, [f]);
  return (
    <button ref={ref} type="button" onClick={onPick} title={f || "Theo mẫu"}
      className={cx("flex h-9 w-full items-center rounded-[6px] px-2 text-left text-[15px] hover:bg-[#fff5f9]", on && "bg-[var(--c-secondary)]")}
      style={{ fontFamily: f ? (ready ? previewFamily(f) : `"${f}"`) : undefined }}>
      <span className="truncate">{f || "Theo mẫu"}</span>{on && <Check size={14} className="ml-auto shrink-0 text-[var(--c-primary)]" />}
    </button>
  );
}
/** dropdown font: ô tìm · chip nhóm (Tất cả, Không chân, Có chân, Viết tay, Tiêu đề, Đơn cách, Chữ cắt dán) · "Đã dùng gần đây" (5 font) ·
    "Chữ cắt dán" (ảnh xem trước) ở trên · font thường hiện bằng chính font đó (tải lười). */
function FontSelect({ value, fonts, previews, families, loading, onPick }: { value: string; fonts: CutoutFont[]; previews: Record<string, string>; families: string[]; loading?: boolean; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState<"all" | "cut" | FontGroup>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const ref = useOutside(open, () => setOpen(false));
  useEffect(() => { if (open) setRecent(readRecent().filter((f) => families.includes(f))); }, [open, families]);
  const show = (v: string) => {
    if (v.startsWith("cut:")) { const id = v.slice(4), f = fonts.find((x) => x.id === id); return previews[id] ? <img src={previews[id]} alt={f?.name} className="max-h-7 max-w-full" /> : <span className="text-[13px]">{f?.name ?? "Chữ cắt dán"}</span>; } // eslint-disable-line @next/next/no-img-element
    return <span className="truncate text-[15px]" style={{ fontFamily: v ? `"${v}"` : undefined }}>{v || "Theo mẫu"}</span>;
  };
  const k = q.trim().toLowerCase();
  const list = families.filter((f) => (!k || f.toLowerCase().includes(k)) && (grp === "all" || (grp !== "cut" && knownFont(f)?.group === grp)));
  const cuts = grp === "all" || grp === "cut" ? fonts.filter((f) => !k || f.name.toLowerCase().includes(k)) : [];
  const pick = (v: string) => { if (v && !v.startsWith("cut:")) pushRecent(v); onPick(v); setOpen(false); };
  const head = "px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]";
  const chip = (on: boolean) => cx("h-6 shrink-0 rounded-full border px-2 text-[11px] font-medium", on ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b]");
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-10 w-full items-center gap-2 rounded-[8px] border border-[#e5e5e7] bg-white px-2.5 text-left hover:border-[#a1a1aa]">
        <span className="flex min-w-0 flex-1 items-center">{show(value)}</span>
        {loading ? <Loader2 size={15} className="shrink-0 animate-spin text-[var(--c-primary)]" aria-label="Đang tải font" /> : <ChevronDown size={15} className="shrink-0 text-[#71717a]" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-[10px] border border-[#e5e5e7] bg-white shadow-lg">
          <div className="space-y-1.5 border-b border-[#efeff1] p-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Tìm font theo tên…" className="h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2 text-[13px] outline-none focus:border-[var(--c-primary)]" />
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              <button type="button" onClick={() => setGrp("all")} className={chip(grp === "all")}>Tất cả</button>
              {FONT_GROUPS.map(([g, n]) => <button key={g} type="button" onClick={() => setGrp(g)} className={chip(grp === g)}>{n}</button>)}
              {fonts.length > 0 && <button type="button" onClick={() => setGrp("cut")} className={chip(grp === "cut")}>Chữ cắt dán</button>}
            </div>
          </div>
          <div data-font-list className="max-h-[300px] overflow-y-auto p-1">
            {!k && grp === "all" && recent.length > 0 && <><p className={head}>Đã dùng gần đây</p>{recent.map((f) => <FontRow key={`r-${f}`} f={f} on={value === f} onPick={() => pick(f)} />)}</>}
            {cuts.length > 0 && <p className={head}>Chữ cắt dán</p>}
            {cuts.map((f) => (
              <button key={f.id} type="button" onClick={() => pick(`cut:${f.id}`)} title={f.name}
                className={cx("flex h-11 w-full items-center gap-2 rounded-[6px] px-2 hover:bg-[#fff5f9]", value === `cut:${f.id}` && "bg-[var(--c-secondary)]")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {previews[f.id] ? <img src={previews[f.id]} alt={f.name} className="max-h-8 max-w-[80%]" /> : <span className="text-[13px]">{f.name}</span>}
                {value === `cut:${f.id}` && <Check size={14} className="ml-auto text-[var(--c-primary)]" />}
              </button>
            ))}
            {grp !== "cut" && <p className={head}>Font thường</p>}
            {grp !== "cut" && list.map((f) => <FontRow key={f || "tpl"} f={f} on={value === f} onPick={() => pick(f)} />)}
            {grp !== "cut" && !list.length && <p className="px-2 py-3 text-[12px] text-[#a1a1aa]">Không có font phù hợp.</p>}
          </div>
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
  colors: string[]; onCustomColor: (c: string) => void; onPaper: (v: WishCard | "none") => void; // màu riêng đã dùng · "Không giấy" (khung lời chúc → chữ thường)
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
  // font Google đang bật (Admin → Quản lý chất liệu → Font chữ) + font cũ còn trên thiết kế
  const [gfonts, setGfonts] = useState<string[]>(FAMILIES);
  useEffect(() => { loadFontList().then((l) => setGfonts([...new Set([...l.map((f) => f.family), ...FAMILIES.filter((f) => !knownFont(f))])])); }, []);
  const base = L?.family && !gfonts.includes(L.family) ? [L.family, ...gfonts] : gfonts;
  const families = wl ? [WISH_FONT, ...base.filter((f) => f !== WISH_FONT)] : cur && !cur.family ? ["", ...base] : base;
  const [fontLoading, setFontLoading] = useState(false);
  const gf = knownFont(cur?.family ?? "Be Vietnam Pro");
  const curWeight = cur ? cur.weight ?? (cur.bold ? 700 : 400) : 400;
  const canBold = !gf || gf.weights.some((w) => w >= 600), canItalic = !gf || gf.italic;
  const weights = WEIGHT_NAMES.filter(([w]) => !gf || gf.weights.includes(w) || (w === 800 && gf.weights.includes(900)));
  return (
    <div className="space-y-4">
      <button type="button" onClick={onAdd} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--c-primary)] text-[14px] font-semibold text-white hover:bg-[var(--c-primary-hover)]"><Plus size={17} /> Thêm chữ</button>

      {!wishOpen && L && (
        <section className="space-y-3 rounded-[10px] border border-[#e5e5e7] p-3">
          <p className="text-[13px] font-semibold">Cài đặt chữ</p>
          <Row label="Font">
            <FontSelect value={fontValue} fonts={fonts} previews={previews} families={families} loading={fontLoading} onPick={async (v) => {
              const c = L.cutout;
              if (v.startsWith("cut:")) { onBegin(); onPatch({ cutout: { curve: 0, chaos: 0.35, spacing: 0, seed: Math.floor(Math.random() * 1e6), ...(c ?? {}), font: v.slice(4) } }); return; }
              // tải bản đầy đủ (latin + tiếng Việt) xong mới vẽ lại lớp chữ
              const nf = knownFont(v), w = cur ? nearestWeight(nf, curWeight) : 400, it = !!cur?.italic && (!nf || nf.italic);
              if (v) { setFontLoading(true); await loadFont(v, w, it); setFontLoading(false); }
              onBegin();
              onPatch(cur ? { cutout: undefined, family: v || undefined, weight: v && cur.weight ? w : cur.weight, italic: it || undefined } : { cutout: undefined, family: v || undefined });
            }} />
          </Row>
          {(wl || !cur?.cutout) && (
            <Row label="Loại giấy">
              <div className="flex flex-wrap gap-1.5">
                {CARDS.map(([k, name, bg]) => <button key={k} type="button" onClick={() => { if (!wl) { onPaper(k); return; } onBegin(); onPatch({ card: k, color: k === wl.card ? wl.color : bg }); }} className={chip(wl?.card === k)}>{name}</button>)}
                <button type="button" onClick={() => { if (wl) onPaper("none"); }} className={chip(!wl)}>Không giấy</button>
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
              {!cur.cutout && weights.length > 1 && (
                <Row label="Độ đậm">
                  <div className="flex flex-wrap gap-1">
                    {weights.map(([w, n]) => { const real = gf && !gf.weights.includes(w) ? 900 : w; return (
                      <button key={w} type="button" onClick={async () => { const fam = cur.family ?? "Be Vietnam Pro"; await loadFont(fam, real, !!cur.italic); onBegin(); onPatch({ weight: real, bold: real >= 600, family: fam }); }}
                        className={cx(toggle(curWeight === real), "h-7 text-[12px]")} style={{ fontWeight: real }}>{n}</button>
                    ); })}
                  </div>
                </Row>
              )}
              <Range label={cur.cutout ? "Cỡ chữ (chiều cao mảnh)" : "Cỡ chữ"} value={cur.size} min={2} max={24} step={0.2} unit="mm" onBegin={onBegin} onChange={(v) => onPatch({ size: v })} />
              <div className="flex flex-wrap gap-1.5">
                {!cur.cutout && (
                  <>
                    <button type="button" disabled={!canBold} title={canBold ? "Đậm" : "Font này không có bản đậm"} onClick={async () => { const fam = cur.family ?? "Be Vietnam Pro", b = !(curWeight >= 600), w = b ? nearestWeight(gf, 700) : nearestWeight(gf, 400); await loadFont(fam, w, !!cur.italic); onBegin(); onPatch({ bold: b, weight: w, family: fam }); }} className={cx(toggle(curWeight >= 600), "font-bold disabled:opacity-35")}>B</button>
                    <button type="button" disabled={!canItalic} title={canItalic ? "Nghiêng" : "Font này không có kiểu nghiêng"} onClick={async () => { const fam = cur.family ?? "Be Vietnam Pro"; await loadFont(fam, curWeight, !cur.italic); onBegin(); onPatch({ italic: !cur.italic, family: fam }); }} className={cx(toggle(!!cur.italic), "italic disabled:opacity-35")}>I</button>
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
