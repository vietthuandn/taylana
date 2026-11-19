"use client";
import dynamic from "next/dynamic";

// Bộ dựng scrapbook chỉ chạy trên trình duyệt (canvas, IndexedDB) — ảnh khách không lên server
export const ScrapbookLoader = dynamic(() => import("@/components/scrapbook/ScrapbookStudio").then((m) => m.ScrapbookStudio), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-[14px] text-[#71717a]">Đang mở CD Template...</div>,
});
