"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ShowcaseItem } from "@/lib/types";
import { X } from "lucide-react";

export function ShowcaseGrid({ items }: { items: ShowcaseItem[] }) {
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))), [items]);
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<ShowcaseItem | null>(null);
  const shown = items.filter((i) =>
    (!cat || i.category === cat) &&
    (!q || `${i.title} ${i.category} ${i.description}`.toLowerCase().includes(q)));

  if (!items.length) {
    return (
      <div className="rounded-[12px] border border-[#e5e5e7] bg-white py-12 text-center text-[#71717a]">
        Tiệm đang chụp ảnh sản phẩm, sắp có rồi!
      </div>
    );
  }

  return (
    <>
      {q && (
        <p className="mb-4 text-[14px] text-[#71717a]">
          Kết quả cho “<b className="text-[#18181b]">{q}</b>”: {shown.length} sản phẩm ·{" "}
          <Link href="/san-pham" className="font-medium text-[#ff5fa2] hover:text-[#e0468a]">Xoá tìm kiếm</Link>
        </p>
      )}
      {categories.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {["", ...categories].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} aria-pressed={cat === c}
              className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium ${cat === c ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#3f3f46] hover:border-[#d4d4d8]"}`}>
              {c || "Tất cả"}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((it) => (
          <li key={it.id}>
            <button onClick={() => setOpen(it)} className="group block w-full overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white text-left transition-shadow hover:shadow-[0_4px_16px_rgb(0_0_0/0.06)]">
              <div className="relative aspect-square w-full overflow-hidden bg-[#f4f4f5]">
                <Image src={it.image_url} alt={it.title || "Sản phẩm"} fill sizes="(min-width:1024px) 280px, (min-width:768px) 33vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-105" />
              </div>
              {(it.title || it.category) && (
                <div className="p-3">
                  {it.title && <p className="truncate text-[14px] font-medium text-[#18181b]">{it.title}</p>}
                  {it.category && <p className="text-[12px] text-[#71717a]">{it.category}</p>}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="py-8 text-center text-[#71717a]">Không có sản phẩm nào khớp.</p>}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal>
          <div className="max-h-full w-full max-w-lg overflow-auto rounded-[12px] border border-[#e5e5e7] bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-square w-full overflow-hidden rounded-[8px] bg-[#f4f4f5]">
              <Image src={open.image_url} alt={open.title} fill sizes="512px" className="object-contain" />
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-semibold">{open.title}</h3>
                {open.category && <span className="text-[13px] text-[#71717a]">{open.category}</span>}
              </div>
              <button className="grid h-8 w-8 place-items-center rounded-[8px] text-[#71717a] hover:bg-[#f4f4f5]" onClick={() => setOpen(null)} aria-label="Đóng"><X size={16} /></button>
            </div>
            {open.description && <p className="mt-2 whitespace-pre-line text-[14px] text-[#3f3f46]">{open.description}</p>}
          </div>
        </div>
      )}
    </>
  );
}
