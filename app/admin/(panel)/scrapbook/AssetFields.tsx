"use client";
/* Ô "Nhóm" (combobox: danh sách nhóm theo số chất liệu, gõ để lọc không dấu, "+ Thêm …" tạo nhóm mới) và ô "Tags" (chip:
   Enter / dấu phẩy để thêm, × để xoá, gợi ý tag đang có theo số lần dùng). Dùng cho cả tờ sticker, từng món và thao tác hàng loạt. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { fold, normTag } from "@/lib/scrapbook/assetGroups";
import type { AssetGroupRow } from "@/lib/scrapbook/types";
import { cx } from "@/components/admin/styles";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}
const box = "h-9 w-full rounded-[8px] border border-[#e5e5e7] bg-white px-2.5 text-[13px] outline-none focus:border-[#ff5fa2]";
const pop = "absolute left-0 right-0 top-full z-30 mt-1 max-h-[240px] overflow-y-auto rounded-[8px] border border-[#e5e5e7] bg-white py-1 text-[13px] shadow-[0_8px_24px_rgb(0_0_0/0.12)]";

export function GroupCombo({ groups, value, onChange, onCreate, placeholder = "Để trống = theo Loại", small }: {
  groups: (AssetGroupRow & { count: number })[]; value: string | null; onChange: (id: string | null) => void;
  onCreate: (name: string) => Promise<AssetGroupRow | null>; placeholder?: string; small?: boolean;
}) {
  const cur = groups.find((g) => g.id === value);
  const [q, setQ] = useState(cur?.name ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setQ(cur?.name ?? ""); }, [cur?.name]);
  const ref = useOutside(open, () => { setOpen(false); setQ(cur?.name ?? ""); });
  const f = fold(q);
  const list = useMemo(() => (f && f !== fold(cur?.name ?? "") ? groups.filter((g) => fold(g.name).includes(f)) : groups), [groups, f, cur?.name]);
  const exact = groups.some((g) => fold(g.name) === f);
  async function create() {
    setBusy(true);
    const g = await onCreate(q.trim()).catch(() => null);
    setBusy(false);
    if (g) { onChange(g.id); setQ(g.name); setOpen(false); }
  }
  return (
    <div ref={ref} className="relative">
      <input value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value.trim()) onChange(null); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); return; }
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (!q.trim()) { onChange(null); setOpen(false); return; }
          const hit = groups.find((g) => fold(g.name) === f) ?? list[0];
          if (hit && (exact || list.length === 1)) { onChange(hit.id); setQ(hit.name); setOpen(false); } else create();
        }}
        className={cx(box, small && "h-7 px-1.5 text-[12px]")} aria-label="Nhóm" />
      {open && (
        <div className={pop} role="listbox">
          {list.map((g) => (
            <button key={g.id} type="button" role="option" aria-selected={g.id === value} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(g.id); setQ(g.name); setOpen(false); }}
              className={cx("flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[#f4f4f5]", g.id === value && "text-[#ff5fa2]")}>
              <span className="truncate">{g.name}</span><span className="shrink-0 text-[11px] text-[#a1a1aa]">· {g.count}</span>
            </button>
          ))}
          {q.trim() && !exact && (
            <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={create} className="flex w-full items-center gap-1 border-t border-[#efeff1] px-3 py-1.5 text-left font-medium text-[#ff5fa2] hover:bg-[#fff0f6]">
              <Plus size={13} /> Thêm “{q.trim()}”
            </button>
          )}
          {!list.length && !q.trim() && <p className="px-3 py-1.5 text-[#a1a1aa]">Chưa có nhóm — gõ tên để tạo.</p>}
        </div>
      )}
    </div>
  );
}

export function TagInput({ value, onChange, suggest, small, placeholder = "Thêm tag…" }: {
  value: string[]; onChange: (v: string[]) => void; suggest: { tag: string; count: number }[]; small?: boolean; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const add = (raw: string) => {
    const ts = raw.split(",").map(normTag).filter(Boolean);
    if (ts.length) onChange([...new Set([...value, ...ts])]);
    setQ("");
  };
  const f = fold(q);
  const list = suggest.filter((s) => !value.includes(s.tag) && (!f || fold(s.tag).includes(f))).slice(0, 12);
  return (
    <div ref={ref} className="relative">
      <div className={cx("flex min-h-9 flex-wrap items-center gap-1 rounded-[8px] border border-[#e5e5e7] bg-white px-1.5 py-1 focus-within:border-[#ff5fa2]", small && "min-h-7 py-0.5")}
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-[#f4f4f5] py-0.5 pl-2 pr-1 text-[12px]">
            {t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Xoá tag ${t}`} className="grid h-4 w-4 place-items-center rounded-full text-[#71717a] hover:bg-[#e4e4e7]"><X size={10} /></button>
          </span>
        ))}
        <input value={q} placeholder={value.length ? "" : placeholder} onFocus={() => setOpen(true)} onChange={(e) => { if (e.target.value.endsWith(",")) add(e.target.value); else setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(q); }
            else if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
            else if (e.key === "Escape") setOpen(false);
          }}
          onBlur={() => { if (q.trim()) add(q); }} className="min-w-[60px] flex-1 bg-transparent text-[12px] outline-none" aria-label="Tags" />
      </div>
      {open && list.length > 0 && (
        <div className={pop}>
          {list.map((s) => (
            <button key={s.tag} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s.tag)} className="flex w-full justify-between px-3 py-1.5 text-left hover:bg-[#f4f4f5]">
              <span>{s.tag}</span><span className="text-[11px] text-[#a1a1aa]">· {s.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
