"use client";

/* Phần giao diện dùng chung của CD Scrapbook + Booklet Scrapbook: danh sách ảnh (đánh dấu đang dùng / chưa dùng, kéo thả lên ô),
   chọn ảnh cho ô, thêm ô ảnh (hình dạng / khung), đổi khung, xác nhận bản quyền khi đặt in. */
import { useMemo, useRef, useState } from "react";
import { RefreshCw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { PHOTO_DRAG } from "./SurfaceView";

export type Photo = { id: string; name: string; blob: Blob; url: string; img: HTMLCanvasElement };
export const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const uid = () => Math.random().toString(36).slice(2, 10);
export async function readPhoto(file: Blob, name: string, id = uid()): Promise<Photo> {
  const url = URL.createObjectURL(file);
  const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("bad")); i.src = url; });
  const k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, c.width, c.height);
  return { id, name, blob: file, url, img: c };
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className={cx("flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-[14px] bg-white shadow-xl", wide ? "max-w-[640px]" : "max-w-[460px]")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#efeff1] px-5 py-3">
          <p className="text-[16px] font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-[#71717a] hover:text-[#18181b]"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------- danh sách ảnh ----------
export function PhotoPanel({ photos, used, max, hint, onAdd, onReplace, onRemove, onReorder, onAddSlot }: {
  photos: Photo[]; used: Set<string>; max: number; hint: string;
  onAdd: (files: File[]) => void; onReplace: (id: string, f: File) => void; onRemove: (id: string) => void; onReorder: (from: number, to: number) => void; onAddSlot?: () => void;
}) {
  const fileIn = useRef<HTMLInputElement>(null), replaceIn = useRef<HTMLInputElement>(null), replaceId = useRef<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const free = photos.filter((p) => !used.has(p.id)).length;
  return (
    <section>
      <p className="mb-2 text-[14px] font-semibold text-[#18181b]">Ảnh của bạn <span className="text-[12px] font-normal text-[#71717a]">({photos.length}/{max}{photos.length ? ` · ${free} chưa dùng` : ""})</span></p>
      <button type="button" onClick={() => fileIn.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) onAdd([...e.dataTransfer.files]); }}
        className="grid w-full place-items-center rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] px-4 py-4 text-center hover:border-[#ff5fa2]">
        <Upload size={20} className="mb-1 text-[#a1a1aa]" />
        <span className="text-[14px] font-medium text-[#18181b]">Kéo thả hoặc bấm để chọn ảnh</span>
        <span className="text-[12px] text-[#71717a]">{hint}</span>
      </button>
      <input ref={fileIn} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) onAdd([...e.target.files]); e.target.value = ""; }} />
      <input ref={replaceIn} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && replaceId.current) onReplace(replaceId.current, f); }} />
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} draggable onDragStart={(e) => { setDragIdx(i); e.dataTransfer.setData(PHOTO_DRAG, p.id); e.dataTransfer.effectAllowed = "copyMove"; }} onDragEnd={() => setDragIdx(null)} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) onReorder(dragIdx, i); setDragIdx(null); }}
              title={p.name} className={cx("group relative aspect-square cursor-grab overflow-hidden rounded-[8px] border bg-[#f4f4f5]", used.has(p.id) ? "border-[#e5e5e7]" : "border-dashed border-[#f59e0b]", dragIdx === i && "opacity-40")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className={cx("h-full w-full object-cover", !used.has(p.id) && "opacity-70")} draggable={false} />
              <span className={cx("pointer-events-none absolute left-1 top-1 rounded-[4px] px-1 text-[9px] font-medium leading-[14px] text-white", used.has(p.id) ? "bg-[#16a34a]" : "bg-[#f59e0b]")}>{used.has(p.id) ? "Đang dùng" : "Chưa dùng"}</span>
              <div className="absolute bottom-1 right-1 flex gap-1 md:inset-0 md:items-center md:justify-center md:bg-black/40 md:opacity-0 md:group-hover:opacity-100">
                <button type="button" title="Thay ảnh" aria-label="Thay ảnh" onClick={() => { replaceId.current = p.id; replaceIn.current?.click(); }} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#18181b] shadow"><RefreshCw size={12} /></button>
                <button type="button" title="Xoá" aria-label="Xoá" onClick={() => onRemove(p.id)} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#dc2626] shadow"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onAddSlot && <button type="button" onClick={onAddSlot} className="inline-flex h-8 items-center gap-1 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]">+ Thêm ô ảnh</button>}
        {photos.length > 0 && <p className="text-[12px] text-[#a1a1aa]">Kéo ảnh thả lên 1 ô để gán ảnh vào ô đó.</p>}
      </div>
    </section>
  );
}

// ---------- chọn ảnh cho 1 ô ----------
export function PickPhotoModal({ photos, used, onPick, onUpload, onClose }: { photos: Photo[]; used: Set<string>; onPick: (id: string) => void; onUpload: (f: File) => void; onClose: () => void }) {
  const fileIn = useRef<HTMLInputElement>(null);
  const list = useMemo(() => [...photos].sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id))), [photos, used]);
  return (
    <Modal title="Chọn ảnh cho ô" onClose={onClose}>
      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={() => fileIn.current?.click()} className="grid aspect-square place-items-center rounded-[8px] border-[1.5px] border-dashed border-[#d4d4d8] text-center text-[12px] font-medium text-[#52525b] hover:border-[#ff5fa2]"><span><Upload size={16} className="mx-auto mb-1" />Tải ảnh mới</span></button>
        {list.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick(p.id)} className="relative aspect-square overflow-hidden rounded-[8px] border border-[#e5e5e7] hover:ring-2 hover:ring-[#ff5fa2]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            {used.has(p.id) && <span className="absolute left-1 top-1 rounded-[4px] bg-black/60 px-1 text-[9px] leading-[14px] text-white">Đang dùng</span>}
          </button>
        ))}
      </div>
      <input ref={fileIn} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
    </Modal>
  );
}

// ---------- xác nhận bản quyền (1 lần cho mỗi thiết kế) ----------
export function RightsModal({ onOk, onClose }: { onOk: () => void; onClose: () => void }) {
  const [tick, setTick] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-semibold">Trước khi đặt in</p>
        <label className="mt-3 flex items-start gap-2 text-[14px] text-[#3f3f46]">
          <input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff5fa2]" />
          Tôi chịu trách nhiệm về bản quyền nội dung (lời bài hát, hình ảnh) trong thiết kế này.
        </label>
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button disabled={!tick} onClick={onOk}>Tiếp tục</Button></div>
      </div>
    </div>
  );
}
