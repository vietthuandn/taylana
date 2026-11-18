"use client";

/* CD Scrapbook → tab "Sticker": tìm kiếm + lọc theo nhóm / tông màu, lưới 4 cột trên nền caro, tải dần khi cuộn.
   Bấm để thêm vào giữa đĩa, hoặc kéo thả thẳng lên đĩa. Chỉ lấy chất liệu đang bật trong admin. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { TONES, type ScrapAsset } from "@/lib/scrapbook/types";
import { cx } from "@/components/ui/styles";

const GROUPS: [string, string][] = [["all", "Tất cả"], ["tape", "Băng dính"], ["sticker", "Sticker"], ["frame", "Khung"], ["doodle", "Doodle"], ["paper", "Mảnh giấy"]];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
export const ASSET_DRAG = "text/scrap-asset";

export function StickerTab({ assets, onAdd }: { assets: ScrapAsset[]; onAdd: (a: ScrapAsset) => void }) {
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState("all");
  const [tone, setTone] = useState("all");
  const [limit, setLimit] = useState(24);
  const more = useRef<HTMLDivElement>(null);
  const list = useMemo(() => assets.filter((a) => a.is_active && a.grp !== "texture"
    && (grp === "all" || a.grp === grp) && (tone === "all" || a.tone === tone)
    && (!q.trim() || a.name.toLowerCase().includes(q.trim().toLowerCase()))), [assets, grp, tone, q]);
  useEffect(() => { setLimit(24); }, [grp, tone, q]);
  // tải dần khi cuộn tới cuối lưới
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setLimit((l) => l + 24); });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);
  const chip = (on: boolean) => cx("h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm sticker..." className="h-10 w-full rounded-[8px] border border-[#e5e5e7] pl-9 pr-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
      </label>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{GROUPS.map(([k, t]) => <button key={k} type="button" onClick={() => setGrp(k)} className={chip(grp === k)}>{t}</button>)}</div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        <button type="button" onClick={() => setTone("all")} className={chip(tone === "all")}>Mọi màu</button>
        {TONES.filter((t) => t.id !== "any").map((t) => (
          <button key={t.id} type="button" onClick={() => setTone(t.id)} title={t.name} aria-label={t.name}
            className={cx("h-7 w-7 shrink-0 rounded-full border-2", tone === t.id ? "border-[#ff5fa2]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: t.hex }} />
        ))}
      </div>
      {list.length ? (
        <div className="grid grid-cols-4 gap-2">
          {list.slice(0, limit).map((a) => (
            <button key={a.id} type="button" title={a.name} onClick={() => onAdd(a)} draggable
              onDragStart={(e) => { e.dataTransfer.setData(ASSET_DRAG, a.id); e.dataTransfer.effectAllowed = "copy"; }}
              className={cx("grid aspect-square place-items-center overflow-hidden rounded-[8px] border border-[#e5e5e7] p-1.5 hover:border-[#ff5fa2]", checker)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" loading="lazy" draggable={false} />
            </button>
          ))}
          {limit < list.length && <div ref={more} className="col-span-4 h-6" />}
        </div>
      ) : <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">{assets.length ? "Không có sticker phù hợp." : "Tiệm chưa có sticker nào."}</p>}
      <p className="text-[12px] text-[#a1a1aa]">Bấm để thêm vào giữa đĩa, hoặc kéo thả lên đĩa.</p>
    </div>
  );
}
