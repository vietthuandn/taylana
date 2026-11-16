"use client";
import dynamic from "next/dynamic";
import { CdIcon } from "@/components/decor/Icons";

// Trình thiết kế chỉ chạy trên trình duyệt (canvas)
export const CustomCdLoader = dynamic(() => import("./CustomCdEditor").then((m) => m.CustomCdEditor), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center text-cocoa-500">
      <CdIcon className="mx-auto mb-3 h-16 w-16 animate-spin-slow" /> Đang mở bàn thiết kế...
    </div>
  ),
});
