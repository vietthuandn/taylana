"use client";

/* Gallery masonry (máy tính 3 cột, điện thoại 2 cột, cách 8px, bo 8px), ảnh tải dần.
   Bấm ảnh mở lightbox: nút trước/sau, vuốt trên điện thoại, phím ←/→, Esc để đóng. */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ShowcaseItem } from "@/lib/types";

export function Gallery({ items }: { items: ShowcaseItem[] }) {
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const shown = q ? items.filter((i) => `${i.title} ${i.category} ${i.description}`.toLowerCase().includes(q)) : items;
  const [open, setOpen] = useState<number | null>(null);

  if (!items.length) return <p className="py-16 text-center text-[14px] text-[#71717a]">Tiệm đang chụp ảnh sản phẩm, sắp có rồi!</p>;
  return (
    <>
      {q && (
        <p className="mb-4 text-[14px] text-[#71717a]">
          Kết quả cho “<b className="text-[#18181b]">{q}</b>”: {shown.length} ảnh · <Link href="/ve-chung-toi" className="font-medium text-[#ff5fa2] hover:underline">Xem tất cả</Link>
        </p>
      )}
      <ul className="columns-2 gap-2 lg:columns-3">
        {shown.map((it, i) => (
          <li key={it.id} className="mb-2 break-inside-avoid">
            <button type="button" onClick={() => setOpen(i)} className="block w-full overflow-hidden rounded-[8px] bg-[#f4f4f5]" aria-label={it.title || "Xem ảnh"}>
              <Image src={it.image_url} alt={it.title || "Sản phẩm"} width={600} height={600} loading="lazy"
                sizes="(min-width:1024px) 370px, 50vw" className="h-auto w-full transition-opacity duration-300 hover:opacity-90" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && shown[open] && <Lightbox items={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ items, index, onIndex, onClose }: { items: ShowcaseItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const it = items[index];
  const touch = useRef<number | null>(null);
  const prev = useCallback(() => onIndex((index - 1 + items.length) % items.length), [index, items.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % items.length), [index, items.length, onIndex]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", key);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = o; };
  }, [onClose, prev, next]);

  const btn = "absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20";
  return (
    <div className="fixed inset-0 z-[80] bg-black/90" role="dialog" aria-modal aria-label="Xem ảnh" onClick={onClose}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 48) (dx > 0 ? prev : next)();
      }}>
      <div className="absolute inset-x-0 top-0 flex h-14 items-center justify-between px-4 text-[14px] text-white/80">
        <span className="tabular-nums">{index + 1} / {items.length}</span>
        <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><X size={20} /></button>
      </div>
      <div className="absolute inset-x-4 bottom-16 top-14 sm:inset-x-24" onClick={(e) => e.stopPropagation()}>
        <Image key={it.id} src={it.image_url} alt={it.title || "Sản phẩm"} fill sizes="100vw" className="animate-[fadeIn_.25s_ease] object-contain" />
      </div>
      {it.title && <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[14px] text-white/90">{it.title}</p>}
      {items.length > 1 && (
        <>
          <button type="button" aria-label="Ảnh trước" className={`${btn} left-4 hidden sm:grid`} onClick={(e) => { e.stopPropagation(); prev(); }}><ChevronLeft size={24} /></button>
          <button type="button" aria-label="Ảnh sau" className={`${btn} right-4 hidden sm:grid`} onClick={(e) => { e.stopPropagation(); next(); }}><ChevronRight size={24} /></button>
        </>
      )}
    </div>
  );
}
