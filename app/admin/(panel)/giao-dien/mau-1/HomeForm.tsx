"use client";
/* Giao diện → Trang chủ → Mẫu 1 → Chỉnh sửa: danh sách mục (thêm / ẩn / xoá / sắp xếp) + xem trước đúng giao diện Mẫu 1. */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import type { TileItem } from "@/lib/tileItems";
import { TileGrid } from "@/components/site/TileGrid";
import { TileListEditor } from "@/components/admin/TileListEditor";
import { revalidatePublic } from "@/app/admin/actions";
import { Message, SaveBar } from "@/components/admin/ui";

export function HomeForm({ initialItems, keepImages }: { initialItems: TileItem[]; keepImages: string[] }) {
  const [items, setItems] = useState(initialItems);
  const [saved, setSaved] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true); setMsg(null);
    const { error } = await createClient().from("site_settings").upsert({ key: "home_items", value: items, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    // xoá ảnh cũ đã bị thay (trừ ảnh các mẫu khác còn dùng)
    const now = new Set([...items.map((o) => o.image_url), ...keepImages]);
    await Promise.all(saved.map((o) => o.image_url).filter((u) => u && !now.has(u)).map(removePublicImage));
    await revalidatePublic(["/"]);
    setSaved(items);
    setMsg({ type: "ok", text: "Đã lưu — trang chủ đã cập nhật." });
  }
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  return (
    <form onSubmit={save} className="grid gap-6 pb-20 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0"><TileListEditor items={items} onChange={setItems} folder="icons" /></div>
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white">
          <p className="border-b border-[#efeff1] px-4 py-2.5 text-[13px] font-medium text-[#52525b]">Xem trước (máy tính)</p>
          <div className="rounded-b-[12px] bg-[#f7f7f8] p-4"><TileGrid items={items} preview /></div>
        </div>
      </aside>
      <SaveBar show={dirty} saving={saving} onReset={() => setItems(saved)} />
      <Message msg={msg} />
    </form>
  );
}
