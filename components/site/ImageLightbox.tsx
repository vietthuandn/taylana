"use client";

/* Xem ảnh phóng to: nút trước/sau, vuốt trên điện thoại, phím ←/→, Esc để đóng. */
import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function ImageLightbox({ images, index, onIndex, onClose, alt = "" }: {
  images: string[]; index: number; onIndex: (i: number) => void; onClose: () => void; alt?: string;
}) {
  const touch = useRef<number | null>(null);
  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);
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
  const btn = "absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:grid";
  return (
    <div className="fixed inset-0 z-[80] bg-black/90" role="dialog" aria-modal aria-label="Xem ảnh" onClick={onClose}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 48 && images.length > 1) (dx > 0 ? prev : next)();
      }}>
      <div className="absolute inset-x-0 top-0 flex h-14 items-center justify-between px-4 text-[14px] text-white/80">
        <span className="tabular-nums">{images.length > 1 ? `${index + 1} / ${images.length}` : ""}</span>
        <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><X size={20} /></button>
      </div>
      <div className="absolute inset-x-4 bottom-8 top-14 sm:inset-x-24" onClick={(e) => e.stopPropagation()}>
        <Image key={images[index]} src={images[index]} alt={alt} fill sizes="100vw" className="animate-[fadeIn_.25s_ease] object-contain" />
      </div>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Ảnh trước" className={`${btn} left-4`} onClick={(e) => { e.stopPropagation(); prev(); }}><ChevronLeft size={24} /></button>
          <button type="button" aria-label="Ảnh sau" className={`${btn} right-4`} onClick={(e) => { e.stopPropagation(); next(); }}><ChevronRight size={24} /></button>
        </>
      )}
    </div>
  );
}
