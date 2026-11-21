"use client";

/* Danh sách mẫu chia nhóm có tiêu đề (vd "5 ảnh" … "10 ảnh"), chip lọc ở trên; nhóm khớp số ảnh của khách lên đầu với nhãn
   "Vừa với số ảnh của bạn". Ảnh thu nhỏ dựng bằng ảnh của khách (thiếu thì ảnh thử), chỉ dựng khi cuộn tới (tải dần). */
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/styles";

export type GalleryItem = { id: string; label: string; sub?: string; make: () => string; key: string };
export type GalleryGroup = { id: string; title: string; chip: string; match?: boolean; items: GalleryItem[] };

function Thumb({ item, round, aspect }: { item: GalleryItem; round: boolean; aspect: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    const e = el.current;
    if (!e) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setSeen(true); }, { rootMargin: "120px" });
    io.observe(e);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen || url?.key === item.key) return;
    const t = setTimeout(() => { try { setUrl({ key: item.key, url: item.make() }); } catch { /* bỏ qua */ } }, 30);
    return () => clearTimeout(t);
  }, [seen, item, url?.key]);
  return (
    <span ref={el} className={cx("block overflow-hidden bg-[#f4f4f5]", round ? "rounded-full" : "rounded-[6px]")} style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url.url} alt="" className="h-full w-full" />}
    </span>
  );
}

export function TemplateGallery({ groups, current, onPick, round, aspect = "1 / 1", cols = "grid-cols-3 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-5" }: {
  groups: GalleryGroup[]; current: string | null; onPick: (id: string) => void; round?: boolean; aspect?: string; cols?: string;
}) {
  const [filter, setFilter] = useState("all");
  const ordered = [...groups].sort((a, b) => Number(!!b.match) - Number(!!a.match));
  const shown = ordered.filter((g) => filter === "all" || g.id === filter);
  return (
    <div className="space-y-3">
      {groups.length > 1 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[{ id: "all", chip: "Tất cả" }, ...groups].map((g) => (
            <button key={g.id} type="button" onClick={() => setFilter(g.id)} className={cx("h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium", filter === g.id ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]")}>{g.chip}</button>
          ))}
        </div>
      )}
      {shown.map((g) => (
        <div key={g.id}>
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-[#3f3f46]">{g.title}{g.match && <span className="rounded-full bg-[#ecfdf3] px-2 text-[11px] font-medium text-[#16a34a]">Vừa với số ảnh của bạn</span>}</p>
          <div className={cx("grid gap-2", cols)}>
            {g.items.map((it) => (
              <button key={it.id} type="button" onClick={() => onPick(it.id)} title={it.label}
                className={cx("rounded-[10px] border p-1 text-center", current === it.id ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
                <Thumb item={it} round={!!round} aspect={aspect} />
                <span className="mt-1 block truncate text-[11px] text-[#52525b]">{it.label}</span>
                {it.sub && <span className="block truncate text-[10px] text-[#a1a1aa]">{it.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
