"use client";
import dynamic from "next/dynamic";

// Bộ dàn trang chạy hoàn toàn trên trình duyệt (canvas, IndexedDB)
export const LyricsLoader = dynamic(() => import("@/components/lyrics-booklet/LyricsStudio").then((m) => m.LyricsStudio), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-[14px] text-[#71717a]">Đang mở Booklet Lyrics...</div>,
});
