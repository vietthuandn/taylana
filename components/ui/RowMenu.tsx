"use client";
/* Nút ⋮ (kebab) mở menu thao tác — dùng chung cho bảng & thẻ trong admin.
   Menu đặt "fixed", căn theo MÉP PHẢI của nút, tự kẹp trong màn hình (không tràn ra ngoài, kể cả trên điện thoại).
   Đóng khi bấm ra ngoài / Esc / cuộn / đổi cỡ màn hình. Mục có href → link; có onClick → nút. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

export type RowMenuItem = { label: string; icon?: React.ReactNode; onClick?: () => void; href?: string; disabled?: boolean; danger?: boolean; title?: string };

export function RowMenu({ items, className = "", label = "Thao tác" }: { items: (RowMenuItem | false | null | undefined)[]; className?: string; label?: string }) {
  const list = items.filter(Boolean) as RowMenuItem[];
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pos) return;
    const h = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setPos(null); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const close = () => setPos(null);
    document.addEventListener("mousedown", h); document.addEventListener("touchstart", h); document.addEventListener("keydown", k);
    window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); document.removeEventListener("keydown", k);
      window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close);
    };
  }, [pos]);
  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault(); e.stopPropagation();
    if (pos) return setPos(null);
    const b = e.currentTarget.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    const right = Math.max(8, Math.min(W - b.right, W - 8 - 200)); // menu rộng ~200px, luôn nằm trong màn hình
    const need = list.length * 36 + 12;
    setPos(b.bottom + 4 + need > H - 8 && b.top > need ? { bottom: H - b.top + 4, right } : { top: Math.min(b.bottom + 4, H - need - 8), right });
  }
  return (
    <div ref={ref} className={`relative flex shrink-0 justify-end ${className}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={toggle} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={!!pos}
        className="grid h-8 w-8 place-items-center rounded-[6px] text-[#52525b] hover:bg-[#f4f4f5]"><MoreVertical size={16} /></button>
      {pos && (
        <div role="menu" style={{ top: pos.top, bottom: pos.bottom, right: pos.right }} className="fixed z-[80] w-max min-w-[180px] max-w-[calc(100vw-16px)] overflow-hidden rounded-[10px] border border-[#e5e5e7] bg-white py-1 text-left shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
          {list.map((it) => {
            const cls = `flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-normal disabled:cursor-not-allowed disabled:opacity-40 ${it.danger ? "text-[#dc2626] hover:bg-[#fef2f2]" : "text-[#18181b] hover:bg-[#f4f4f5]"}`;
            return it.href && !it.disabled
              ? <Link key={it.label} href={it.href} role="menuitem" title={it.title} onClick={() => setPos(null)} className={cls}>{it.icon}{it.label}</Link>
              : <button key={it.label} type="button" role="menuitem" disabled={it.disabled} title={it.title} onClick={() => { setPos(null); it.onClick?.(); }} className={cls}>{it.icon}{it.label}</button>;
          })}
        </div>
      )}
    </div>
  );
}
