"use client";
/* Mục "Mẫu" (khách): mẫu cố định nhóm theo danh mục — tiêu đề danh mục + lưới thumbnail (3 cột: mặt đĩa / trang đơn,
   2 cột: trang đôi), thứ tự theo admin. Mỗi thẻ: tên mẫu + số ô ảnh. */
import { groupByCategory, type Category, type DesignTpl } from "@/lib/scrapbook/library";
import { useEffect, useState } from "react";
import { renderSurface } from "@/lib/scrapbook/render";
import { cx } from "@/components/ui/styles";

/** mẫu chưa có ảnh thu nhỏ (vd. mẫu mẫu có sẵn từ SQL) → vẽ thẳng trên trình duyệt (ô ảnh trống, không sticker ảnh) */
export function LiveThumb({ t, className }: { t: DesignTpl; className?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    try { setUrl(renderSurface({ template: t.config.template, text: { main: "", sub: "" }, size: 360 }).canvas.toDataURL("image/jpeg", 0.85)); } catch { setUrl(""); }
  }, [t.config.template]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className ?? "h-full w-full object-contain"} /> : <span className="px-1 text-center text-[10px] text-[#a1a1aa]">{t.name}</span>;
}

export function LibraryGrid({ items, cats, cols = 3, current, onPick, round, empty, aspect }: {
  items: DesignTpl[]; cats: Category[]; cols?: 2 | 3; current?: string | null; onPick: (d: DesignTpl) => void; round?: boolean; empty?: React.ReactNode; aspect?: string;
}) {
  const groups = groupByCategory(items, cats.filter((c) => c.is_active));
  if (!groups.length) return <>{empty ?? <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">Chưa có mẫu nào.</p>}</>;
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.cat?.id ?? "other"}>
          <p className="mb-2 text-[13px] font-semibold text-[#18181b]">{g.cat?.name ?? "Khác"}</p>
          <div className={cx("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {g.items.map((d) => (
              <button key={d.id} type="button" onClick={() => onPick(d)} title={d.name}
                className={cx("group min-w-0 rounded-[10px] border bg-white p-1 text-left transition-colors", current === d.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/25" : "border-[#e5e5e7] hover:border-[#ff5fa2]")}>
                <span className={cx("grid place-items-center overflow-hidden bg-[#f4f4f5]", aspect ?? (cols === 2 ? "aspect-[2/1]" : "aspect-square"), round ? "rounded-full" : "rounded-[6px]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.thumbnail_url ? <img src={d.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-contain" /> : <LiveThumb t={d} />}
                </span>
                <span className="mt-1 block truncate px-0.5 text-[11px] font-medium text-[#3f3f46]">{d.name}</span>
                <span className="block px-0.5 text-[10px] text-[#a1a1aa]">{d.photo_count} ảnh</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
