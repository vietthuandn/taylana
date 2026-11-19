"use client";

import { useEffect } from "react";
import { confirmDialog } from "@/components/ui/dialog";

// Hỏi trước khi rời trang (tải lại, đóng tab, bấm link khác) khi còn ảnh chưa tải xuống
export const LEAVE_MSG = "Ảnh chưa tải xuống sẽ bị mất. Rời trang?";
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = LEAVE_MSG; return LEAVE_MSG; };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a");
      // bỏ qua link tải xuống (a[download], blob:/data:) — không phải rời trang
      if (!a || a.hasAttribute("download") || /^(blob|data):/i.test(a.href) || a.target === "_blank" || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin || url.pathname === location.pathname) return;
      // hỏi bằng hộp thoại của web: chặn điều hướng, đồng ý thì mới chuyển trang
      e.preventDefault(); e.stopPropagation();
      confirmDialog({ title: "Rời trang?", message: "Ảnh chưa tải xuống sẽ bị mất.", confirmText: "Rời trang", cancelText: "Ở lại", danger: true }).then((ok) => {
        if (!ok) return;
        window.removeEventListener("beforeunload", before);
        location.assign(url.href);
      });
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", click, true); };
  }, [active]);
}
