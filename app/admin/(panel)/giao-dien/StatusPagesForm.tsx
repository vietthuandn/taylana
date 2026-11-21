"use client";
/* Giao diện → Khác: trang "Tạm ngưng nhận đơn qua web" · 404 · 403 — màu nền, ảnh minh hoạ (giữa trang), 1 dòng thông báo,
   tối đa 3 nút điều hướng. 404 / 403 là trang hệ thống (không có header); trang tạm ngưng có header của web. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { STATUS_KINDS, type StatusKind, type StatusPage } from "@/lib/statusPages";
import { StatusView } from "@/components/site/StatusView";
import { revalidatePublic } from "@/app/admin/actions";
import { Button, Field, ImageInput, Input, Message, SaveBar, SettingsSection, Textarea } from "@/components/admin/ui";

export function StatusPagesForm({ initial }: { initial: Record<StatusKind, StatusPage> }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const set = (k: StatusKind, p: Partial<StatusPage>) => setV({ ...v, [k]: { ...v[k], ...p } });
  async function save() {
    setSaving(true); setMsg(null);
    const { error } = await createClient().from("site_settings").upsert({ key: "status_pages", value: v, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    for (const [k] of STATUS_KINDS) if (saved[k].image && saved[k].image !== v[k].image) await removePublicImage(saved[k].image);
    await revalidatePublic(["/dat-don", "/gio-hang"], true);
    setSaved(v); setMsg({ type: "ok", text: "Đã lưu các trang." });
  }
  return (
    <div className="space-y-6 pb-20">
      {STATUS_KINDS.map(([k, name]) => {
        const p = v[k];
        return (
          <SettingsSection key={k} title={name} description={k === "gate" ? "Hiện ở trang Thiết kế và mọi trang con khi bật “Yêu cầu số điện thoại / mã đơn hàng” (Giao diện → Thiết kế) — có header, có ô nhập SĐT / mã đơn Shopee." : k === "paused" ? "Hiện ở trang Đặt đơn / sản phẩm / giỏ hàng khi bật “Tạm nghỉ bán” (Sản phẩm của tôi) — có header của web." : "Trang hệ thống — không có header."}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-end gap-4">
                  <Field label="Màu nền">
                    <label className="relative block h-9 w-14 cursor-pointer overflow-hidden rounded-[8px] border border-[#e5e5e7]" style={{ background: p.bg }}>
                      <input type="color" value={p.bg} onChange={(e) => set(k, { bg: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu nền" />
                    </label>
                  </Field>
                  <ImageInput label="Ảnh minh hoạ (giữa trang)" value={p.image} onChange={(u) => set(k, { image: u })} folder="status" allowSvg shrink={900} removeLabel="Bỏ ảnh" />
                </div>
                <Field label="Dòng thông báo"><Textarea rows={2} maxLength={300} value={p.message} onChange={(e) => set(k, { message: e.target.value })} /></Field>
                {k === "gate" && <Field label="Chữ trên nút xác nhận (dưới ô nhập SĐT / mã đơn hàng)"><Input value={p.submit ?? ""} maxLength={40} onChange={(e) => set(k, { submit: e.target.value })} placeholder="Vào thiết kế" /></Field>}
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium">Nút điều hướng (tối đa 3 — nút đầu là nút chính)</span>
                  <div className="space-y-2">
                    {p.buttons.map((b, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={b.label} onChange={(e) => set(k, { buttons: p.buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Tên nút" className="w-40" />
                        <Input value={b.href} onChange={(e) => set(k, { buttons: p.buttons.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} placeholder="/lien-he hoặc https://zalo.me/…" />
                        <button type="button" onClick={() => set(k, { buttons: p.buttons.filter((_, j) => j !== i) })} className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-[#a1a1aa] hover:text-[#dc2626]" aria-label="Xoá nút"><Trash2 size={15} /></button>
                      </div>
                    ))}
                    {p.buttons.length < 3 && <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => set(k, { buttons: [...p.buttons, { label: "Nút mới", href: "/" }] })}>Thêm nút</Button>}
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-[12px] border border-[#e5e5e7]">
                <p className="border-b border-[#efeff1] bg-white px-3 py-2 text-[12px] font-medium text-[#52525b]">Xem trước</p>
                <div className="pointer-events-none flex h-[300px] origin-top-left overflow-hidden [&>div]:!min-h-0 [&>div]:py-6 [&_p]:!text-[14px]"><StatusView page={p}>
                  {k === "gate" && <div className="mt-4 flex w-full max-w-[260px] flex-col gap-1.5"><span className="h-10 rounded-[10px] border border-[#d4d4d8] bg-white px-3 text-[12px] leading-10 text-[#a1a1aa]">Số điện thoại hoặc mã đơn hàng Shopee</span><span className="h-10 rounded-[10px] bg-[var(--c-primary,#ff5fa2)] text-[13px] font-semibold leading-10 text-white">{p.submit || "Vào thiết kế"}</span></div>}
                </StatusView></div>
              </div>
            </div>
          </SettingsSection>
        );
      })}
      <SaveBar show={JSON.stringify(v) !== JSON.stringify(saved)} saving={saving} onSave={save} onReset={() => setV(saved)} />
      <Message msg={msg} />
    </div>
  );
}
