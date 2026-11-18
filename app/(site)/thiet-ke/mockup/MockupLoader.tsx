"use client";
import dynamic from "next/dynamic";

// Bộ dựng mockup chỉ chạy trên trình duyệt (canvas, WebGL)
export const MockupLoader = dynamic(() => import("@/components/mockup-viewer/MockupStudio").then((m) => m.MockupStudio), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-[14px] text-[#71717a]">Đang mở trình xem mockup...</div>,
});
