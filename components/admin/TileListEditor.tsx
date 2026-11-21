"use client";
/* Sửa danh sách mục "ảnh + tên" (Trang chủ Mẫu 1, trang Thiết kế): thêm · ẩn / hiện · xoá · đổi thứ tự · ảnh · tên · link (· mô tả).
   Ảnh tự thu nhỏ trước khi tải (cạnh dài 900px, WebP) — nhẹ mà vẫn nét. */
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { newTileId, type TileItem } from "@/lib/tileItems";
import { Button, Field, ImageInput, Input, SortButtons, confirmDialog } from "@/components/admin/ui";

export function TileListEditor({ items, onChange, folder, withDesc = false, descLabel = "Mô tả (Mẫu 2)", linkOptional = false }: { items: TileItem[]; onChange: (v: TileItem[]) => void; folder: string; withDesc?: boolean; descLabel?: string; linkOptional?: boolean }) {
  const set = (i: number, p: Partial<TileItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  return (
    <div className="space-y-3">
      {items.map((o, i) => (
        <div key={o.id} className={`rounded-[12px] border border-[#e5e5e7] bg-white p-4 ${o.hidden ? "opacity-60" : ""}`}>
          <div className="mb-3 flex items-center gap-2">
            <p className="text-[14px] font-semibold text-[#18181b]">Mục {i + 1}{o.hidden && <span className="ml-2 text-[12px] font-normal text-[#a1a1aa]">(đang ẩn)</span>}</p>
            <span className="flex-1" />
            <SortButtons first={i === 0} last={i === items.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
            <button type="button" title={o.hidden ? "Hiện mục" : "Ẩn mục"} onClick={() => set(i, { hidden: !o.hidden || undefined })}
              className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]">{o.hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <button type="button" title="Xoá mục" onClick={async () => { if (await confirmDialog(`Xoá mục "${o.title || `Mục ${i + 1}`}"?`, { danger: true, ok: "Xoá" })) onChange(items.filter((_, j) => j !== i)); }}
              className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            <ImageInput value={o.image_url} onChange={(u) => set(i, { image_url: u })} folder={folder} allowSvg shrink={900} label="Ảnh (PNG nền trong suốt)" removeLabel="Xoá ảnh — chỉ hiện chữ" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên"><Input value={o.title} onChange={(e) => set(i, { title: e.target.value })} /></Field>
              <Field label={linkOptional ? "Link (không bắt buộc)" : "Link"}><Input value={o.href} onChange={(e) => set(i, { href: e.target.value })} placeholder={linkOptional ? "https://… · tel:0905… · để trống = chỉ hiện thông tin" : "/dat-don"} /></Field>
              {withDesc && <Field label={descLabel} className="sm:col-span-2"><Input value={o.desc ?? ""} onChange={(e) => set(i, { desc: e.target.value || undefined })} /></Field>}
            </div>
          </div>
        </div>
      ))}
      <Button variant="secondary" icon={<Plus size={16} />} onClick={() => onChange([...items, { id: newTileId(), title: "Mục mới", href: linkOptional ? "" : "/", image_url: null }])}>Thêm mục</Button>
    </div>
  );
}
