"use client";

/* Scrapbook → tab "Sticker": "Sticker của bạn" (khách tự tải, xoá nền + viền trắng) ở đầu, rồi thư viện:
   chip Nhóm (thứ tự admin đặt; chưa đặt thì theo số lượng) · hàng 2: chip Tag phổ biến (thu gọn được) · tông màu,
   lưới 4 cột trên nền caro (ảnh thu nhỏ), tải dần khi cuộn.
   Bấm để thêm (nửa dưới bề mặt, lớp trên cùng), hoặc kéo thả thẳng lên bề mặt. Chỉ lấy chất liệu đang bật trong admin. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { ASSET_DRAG } from "./SurfaceView";
import { TONES, type AssetGroupRow, type ScrapAsset } from "@/lib/scrapbook/types";
import { tagCounts } from "@/lib/scrapbook/assetGroups";
import { cx } from "@/components/ui/styles";

const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
export { ASSET_DRAG };
export type UserStickerItem = { id: string; url: string };

export function StickerTab({ assets, groups = [], onAdd, mine = [], onUpload, onAddMine, onRemoveMine, onSaveMine, mineTitle = "Sticker của tôi" }: {
  assets: ScrapAsset[]; groups?: AssetGroupRow[]; onAdd: (a: ScrapAsset) => void;
  mine?: UserStickerItem[]; onUpload?: (files: File[]) => void; onAddMine?: (id: string) => void; onRemoveMine?: (id: string) => void;
  onSaveMine?: (id: string) => void; mineTitle?: string; // admin (trình sửa mẫu): "Lưu vào thư viện"
}) {
  const upIn = useRef<HTMLInputElement>(null);
  const [grp, setGrp] = useState("all"); // id nhóm
  const [tag, setTag] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tone, setTone] = useState("all");
  const [limit, setLimit] = useState(24);
  const more = useRef<HTMLDivElement>(null);
  const lib = useMemo(() => assets.filter((a) => a.is_active && a.grp !== "texture"), [assets]);
  // chip Nhóm: thứ tự admin đặt (sort_order), chưa đặt (cùng thứ tự) thì theo số lượng
  const chips = useMemo(() => {
    const n = new Map<string, number>();
    for (const a of lib) if (a.group_id) n.set(a.group_id, (n.get(a.group_id) ?? 0) + 1);
    return groups.filter((g) => n.get(g.id)).map((g) => ({ ...g, count: n.get(g.id)! })).sort((a, b) => a.sort_order - b.sort_order || b.count - a.count);
  }, [lib, groups]);
  const tagList = useMemo(() => tagCounts(lib).slice(0, 24), [lib]);
  const tagBox = useRef<HTMLDivElement>(null);
  const [tagMore, setTagMore] = useState(false);
  useEffect(() => {
    const el = tagBox.current;
    if (!el) return;
    const check = () => setTagMore(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check); ro.observe(el);
    return () => ro.disconnect();
  }, [tagList, tagsOpen]);
  const list = useMemo(() => lib.filter((a) => (grp === "all" || a.group_id === grp) && (!tag || (a.tags ?? []).includes(tag)) && (tone === "all" || a.tone === tone)), [lib, grp, tag, tone]);
  useEffect(() => { setLimit(24); }, [grp, tag, tone]);
  // tải dần khi cuộn tới cuối lưới
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setLimit((l) => l + 24); });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);
  const chip = (on: boolean) => cx("h-7 rounded-full border px-2.5 text-[12px] font-medium", on ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  return (
    <div className="space-y-3">
      {onUpload && (
        <section className="space-y-2 rounded-[10px] border border-[#e5e5e7] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">{mineTitle}</p>
            <button type="button" onClick={() => upIn.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"><Upload size={13} /> Tải sticker của bạn</button>
            <input ref={upIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { if (e.target.files?.length) onUpload([...e.target.files]); e.target.value = ""; }} />
          </div>
          {mine.length ? (
            <div className="grid grid-cols-4 gap-2">
              {mine.map((m) => (
                <div key={m.id} className={cx("group relative grid aspect-square place-items-center overflow-hidden rounded-[8px] border border-[#e5e5e7] p-1.5", checker)}>
                  <button type="button" onClick={() => onAddMine?.(m.id)} draggable onDragStart={(e) => { e.dataTransfer.setData(ASSET_DRAG, `u:${m.id}`); e.dataTransfer.effectAllowed = "copy"; }} className="grid h-full w-full place-items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                  </button>
                  {onSaveMine && <button type="button" onClick={() => onSaveMine(m.id)} title="Lưu vào thư viện" aria-label="Lưu vào thư viện" className="absolute bottom-1 left-1 right-1 rounded-[5px] bg-[var(--c-primary)] py-0.5 text-[10px] font-semibold text-white shadow">Lưu vào thư viện</button>}
                  <button type="button" onClick={() => onRemoveMine?.(m.id)} aria-label="Xoá sticker" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[#dc2626] shadow md:opacity-0 md:group-hover:opacity-100"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#a1a1aa]">Tải 1 ảnh tờ nhiều sticker hoặc 1 ảnh 1 sticker — web tự tách từng món, bạn chọn món muốn giữ. Sticker chỉ lưu trên máy bạn cho tới khi lưu thiết kế / đặt in.</p>}
        </section>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setGrp("all")} className={chip(grp === "all")}>Tất cả</button>
          {chips.map((g) => <button key={g.id} type="button" onClick={() => setGrp(g.id)} className={chip(grp === g.id)}>{g.name}</button>)}
        </div>
      )}
      {tagList.length > 0 && (
        <div>
          {/* tag: tự xuống dòng, quá 2 dòng thì thu gọn + "Xem thêm" */}
          <div ref={tagBox} className={cx("flex flex-wrap gap-1.5 overflow-hidden", !tagsOpen && "max-h-[54px]")}>
            {tagList.map((t) => <button key={t.tag} type="button" onClick={() => setTag(tag === t.tag ? "" : t.tag)} className={cx(chip(tag === t.tag), "h-6 px-2 text-[11px]")}>#{t.tag}</button>)}
          </div>
          {(tagMore || tagsOpen) && <button type="button" onClick={() => setTagsOpen((v) => !v)} className="mt-1 text-[12px] font-medium text-[#71717a] hover:text-[var(--c-primary)]" aria-expanded={tagsOpen}>{tagsOpen ? "Thu gọn" : "Xem thêm"}</button>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setTone("all")} className={chip(tone === "all")}>Mọi màu</button>
        {TONES.filter((t) => t.id !== "any").map((t) => (
          <button key={t.id} type="button" onClick={() => setTone(t.id)} title={t.name} aria-label={t.name}
            className={cx("h-7 w-7 rounded-full border-2", tone === t.id ? "border-[var(--c-primary)]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: t.hex }} />
        ))}
      </div>
      {list.length ? (
        <div className="grid grid-cols-4 gap-2">
          {list.slice(0, limit).map((a) => (
            <button key={a.id} type="button" title={a.name} onClick={() => onAdd(a)} draggable
              onDragStart={(e) => { e.dataTransfer.setData(ASSET_DRAG, a.id); e.dataTransfer.effectAllowed = "copy"; }}
              className={cx("grid aspect-square place-items-center overflow-hidden rounded-[8px] border border-[#e5e5e7] p-1.5 hover:border-[var(--c-primary)]", checker)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.thumb_url || a.url} alt={a.name} className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" draggable={false} />
            </button>
          ))}
          {limit < list.length && <div ref={more} className="col-span-4 h-6" />}
        </div>
      ) : <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">{assets.length ? "Không có sticker phù hợp." : "Tiệm chưa có sticker nào."}</p>}
      <p className="text-[12px] text-[#a1a1aa]">Bấm để thêm (sticker luôn nằm trên cùng), hoặc kéo thả lên thiết kế.</p>
    </div>
  );
}
