"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ShowcaseItem } from "@/lib/types";
import { CdDisc, WavyFrame } from "@/components/ui/Shapes";

const borders = ["lime", "violet", "hot"] as const;

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
      <div className="card py-12 text-center">
        <CdDisc spin className="mx-auto mb-4 w-24" />
        Tiệm đang chụp ảnh sản phẩm, sắp có rồi!
      </div>
    );
  }

  return (
    <>
      {q && (
        <p className="mb-4">
          Kết quả cho “<b className="text-ink-900">{q}</b>”: {shown.length} sản phẩm ·{" "}
          <Link href="/san-pham" className="font-semibold underline">Xoá tìm kiếm</Link>
        </p>
      )}
      {categories.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4">
          {["", ...categories].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} aria-pressed={cat === c} className="chip shrink-0">
              {c || "Tất cả"}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((it, i) => (
          <li key={it.id}>
            <button onClick={() => setOpen(it)} className="group block w-full text-left">
              <WavyFrame shape={i % 3 === 1 ? "flower" : "cloud"} border={borders[i % 3]} className="aspect-square w-full">
                <Image src={it.image_url} alt={it.title || "Sản phẩm"} fill sizes="(min-width:1024px) 280px, (min-width:768px) 33vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-105" />
              </WavyFrame>
              {it.title && <p className="mt-3 font-display text-lg uppercase leading-tight text-ink-900">{it.title}</p>}
              {it.category && <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">{it.category}</p>}
            </button>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="py-8 text-center">Không có sản phẩm nào khớp.</p>}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/70 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal>
          <div className="max-h-full w-full max-w-lg overflow-auto rounded-[24px] bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-square w-full overflow-hidden rounded-[16px]">
              <Image src={open.image_url} alt={open.title} fill sizes="512px" className="object-contain" />
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-3xl">{open.title}</h3>
                {open.category && <span className="text-sm text-ink-500">{open.category}</span>}
              </div>
              <button className="btn btn-sm" onClick={() => setOpen(null)}>Đóng</button>
            </div>
            {open.description && <p className="mt-2 whitespace-pre-line">{open.description}</p>}
          </div>
        </div>
      )}
    </>
  );
}
