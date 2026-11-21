"use client";

/* Gallery masonry (máy tính 3 cột, điện thoại 2 cột, cách 8px, bo 8px), ảnh tải dần.
   Bấm ảnh mở lightbox: nút trước/sau, vuốt trên điện thoại, phím ←/→, Esc để đóng. */
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ImageLightbox } from "@/components/site/ImageLightbox";
import type { ShowcaseItem } from "@/lib/types";

export function Gallery({ items }: { items: ShowcaseItem[] }) {
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const shown = q ? items.filter((i) => `${i.title} ${i.category} ${i.description}`.toLowerCase().includes(q)) : items;
  const [open, setOpen] = useState<number | null>(null);

  if (!items.length) return <p className="py-16 text-center text-[14px] text-[#71717a]">Tiệm đang chụp ảnh sản phẩm, sắp có rồi!</p>;
  return (
    <>
      {q && (
        <p className="mb-4 text-[14px] text-[#71717a]">
          Kết quả cho “<b className="text-[#18181b]">{q}</b>”: {shown.length} ảnh · <Link href="/ve-chung-toi" className="font-medium text-[var(--c-primary)] hover:text-[#e0468a]">Xem tất cả</Link>
        </p>
      )}
      <ul className="columns-2 gap-2 lg:columns-3">
        {shown.map((it, i) => (
          <li key={it.id} className="mb-2 break-inside-avoid">
            <button type="button" onClick={() => setOpen(i)} className="block w-full overflow-hidden rounded-[8px] bg-[#f4f4f5]" aria-label={it.title || "Xem ảnh"}>
              <Image src={it.image_url} alt={it.title || "Sản phẩm"} width={600} height={600} loading="lazy"
                sizes="(min-width:1024px) 370px, 50vw" className="h-auto w-full transition-opacity duration-300 hover:opacity-90" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && shown[open] && (
        <ImageLightbox images={shown.map((x) => x.image_url)} index={open} onIndex={setOpen} onClose={() => setOpen(null)} alt={shown[open].title || "Sản phẩm"} />
      )}
    </>
  );
}
