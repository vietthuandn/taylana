"use client";
/* Thanh tiến độ tải file lên (mảnh, trên cùng trang) — tự hiện khi có file đang PUT lên kho lưu trữ (lib/storage/client.ts). */
import { useEffect, useState } from "react";
import { UPLOAD_EVENT, type Progress } from "@/lib/storage/client";

export function UploadProgress() {
  const [map, setMap] = useState<Record<string, Progress>>({});
  useEffect(() => {
    const h = (e: Event) => {
      const p = (e as CustomEvent<Progress>).detail;
      setMap((m) => { const n = { ...m }; if (p.done) delete n[p.id]; else n[p.id] = p; return n; });
    };
    window.addEventListener(UPLOAD_EVENT, h);
    return () => window.removeEventListener(UPLOAD_EVENT, h);
  }, []);
  const list = Object.values(map);
  if (!list.length) return null;
  const total = list.reduce((t, p) => t + p.total, 0), loaded = list.reduce((t, p) => t + p.loaded, 0);
  const pct = total ? Math.round((loaded / total) * 100) : 0;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Đang tải file lên">
      <div className="h-[3px] bg-[#ff5fa2] transition-[width] duration-200" style={{ width: `${Math.max(3, pct)}%` }} />
      <span className="absolute right-2 top-1 rounded-full bg-[#18181b]/80 px-2 py-0.5 text-[11px] font-medium text-white">Đang tải lên {pct}%</span>
    </div>
  );
}
