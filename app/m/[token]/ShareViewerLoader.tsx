"use client";
import dynamic from "next/dynamic";

// Trình xem mockup chỉ chạy trên trình duyệt (canvas, WebGL)
export const ShareViewerLoader = dynamic(() => import("@/components/mockup-viewer/ShareViewer").then((m) => m.ShareViewer), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-[14px] text-[#71717a]">Đang mở mockup...</div>,
});
