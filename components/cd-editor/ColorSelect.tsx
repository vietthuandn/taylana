"use client";

import { useEffect, useRef, useState } from "react";

// Dropdown chọn màu: màu có sẵn (ô màu + tên) và "Màu tuỳ chọn…" (bảng màu + mã HEX)
export function ColorSelect({ value, colors, onChange }: {
  value: string; colors: { value: string; name: string }[]; onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [hex, setHex] = useState(value);
  const box = useRef<HTMLDivElement>(null);
  const preset = colors.find((c) => c.value.toLowerCase() === value.toLowerCase());

  useEffect(() => setHex(value), [value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setCustom(false); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={box} className="relative flex-1">
      <button type="button" className="tool-btn w-full !justify-start" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="h-3 w-4 shrink-0 rounded-[3px] border border-black/15" style={{ background: value }} />
        <span className="truncate">{preset?.name ?? value.toUpperCase()}</span>
        <span className="ml-auto text-[10px] text-[#71717a]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-20 w-56 rounded-[10px] border border-[#e5e5e7] bg-white p-1 shadow-lg" role="listbox">
          {colors.map((c) => (
            <button key={c.value} type="button" role="option" aria-selected={preset?.value === c.value}
              onClick={() => { onChange(c.value); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-[#f4f4f5] ${preset?.value === c.value ? "bg-[#f4f4f5] font-semibold" : ""}`}>
              <span className="h-4 w-4 rounded-full border border-black/15" style={{ background: c.value }} />
              {c.name}
              <span className="ml-auto text-[11px] text-[#71717a]">{c.value.toUpperCase()}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-[#efeff1]" />
          <button type="button" onClick={() => setCustom(!custom)} className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-[#f4f4f5]">
            <span className="h-4 w-4 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
            Màu tuỳ chọn…
          </button>
          {custom && (
            <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#050505"} onChange={(e) => { setHex(e.target.value); onChange(e.target.value); }}
                className="h-8 w-10 cursor-pointer rounded-[6px] border border-[#e5e5e7]" aria-label="Bảng chọn màu" />
              <input value={hex} onChange={(e) => { const v = e.target.value.trim(); setHex(v); if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v); }}
                className="tool-input w-full font-mono" placeholder="#050505" aria-label="Mã HEX" maxLength={7} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
