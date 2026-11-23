"use client";
/* Ô chọn có gợi ý (combobox): gõ để tìm (không phân biệt hoa thường / dấu), danh sách gợi ý (dùng nhiều nhất lên đầu),
   không có thì dòng cuối là + Thêm "chữ đã gõ". */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { fold } from "@/lib/finance/shopee";
import { cx, inputClass } from "@/components/admin/ui";

export type ComboOpt = { id: string; label: string; hint?: string; count?: number };
export function Combo({ value, options, onChange, onCreate, placeholder, className, allowClear }: {
  value: string | null; options: ComboOpt[]; onChange: (id: string | null) => void;
  onCreate?: (text: string) => Promise<string | null> | string | null; // trả về id mới
  placeholder?: string; className?: string; allowClear?: boolean;
}) {
  const cur = options.find((o) => o.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  const k = fold(q);
  const list = useMemo(() => options.filter((o) => !k || fold(o.label).includes(k)).sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label, "vi")).slice(0, 50), [options, k]);
  const exact = options.some((o) => fold(o.label) === k);
  const canAdd = !!onCreate && !!q.trim() && !exact;
  const rows = list.length + (canAdd ? 1 : 0);
  async function pick(i: number) {
    if (i < list.length) { onChange(list[i].id); setOpen(false); setQ(""); return; }
    if (!canAdd || busy) return;
    setBusy(true);
    try { const id = await onCreate!(q.trim()); if (id) onChange(id); } finally { setBusy(false); }
    setOpen(false); setQ("");
  }
  return (
    <div ref={box} className={cx("relative", className)}>
      <input value={open ? q : cur?.label ?? ""} placeholder={cur?.label ?? placeholder} onFocus={() => { setOpen(true); setQ(""); setHi(0); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(rows - 1, h + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); if (rows) pick(hi); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className={cx(inputClass, "pr-8")} />
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
      {open && (
        <ul className="absolute inset-x-0 top-full z-40 mt-1 max-h-[260px] overflow-y-auto rounded-[10px] border border-[#e5e5e7] bg-white p-1 text-[13px] shadow-lg">
          {allowClear && value && <li><button type="button" onClick={() => { onChange(null); setOpen(false); }} className="w-full rounded-[6px] px-2 py-1.5 text-left text-[#a1a1aa] hover:bg-[#f4f4f5]">— Bỏ chọn —</button></li>}
          {list.map((o, i) => (
            <li key={o.id}><button type="button" onMouseEnter={() => setHi(i)} onClick={() => pick(i)}
              className={cx("flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left", hi === i && "bg-[#fff0f6]", o.id === value && "font-semibold text-[#ff5fa2]")}>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>{o.hint && <span className="shrink-0 text-[11px] text-[#a1a1aa]">{o.hint}</span>}
            </button></li>
          ))}
          {canAdd && (
            <li><button type="button" onMouseEnter={() => setHi(list.length)} onClick={() => pick(list.length)} disabled={busy}
              className={cx("flex w-full items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left font-medium text-[#ff5fa2]", hi === list.length && "bg-[#fff0f6]")}>
              <Plus size={14} /> Thêm “{q.trim()}”
            </button></li>
          )}
          {!rows && <li className="px-2 py-1.5 text-[#a1a1aa]">Không có gợi ý</li>}
        </ul>
      )}
    </div>
  );
}

/** ô số cho phép số lẻ kiểu Việt Nam ("0,5", "2.5"): giữ nguyên chữ đang gõ, báo số khi đọc được */
export function DecimalInput({ value, onChange, className, placeholder, ariaLabel }: { value: number; onChange: (v: number) => void; className?: string; placeholder?: string; ariaLabel?: string }) {
  const show = (v: number) => (Number.isFinite(v) ? String(v).replace(".", ",") : "");
  const [t, setT] = useState(show(value));
  useEffect(() => { setT((cur) => (Number(cur.replace(",", ".")) === value ? cur : show(value))); }, [value]);
  return (
    <input inputMode="decimal" value={t} placeholder={placeholder} aria-label={ariaLabel}
      onChange={(e) => { const s = e.target.value.replace(/[^\d.,]/g, ""); setT(s); const n = Number(s.replace(",", ".")); if (s !== "" && Number.isFinite(n)) onChange(n); else if (s === "") onChange(0); }}
      className={cx(inputClass, className)} />
  );
}
