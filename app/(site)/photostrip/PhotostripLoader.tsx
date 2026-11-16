"use client";
import dynamic from "next/dynamic";
import { CdDisc } from "@/components/ui/Shapes";

export const PhotostripLoader = dynamic(() => import("./PhotostripEditor").then((m) => m.PhotostripEditor), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center font-semibold text-ink-900">
      <CdDisc spin className="mx-auto mb-4 w-20" /> Đang mở bàn thiết kế...
    </div>
  ),
});
