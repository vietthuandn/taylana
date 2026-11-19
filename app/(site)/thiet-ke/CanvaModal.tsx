"use client";

/* Modal "Thiết kế từ Canva Template" (mở ngay trên /thiet-ke khi bấm thẻ — ?canva=1, không chuyển trang).
   Lưới 3 cột (điện thoại 1 cột): ảnh mẫu giữa khung cao 200px (contain, đúng tỉ lệ) · tên · kích thước · nút "Dùng template"
   (gradient, icon do admin tải lên hoặc icon external link) mở link Canva ở tab mới. */
import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, X } from "lucide-react";
import type { CanvaButton, CanvaTemplate } from "@/lib/canva";
import { CanvaShape } from "@/components/site/CanvaShape";

export function CanvaModal({ templates, button }: { templates: CanvaTemplate[]; button: CanvaButton }) {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const open = params.get("canva") === "1";
  const close = useCallback(() => router.replace(path, { scroll: false }), [router, path]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = o; };
  }, [open, close]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal aria-labelledby="canva-title" onClick={close}>
      <div className="relative flex max-h-[90dvh] w-full max-w-[960px] flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#efeff1] px-5 py-4">
          <h2 id="canva-title" className="text-[18px] font-semibold text-[#18181b]">Thiết kế từ Canva Template</h2>
          <button type="button" onClick={close} aria-label="Đóng" className="grid h-9 w-9 place-items-center rounded-full text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {templates.length ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {templates.map((t) => (
                <li key={t.id} className="flex flex-col rounded-[14px] border border-[#e5e5e7] p-3">
                  <div className="flex h-[200px] items-center justify-center overflow-hidden rounded-[12px] bg-[#f7f7f8] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.image_url ? <img src={t.image_url} alt={t.name} className="h-full w-full object-contain object-center drop-shadow-[0_6px_14px_rgba(0,0,0,0.16)]" /> : <CanvaShape kind={t.kind} size={t.size_label} />}
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-[#18181b]">{t.name}</p>
                  <p className="text-[13px] text-[#71717a]">{t.size_label}</p>
                  <a href={t.canva_url} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-[#00C4CC] to-[#7D2AE8] text-[14px] font-bold text-white shadow-sm transition-opacity hover:opacity-90">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {button.icon_url ? <img src={button.icon_url} alt="" className="h-5 w-5 object-contain" /> : <ExternalLink size={18} />}
                    {button.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-[12px] bg-[#fafafa] p-6 text-center text-[14px] text-[#71717a]">Tiệm chưa có template nào.</p>}
          <p className="mt-4 text-[13px] leading-relaxed text-[#71717a]">Mở template → bấm “Sử dụng mẫu này” trên Canva để tạo bản sao → thiết kế xong tải PNG về rồi tải lên trang Lên mockup hoặc gửi cho tiệm.</p>
        </div>
      </div>
    </div>
  );
}
