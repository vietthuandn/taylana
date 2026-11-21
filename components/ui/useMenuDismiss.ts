"use client";
/* Menu / ngăn kéo đang mở: Esc → đóng · chuyển trang → tự đóng · khoá cuộn trang trên điện thoại (< 768px).
   (Bấm / chạm ra ngoài: mỗi menu tự vẽ 1 lớp nền phủ, bấm vào lớp nền thì đóng.) */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function useMenuDismiss(open: boolean, close: () => void) {
  const path = usePathname();
  const fn = useRef(close);
  useEffect(() => { fn.current = close; });
  // chuyển trang → đóng
  const first = useRef(path);
  useEffect(() => { if (first.current !== path) { first.current = path; fn.current(); } }, [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") fn.current(); };
    document.addEventListener("keydown", k);
    const lock = window.innerWidth < 768, html = document.documentElement, prev = html.style.overflow;
    if (lock) html.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); if (lock) html.style.overflow = prev; };
  }, [open]);
}
