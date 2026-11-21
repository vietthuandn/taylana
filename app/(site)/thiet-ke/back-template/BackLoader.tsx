"use client";
import dynamic from "next/dynamic";

// Back cover Template: dùng chung bộ dựng scrapbook (chỉ chạy trên trình duyệt — ảnh khách không lên server)
export const BackLoader = dynamic(() => import("@/components/scrapbook/ScrapbookStudio").then((m) => m.ScrapbookStudio), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-[14px] text-[#71717a]">Đang mở Back cover Template...</div>,
});
