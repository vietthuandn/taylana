"use client";
/* Giao diện → Thiết kế: chọn mẫu giao diện cho trang /thiet-ke (Mẫu 1 giống trang chủ Mẫu 1 · Mẫu 2 thẻ có mô tả — mẫu cũ)
   + danh sách mục (tên, ảnh thumbnail, link, mô tả · thêm / ẩn / xoá / sắp xếp). */
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import type { DesignPage, DesignTheme } from "@/lib/tileItems";
import { TileGrid } from "@/components/site/TileGrid";
import { CdDisc } from "@/components/ui/Shapes";
import { TileListEditor } from "@/components/admin/TileListEditor";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Button, Message, SaveBar } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

const THEMES: { id: DesignTheme; name: string; desc: string }[] = [
  { id: "1", name: "Mẫu 1", desc: "Ảnh + tên to, giống trang chủ Mẫu 1." },
  { id: "2", name: "Mẫu 2", desc: "Thẻ có ảnh, tên và mô tả (giao diện cũ)." },
];

function Preview2({ page }: { page: DesignPage }) {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {page.items.filter((t) => !t.hidden).map((t) => (
        <li key={t.id} className="flex aspect-square flex-col overflow-hidden rounded-[6px] border border-[#e5e5e7] bg-white">
          <div className="relative min-h-0 flex-1 bg-[#f4f4f5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><CdDisc className="w-1/2" /></div>}
          </div>
          <p className="truncate p-1 text-[9px] font-semibold">{t.title}</p>
        </li>
      ))}
    </ul>
  );
}

export function DesignPageForm({ initial }: { initial: DesignPage }) {
  const [page, setPage] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true); setMsg(null);
    const { error } = await createClient().from("site_settings").upsert({ key: "design_page", value: page, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    const now = new Set(page.items.map((o) => o.image_url));
    await Promise.all(saved.items.map((o) => o.image_url).filter((u) => u && !now.has(u) && !u.startsWith("/")).map(removePublicImage));
    await revalidatePublic(["/thiet-ke"]);
    setSaved(page);
    setMsg({ type: "ok", text: "Đã lưu — trang Thiết kế đã cập nhật." });
  }
  const dirty = JSON.stringify(page) !== JSON.stringify(saved);
  return (
    <form onSubmit={save} className="space-y-6 pb-20">
      <ul className="grid gap-4 sm:grid-cols-2">
        {THEMES.map((t) => {
          const on = page.theme === t.id;
          return (
            <li key={t.id} className={cx("flex flex-col overflow-hidden rounded-[12px] border bg-white", on ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/20" : "border-[#e5e5e7]")}>
              <div className="border-b border-[#efeff1] bg-[#f7f7f8] p-4">{t.id === "1" ? <TileGrid items={page.items} preview /> : <Preview2 page={page} />}</div>
              <div className="flex flex-1 flex-wrap items-center gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[15px] font-semibold">{t.name} {saved.theme === t.id && <Badge tone="green">Đang dùng</Badge>}</p>
                  <p className="text-[13px] text-[#71717a]">{t.desc}</p>
                </div>
                {!on && <Button size="sm" onClick={() => setPage({ ...page, theme: t.id })}>Chọn mẫu này</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold">Các mục trên trang Thiết kế</p>
        <Button variant="secondary" size="sm" icon={<ExternalLink size={16} />} onClick={() => window.open("/thiet-ke", "_blank", "noopener")}>Xem trang</Button>
      </div>
      <TileListEditor items={page.items} onChange={(items) => setPage({ ...page, items })} folder="design-page" withDesc />
      <SaveBar show={dirty} saving={saving} onReset={() => setPage(saved)} />
      <Message msg={msg} />
    </form>
  );
}
