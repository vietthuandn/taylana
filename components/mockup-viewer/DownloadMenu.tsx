"use client";

/* Nút "Tải về" duy nhất: bấm → hiện danh sách lựa chọn. */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/kit";

export type DownloadItem = { label: string; icon: React.ReactNode; onClick: () => void };

export function DownloadMenu({ items, busy }: { items: DownloadItem[]; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <Button size="sm" icon={<Download size={16} />} loading={busy} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        Tải về <ChevronDown size={14} />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-[10px] border border-[#e5e5e7] bg-white py-1 shadow-lg">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#18181b] hover:bg-[#fff0f6] hover:text-[#ff5fa2]">
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
