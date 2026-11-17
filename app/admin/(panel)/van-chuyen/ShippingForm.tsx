"use client";

/* Phí vận chuyển: phí mặc định (site_settings "shipping") + bảng ưu đãi theo bậc (shipping_tiers).
   Áp dụng bậc CAO NHẤT mà tiền hàng TRƯỚC giảm giá đạt được. */
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/format";
import { mergeShipping, type ShippingTier } from "@/lib/shipping";
import { revalidatePublic } from "@/app/admin/actions";
import { Button, EmptyState, Field, Input, Message, SaveBar, SettingsSection, Table } from "@/components/admin/ui";

type Row = ShippingTier & { key: string };
const key = () => Math.random().toString(36).slice(2);

export function ShippingForm() {
  const [fee, setFee] = useState(0);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const snap = () => JSON.stringify([fee, note, [...rows].sort((a, b) => a.min_amount - b.min_amount).map((r) => [r.min_amount, r.percent])]);

  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from("site_settings").select("value").eq("key", "shipping").maybeSingle(),
      sb.from("shipping_tiers").select("id, min_amount, percent").order("min_amount"),
    ]).then(([s, t]) => {
      if (t.error) setMsg({ type: "err", text: "Chưa có bảng shipping_tiers — cần chạy supabase/migration_products.sql." });
      const v = mergeShipping(s.data?.value, (t.data ?? []) as ShippingTier[]);
      setFee(v.fee); setNote(v.note); setRows(v.tiers.map((x) => ({ ...x, key: key() })));
      setSaved(JSON.stringify([v.fee, v.note, v.tiers.map((r) => [r.min_amount, r.percent])]));
      setReady(true);
    });
  }, []);

  async function save() {
    const tiers = rows.map((r) => ({ min_amount: Math.max(0, Math.round(r.min_amount || 0)), percent: Math.max(0, Math.min(100, Math.round(r.percent || 0))) }))
      .sort((a, b) => a.min_amount - b.min_amount);
    if (new Set(tiers.map((t) => t.min_amount)).size !== tiers.length) return setMsg({ type: "err", text: "Có 2 bậc trùng giá trị “Từ”." });
    setSaving(true);
    const sb = createClient();
    const s = await sb.from("site_settings").upsert({ key: "shipping", value: { fee: Math.max(0, Math.round(fee || 0)), note }, updated_at: new Date().toISOString() });
    let err = s.error?.message ?? "";
    if (!err) {
      const del = await sb.from("shipping_tiers").delete().gte("min_amount", 0);
      err = del.error?.message ?? "";
      if (!err && tiers.length) err = (await sb.from("shipping_tiers").insert(tiers)).error?.message ?? "";
    }
    setSaving(false);
    if (err) return setMsg({ type: "err", text: err });
    await revalidatePublic(["/dat-don", "/gio-hang"]);
    const sorted = tiers.map((t) => ({ ...t, key: key() }));
    setRows(sorted);
    setSaved(JSON.stringify([Math.max(0, Math.round(fee || 0)), note, tiers.map((r) => [r.min_amount, r.percent])]));
    setMsg({ type: "ok", text: "Đã lưu phí vận chuyển." });
  }

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  const sorted = [...rows].sort((a, b) => a.min_amount - b.min_amount);
  return (
    <div className="space-y-4 pb-20">
      <SettingsSection title="Phí vận chuyển mặc định" description="Áp dụng cho mọi đơn trước khi tính ưu đãi.">
        <Field label="Phí mặc định (đ)" hint={formatVND(fee || 0)}>
          <Input type="number" min={0} step={1000} value={fee} onChange={(e) => setFee(Number(e.target.value))} className="sm:w-60" />
        </Field>
        <Field label="Ghi chú cho khách" hint="Không bắt buộc, hiện dưới dòng phí vận chuyển">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Giao toàn quốc 2–4 ngày" />
        </Field>
      </SettingsSection>
      <SettingsSection title="Ưu đãi vận chuyển theo giá trị đơn"
        description="So với tiền hàng TRƯỚC giảm giá. Đơn đạt nhiều bậc thì áp dụng bậc CAO NHẤT. Ví dụ: từ 100.000đ giảm 50%, từ 150.000đ giảm 100%.">
        <Table head={["Từ (đ)", "Giảm (%)", "Phí sau ưu đãi", ""]} empty={!sorted.length && <EmptyState>Chưa có bậc ưu đãi.</EmptyState>}>
          {sorted.map((r) => (
            <tr key={r.key}>
              <td><Input type="number" min={0} step={1000} value={r.min_amount} className="!w-36"
                onChange={(e) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, min_amount: Number(e.target.value) } : x)))} /></td>
              <td><Input type="number" min={0} max={100} value={r.percent} className="!w-24"
                onChange={(e) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, percent: Number(e.target.value) } : x)))} /></td>
              <td className="text-[13px] tabular-nums text-[#71717a]">{r.percent >= 100 ? "Miễn phí" : formatVND(fee - Math.floor((fee * (r.percent || 0)) / 100))}</td>
              <td className="text-right">
                <Button variant="ghost" size="sm" aria-label="Xoá bậc" className="!text-[#dc2626]" onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}><Trash2 size={16} /></Button>
              </td>
            </tr>
          ))}
        </Table>
        <Button variant="secondary" size="sm" icon={<Plus size={16} />}
          onClick={() => setRows((cur) => [...cur, { key: key(), min_amount: (sorted.at(-1)?.min_amount ?? 50000) + 50000, percent: 100 }])}>Thêm bậc</Button>
      </SettingsSection>
      <SaveBar show={snap() !== saved} saving={saving} onSave={save} />
      <Message msg={msg} />
    </div>
  );
}
