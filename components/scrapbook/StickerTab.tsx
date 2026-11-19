"use client";

/* Scrapbook → tab "Sticker": "Sticker của bạn" (khách tự tải, xoá nền + viền trắng) ở đầu, rồi thư viện:
   lọc theo nhóm / tông màu, lưới 4 cột trên nền caro, tải dần khi cuộn.
   Bấm để thêm (nửa dưới bề mặt, lớp trên cùng), hoặc kéo thả thẳng lên bề mặt. Chỉ lấy chất liệu đang bật trong admin. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { ASSET_DRAG } from "./SurfaceView";
import { TONES, type ScrapAsset } from "@/lib/scrapbook/types";
import { cx } from "@/components/ui/styles";

const GROUPS: [string, string][] = [["all", "Tất cả"], ["tape", "Băng dính"], ["sticker", "Sticker"], ["frame", "Khung"], ["doodle", "Doodle"], ["paper", "Mảnh giấy"]];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
export { ASSET_DRAG };
export type UserStickerItem = { id: string; url: string };

export function StickerTab({ assets, onAdd, mine = [], onUpload, onAddMine, onRemoveMine }: {
  assets: ScrapAsset[]; onAdd: (a: ScrapAsset) => void;
  mine?: UserStickerItem[]; onUpload?: (files: File[]) => void; onAddMine?: (id: string) => void; onRemoveMine?: (id: string) => void;
}) {
  const upIn = useRef<HTMLInputElement>(null);
  const [grp, setGrp] = useState("all");
  const [tone, setTone] = useState("all");
  const [limit, setLimit] = useState(24);
  const more = useRef<HTMLDivElement>(null);
  const list = useMemo(() => assets.filter((a) => a.is_active && a.grp !== "texture"
    && (grp === "all" || a.grp === grp) && (tone === "all" || a.tone === tone)), [assets, grp, tone]);
  useEffect(() => { setLimit(24); }, [grp, tone]);
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
      {onUpload && (
        <section className="space-y-2 rounded-[10px] border border-[#e5e5e7] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">Sticker của bạn</p>
            <button type="button" onClick={() => upIn.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Upload size={13} /> Tải sticker của bạn</button>
            <input ref={upIn} type="file" multiple accept="image/png,image/jpeg,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => { if (e.target.files?.length) onUpload([...e.target.files]); e.target.value = ""; }} />
          </div>
          {mine.length ? (
            <div className="grid grid-cols-4 gap-2">
              {mine.map((m) => (
                <div key={m.id} className={cx("group relative grid aspect-square place-items-center overflow-hidden rounded-[8px] border border-[#e5e5e7] p-1.5", checker)}>
                  <button type="button" onClick={() => onAddMine?.(m.id)} draggable onDragStart={(e) => { e.dataTransfer.setData(ASSET_DRAG, `u:${m.id}`); e.dataTransfer.effectAllowed = "copy"; }} className="grid h-full w-full place-items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                  </button>
                  <button type="button" onClick={() => onRemoveMine?.(m.id)} aria-label="Xoá sticker" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[#dc2626] shadow md:opacity-0 md:group-hover:opacity-100"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#a1a1aa]">PNG nền trong suốt dùng luôn · ảnh chụp sẽ được xoá nền, thêm viền trắng tuỳ chọn.</p>}
        </section>
      )}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{GROUPS.filter(([k]) => k === "all" || assets.some((a) => a.grp === k)).map(([k, t]) => <button key={k} type="button" onClick={() => setGrp(k)} className={chip(grp === k)}>{t}</button>)}</div>
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
      <p className="text-[12px] text-[#a1a1aa]">Bấm để thêm (sticker luôn nằm trên cùng), hoặc kéo thả lên thiết kế.</p>
    </div>
  );
}
