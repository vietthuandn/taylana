"use client";
/* Giao diện → Liên hệ: các mục trang /lien-he (ảnh, tên, link không bắt buộc, dòng thông tin) · thêm / ẩn / xoá / sắp xếp. */
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import type { TileItem } from "@/lib/tileItems";
import { TileGrid } from "@/components/site/TileGrid";
import { TileListEditor } from "@/components/admin/TileListEditor";
import { revalidatePublic } from "@/app/admin/actions";
import { Button, Message, SaveBar } from "@/components/admin/ui";

export function ContactItemsForm({ initial }: { initial: TileItem[] }) {
  const [items, setItems] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true); setMsg(null);
    const { error } = await createClient().from("site_settings").upsert({ key: "contact_items", value: items, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    const now = new Set(items.map((o) => o.image_url));
    await Promise.all(saved.map((o) => o.image_url).filter((u) => u && !now.has(u)).map(removePublicImage));
    await revalidatePublic(["/lien-he"]);
    setSaved(items);
    setMsg({ type: "ok", text: "Đã lưu — trang Liên hệ đã cập nhật." });
  }
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  return (
    <form onSubmit={save} className="grid gap-6 pb-20 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-[#71717a]">Mục không có link sẽ chỉ hiện thông tin (vd. Giờ làm việc). Link: https://… · tel:0905… · mailto:…</p>
          <Button variant="secondary" size="sm" icon={<ExternalLink size={16} />} onClick={() => window.open("/lien-he", "_blank", "noopener")}>Xem trang</Button>
        </div>
        <TileListEditor items={items} onChange={setItems} folder="contact" withDesc descLabel="Thông tin dưới tên (không bắt buộc) — vd. 8:00 – 21:00" linkOptional />
      </div>
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white">
          <p className="border-b border-[#efeff1] px-4 py-2.5 text-[13px] font-medium text-[#52525b]">Xem trước (máy tính)</p>
          <div className="rounded-b-[12px] bg-[#f7f7f8] p-4"><TileGrid items={items} preview showDesc /></div>
        </div>
      </aside>
      <SaveBar show={dirty} saving={saving} onReset={() => setItems(saved)} />
      <Message msg={msg} />
    </form>
  );
}
