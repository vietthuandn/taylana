"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/format";
import { randomCode, toCode } from "@/lib/discount";
import type { Discount } from "@/lib/discountAdmin";
import { revalidatePublic } from "@/app/admin/actions";
import { Button, Field, Input, Message, SaveBar, SettingsSection, Toggle, confirmDialog } from "@/components/admin/ui";

type Group = { id: string; name: string; options: { id: string; name: string }[] };

// ISO ↔ ô datetime-local (giờ máy)
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v)) || 0));

export function DiscountForm({ initial, groups }: { initial: Discount; groups: Group[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const set = (x: Partial<Discount>) => setD({ ...d, ...x });
  const isNew = !d.id;
  const dirty = isNew || JSON.stringify(d) !== JSON.stringify(saved);

  function toggleId(id: string) {
    const list = d.option_ids;
    set({ option_ids: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  }

  async function save() {
    if (!d.name.trim()) return setMsg({ type: "err", text: "Cần đặt tên chương trình." });
    if (d.kind === "private" && (d.code ?? "").length < 3) return setMsg({ type: "err", text: "Mã cần ít nhất 3 ký tự (chữ HOA không dấu và số)." });
    if (!d.value || d.value <= 0) return setMsg({ type: "err", text: "Giá trị giảm phải lớn hơn 0." });
    if (d.value_type === "percent" && d.value > 100) return setMsg({ type: "err", text: "Giảm theo % tối đa 100%." });
    if (d.target === "goods" && d.scope === "items" && !d.option_ids.length) return setMsg({ type: "err", text: "Chọn ít nhất 1 lựa chọn được áp dụng." });
    if (d.starts_at && d.ends_at && d.starts_at > d.ends_at) return setMsg({ type: "err", text: "Thời gian kết thúc phải sau thời gian bắt đầu." });
    const payload = {
      name: d.name.trim(), label: d.label.trim(), kind: d.kind, code: d.kind === "private" ? toCode(d.code ?? "") : null,
      value_type: d.value_type, value: Math.round(d.value), max_discount: d.value_type === "percent" ? d.max_discount || null : null,
      target: d.target, scope: d.target === "shipping" ? "order" : d.scope,
      option_ids: d.target === "goods" && d.scope === "items" ? d.option_ids : [], package_ids: [], addon_ids: [],
      min_order: d.min_order || null, starts_at: d.starts_at, ends_at: d.ends_at,
      usage_limit: d.usage_limit || null, per_phone_limit: d.per_phone_limit || null, is_active: d.is_active,
    };
    setSaving(true);
    const sb = createClient();
    const res = isNew ? await sb.from("discounts").insert(payload).select("id").single() : await sb.from("discounts").update(payload).eq("id", d.id!).select("id").single();
    setSaving(false);
    if (res.error) {
      const m = res.error.message;
      return setMsg({ type: "err", text: m.includes("discounts_code_key") || m.includes("duplicate") ? "Mã này đã tồn tại, chọn mã khác." : m });
    }
    await revalidatePublic(["/dat-don"]);
    setMsg({ type: "ok", text: "Đã lưu chương trình giảm giá." });
    if (isNew) { router.replace(`/admin/giam-gia/${res.data.id}`); router.refresh(); return; }
    setSaved(d);
    router.refresh();
  }

  async function remove() {
    if (!d.id || !await confirmDialog(`Xoá chương trình "${d.name}"? Các đơn đã dùng vẫn giữ số tiền đã giảm.`)) return;
    const { error } = await createClient().from("discounts").delete().eq("id", d.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await revalidatePublic(["/dat-don"]);
    router.replace("/admin/giam-gia");
    router.refresh();
  }

  const seg = (on: boolean) => `rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${on ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]"}`;
  const check = "flex items-center gap-2 rounded-[8px] border border-[#e5e5e7] bg-white px-3 py-2 text-[13px] hover:bg-[#fafafa]";

  return (
    <div className="space-y-4 pb-20">
      <SettingsSection title="Thông tin" description="Tên chương trình chỉ admin thấy. Tên hiển thị hiện cho khách khi áp dụng.">
        <Field label="Tên chương trình *"><Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ví dụ: Khai trương tháng 12" /></Field>
        <Field label="Tên hiển thị cho khách" hint="Để trống thì hiện mã (mã riêng tư) hoặc “Ưu đãi toàn shop”">
          <Input value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Ví dụ: Ưu đãi khai trương" />
        </Field>
        <Toggle checked={d.is_active} onChange={(v) => set({ is_active: v })} label="Đang bật" />
      </SettingsSection>

      <SettingsSection title="Loại" description="Mã riêng tư: khách phải tự nhập mã. Toàn shop: tự động áp dụng cho mọi khách.">
        <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
          <button type="button" className={seg(d.kind === "private")} onClick={() => set({ kind: "private" })}>Mã riêng tư</button>
          <button type="button" className={seg(d.kind === "public")} onClick={() => set({ kind: "public" })}>Toàn shop</button>
        </div>
        {d.kind === "private" && (
          <Field label="Mã giảm giá *" hint="Tự viết HOA, không dấu, không khoảng trắng">
            <div className="flex gap-2">
              <Input className="font-mono" value={d.code ?? ""} onChange={(e) => set({ code: toCode(e.target.value) })} placeholder="VIDU2024" />
              <Button variant="secondary" icon={<Shuffle size={16} />} onClick={() => set({ code: randomCode() })}>Tạo mã ngẫu nhiên</Button>
            </div>
          </Field>
        )}
      </SettingsSection>

      <SettingsSection title="Phạm vi" description="Giảm tiền hàng, hoặc giảm phí vận chuyển (tính trên phí còn lại sau ưu đãi theo bậc).">
        <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
          <button type="button" className={seg(d.target === "goods")} onClick={() => set({ target: "goods" })}>Giảm tiền hàng</button>
          <button type="button" className={seg(d.target === "shipping")} onClick={() => set({ target: "shipping" })}>Giảm phí vận chuyển</button>
        </div>
      </SettingsSection>

      <SettingsSection title="Mức giảm" description="Giảm theo số tiền hoặc theo %. Số tiền + một số sản phẩm: trừ cho mỗi sản phẩm.">
        <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
          <button type="button" className={seg(d.value_type === "amount")} onClick={() => set({ value_type: "amount" })}>Số tiền</button>
          <button type="button" className={seg(d.value_type === "percent")} onClick={() => set({ value_type: "percent" })}>Phần trăm</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={d.value_type === "amount" ? "Số tiền giảm (đồng) *" : "Phần trăm giảm (%) *"} hint={d.value_type === "amount" ? formatVND(d.value || 0) : undefined}>
            <Input type="number" min={1} max={d.value_type === "percent" ? 100 : undefined} step={d.value_type === "amount" ? 1000 : 1}
              value={d.value || ""} onChange={(e) => set({ value: Number(e.target.value) })} />
          </Field>
          {d.value_type === "percent" && (
            <Field label="Giảm tối đa (đồng)" hint="Không bắt buộc">
              <Input type="number" min={0} step={1000} value={d.max_discount ?? ""} onChange={(e) => set({ max_discount: num(e.target.value) })} />
            </Field>
          )}
        </div>
      </SettingsSection>

      {d.target === "goods" && (
      <SettingsSection title="Áp dụng cho" description="Toàn bộ đơn, hoặc chỉ các lựa chọn được chọn (Loại, Mua kèm...).">
        <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
          <button type="button" className={seg(d.scope === "order")} onClick={() => set({ scope: "order" })}>Toàn bộ đơn</button>
          <button type="button" className={seg(d.scope === "items")} onClick={() => set({ scope: "items" })}>Lựa chọn được chọn</button>
        </div>
        {d.scope === "items" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id}>
                <p className="mb-1.5 text-[13px] font-medium">{g.name}</p>
                <div className="space-y-1.5">
                  {g.options.map((o) => (
                    <label key={o.id} className={check}>
                      <input type="checkbox" className="h-4 w-4" checked={d.option_ids.includes(o.id)} onChange={() => toggleId(o.id)} /> {o.name}
                    </label>
                  ))}
                  {!g.options.length && <p className="text-[12px] text-[#71717a]">Chưa có lựa chọn.</p>}
                </div>
              </div>
            ))}
            {!groups.length && <p className="text-[12px] text-[#71717a]">Chưa có sản phẩm.</p>}
          </div>
        )}
      </SettingsSection>
      )}

      <SettingsSection title="Điều kiện" description="Các ô để trống là không giới hạn.">
        <Field label="Giá trị đơn tối thiểu (đồng)" hint="Chỉ áp dụng khi tạm tính ≥ số tiền này">
          <Input type="number" min={0} step={1000} value={d.min_order ?? ""} onChange={(e) => set({ min_order: num(e.target.value) })} className="sm:w-60" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bắt đầu"><Input type="datetime-local" value={toLocal(d.starts_at)} onChange={(e) => set({ starts_at: fromLocal(e.target.value) })} /></Field>
          <Field label="Kết thúc"><Input type="datetime-local" value={toLocal(d.ends_at)} onChange={(e) => set({ ends_at: fromLocal(e.target.value) })} /></Field>
          <Field label="Tổng số lượt dùng tối đa" hint={d.id ? `Đã dùng ${d.used_count} lượt` : undefined}>
            <Input type="number" min={1} value={d.usage_limit ?? ""} onChange={(e) => set({ usage_limit: num(e.target.value) })} />
          </Field>
          <Field label="Số lượt mỗi SĐT được dùng">
            <Input type="number" min={1} value={d.per_phone_limit ?? ""} onChange={(e) => set({ per_phone_limit: num(e.target.value) })} />
          </Field>
        </div>
      </SettingsSection>

      {!isNew && (
        <div className="flex justify-end">
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={remove}>Xoá chương trình</Button>
        </div>
      )}
      <SaveBar show={dirty} saving={saving} onSave={save} onReset={isNew ? undefined : () => setD(saved)} label={isNew ? "Chương trình mới chưa lưu" : undefined} />
      <Message msg={msg} />
    </div>
  );
}
