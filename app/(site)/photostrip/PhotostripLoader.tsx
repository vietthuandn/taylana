"use client";
import dynamic from "next/dynamic";
import { FilmIcon } from "@/components/decor/Icons";

export const PhotostripLoader = dynamic(() => import("./PhotostripEditor").then((m) => m.PhotostripEditor), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center text-cocoa-500">
      <FilmIcon className="mx-auto mb-3 h-16 w-16 animate-wiggle" /> Đang mở bàn thiết kế...
    </div>
  ),
});
