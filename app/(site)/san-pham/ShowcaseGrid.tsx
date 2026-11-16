"use client";

import { useMemo, useState } from "react";
import type { ShowcaseItem } from "@/lib/types";
import { CdIcon } from "@/components/decor/Icons";

const tilts = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1"];

export function ShowcaseGrid({ items }: { items: ShowcaseItem[] }) {
  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))), [items]);
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<ShowcaseItem | null>(null);
  const shown = cat ? items.filter((i) => i.category === cat) : items;

  if (!items.length) {
    return (
      <div className="py-10 text-center text-cocoa-500">
        <CdIcon className="mx-auto mb-3 h-16 w-16 animate-spin-slow" />
        Tiệm đang chụp ảnh sản phẩm, sắp có rồi nè!
      </div>
    );
  }

  return (
    <>
      {categories.length > 1 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {["", ...categories].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)}
              className={`pop-sm rounded-full px-4 py-2 font-display ${cat === c ? "bg-pink-300" : "bg-cream-50 hover:bg-pink-100"}`}>
              {c || "Tất cả"}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((it, i) => (
          <li key={it.id}>
            <button onClick={() => setOpen(it)} className={`group block w-full text-left ${tilts[i % 4]} transition hover:rotate-0`}>
              <div className="sticker aspect-square overflow-hidden rounded-sm bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image_url} alt={it.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              {it.title && <p className="mt-2 text-center font-display text-lg leading-tight">{it.title}</p>}
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-cocoa-700/60 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal>
          <div className="pop max-h-full w-full max-w-lg overflow-auto rounded-[2rem] bg-cream-50 p-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.image_url} alt={open.title} className="w-full rounded-2xl" />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl">{open.title}</h3>
                {open.category && <span className="text-sm text-cocoa-400">{open.category}</span>}
              </div>
              <button className="btn !min-h-10 bg-pink-200 !px-4 !text-base" onClick={() => setOpen(null)}>Đóng</button>
            </div>
            {open.description && <p className="mt-2 whitespace-pre-line text-cocoa-600">{open.description}</p>}
          </div>
        </div>
      )}
    </>
  );
}
