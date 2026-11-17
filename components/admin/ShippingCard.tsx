"use client";

/* Cài đặt phí vận chuyển (site_settings, key "shipping") — server tính phí khi tạo đơn. */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/format";
import { mergeShipping, type ShippingSettings } from "@/lib/shipping";
import { revalidatePublic } from "@/app/admin/actions";
import { Button, Card, Field, Input, Message, Toggle } from "./ui";

export function ShippingCard() {
  const [saved, setSaved] = useState<ShippingSettings | null>(null);
  const [s, setS] = useState<ShippingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    createClient().from("site_settings").select("value").eq("key", "shipping").maybeSingle()
      .then(({ data }) => { const v = mergeShipping(data?.value); setSaved(v); setS(v); });
  }, []);

  async function save() {
    if (!s) return;
    const clean = mergeShipping(s);
    setSaving(true);
    const { error } = await createClient().from("site_settings").upsert({ key: "shipping", value: clean, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    await revalidatePublic(["/dat-don", "/gio-hang"]);
    setS(clean); setSaved(clean);
    setMsg({ type: "ok", text: "Đã lưu phí vận chuyển." });
  }

  const dirty = !!s && JSON.stringify(s) !== JSON.stringify(saved);
  return (
    <Card title="Vận chuyển" description="Phí ship tính ở server khi khách đặt hàng. Tổng đơn = tiền hàng − giảm giá + phí ship."
      actions={<Button size="sm" onClick={save} loading={saving} disabled={!dirty}>Lưu</Button>}>
      {!s ? <p className="text-[13px] text-[#71717a]">Đang tải...</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phí vận chuyển mặc định (đ)" hint={`Áp dụng cho mọi đơn · ${formatVND(s.fee || 0)}`}>
            <Input type="number" min={0} step={1000} value={s.fee} onChange={(e) => setS({ ...s, fee: Number(e.target.value) })} />
          </Field>
          <div className="flex items-end pb-2">
            <Toggle checked={s.free_enabled} onChange={(v) => setS({ ...s, free_enabled: v })} label="Miễn phí vận chuyển khi đủ ngưỡng" />
          </div>
          {s.free_enabled && (
            <Field label="Ngưỡng miễn phí (đ)" hint="Tiền hàng TRƯỚC giảm giá ≥ ngưỡng thì phí ship = 0">
              <Input type="number" min={0} step={1000} value={s.free_threshold} onChange={(e) => setS({ ...s, free_threshold: Number(e.target.value) })} />
            </Field>
          )}
          <Field label="Ghi chú cho khách" hint="Không bắt buộc, hiện dưới phí vận chuyển" className="sm:col-span-2">
            <Input value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} placeholder="Ví dụ: Giao toàn quốc 2–4 ngày" />
          </Field>
        </div>
      )}
      <Message msg={msg} />
    </Card>
  );
}
