"use client";

/* Khung xem trước vừa khít vùng còn trống (giữ tỉ lệ h/w). Màn hình hẹp (< md) chỉ theo chiều ngang. */
import { useEffect, useRef, useState } from "react";

export function useFitBox(ratio: number, reserveH = 0) {
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
  const width = Math.max(0, Math.floor(wide && box.h > 0 ? Math.min(box.w, (box.h - reserveH) / ratio) : box.w));
  return { area, width };
}
