"use client";
import dynamic from "next/dynamic";

// Bộ dựng booklet scrapbook chỉ chạy trên trình duyệt (canvas, IndexedDB) — ảnh khách không lên server cho tới khi đặt đơn
export const BookletScrapLoader = dynamic(() => import("@/components/scrapbook/BookletScrapStudio").then((m) => m.BookletScrapStudio), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-[14px] text-[#71717a]">Đang mở Booklet Template...</div>,
});
