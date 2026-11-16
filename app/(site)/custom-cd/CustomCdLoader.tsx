"use client";
import dynamic from "next/dynamic";
import { CdDisc } from "@/components/ui/Shapes";

// Trình thiết kế chỉ chạy trên trình duyệt (canvas)
export const CustomCdLoader = dynamic(() => import("./CustomCdEditor").then((m) => m.CustomCdEditor), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center font-semibold text-ink-900">
      <CdDisc spin className="mx-auto mb-4 w-20" /> Đang mở bàn thiết kế...
    </div>
  ),
});
