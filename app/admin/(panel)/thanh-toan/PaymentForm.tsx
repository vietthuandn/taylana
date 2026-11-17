"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BANKS, bankByBin } from "@/lib/payment/banks";
import { buildQrUrl } from "@/lib/payment/qr";
import { paymentReady, toAccountName, toPrefix, type PaymentSettings } from "@/lib/payment/settings";
import { revalidatePublic } from "../../actions";
import { Field, Input, Message, SaveBar, Select, SettingsSection, Textarea, Toggle } from "@/components/admin/ui";

export function PaymentForm({ initial }: { initial: PaymentSettings }) {
  const [saved, setSaved] = useState(initial);
  const [p, setP] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const set = (x: Partial<PaymentSettings>) => setP({ ...p, ...x });

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const clean: PaymentSettings = {
      ...p,
      account_no: p.account_no.replace(/\s/g, ""),
      account_name: toAccountName(p.account_name).trim(),
      prefix: toPrefix(p.prefix) || "TAYLANA",
      deposit_percent: Math.max(1, Math.min(100, Math.round(p.deposit_percent || 50))),
      deadline_hours: Math.max(1, Math.round(p.deadline_hours || 24)),
    };
    if (clean.enabled && (!clean.account_no || !clean.account_name)) return setMsg({ type: "err", text: "Cần nhập số tài khoản và tên chủ tài khoản trước khi bật thanh toán QR." });
    setSaving(true);
    const { error } = await createClient().from("site_settings").upsert({ key: "payment", value: clean, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    await revalidatePublic(["/dat-don"]);
    setP(clean); setSaved(clean);
    setMsg({ type: "ok", text: "Đã lưu cài đặt thanh toán." });
  }

  const sample = paymentReady({ ...p, enabled: true })
    ? buildQrUrl({ bin: p.bank_bin, accountNo: p.account_no, accountName: toAccountName(p.account_name).trim(), amount: 10000, content: `${toPrefix(p.prefix) || "TAYLANA"}1000` })
    : null;

  return (
    <form onSubmit={save} className="grid gap-6 pb-20 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <SettingsSection title="Thanh toán QR" description="Bật thì sau khi đặt hàng, khách được chuyển sang trang thanh toán có mã QR.">
          <Toggle checked={p.enabled} onChange={(v) => set({ enabled: v })} label="Bật thanh toán QR chuyển khoản" />
        </SettingsSection>

        <SettingsSection title="Tài khoản nhận tiền" description="Kiểm tra kỹ bằng QR mẫu bên phải trước khi bật.">
          <Field label="Ngân hàng">
            <Select value={p.bank_bin} onChange={(e) => set({ bank_bin: e.target.value, bank_name: bankByBin(e.target.value)?.short ?? "" })}>
              {BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.short} — {b.name}</option>)}
            </Select>
          </Field>
          <Field label="Số tài khoản"><Input inputMode="numeric" value={p.account_no} onChange={(e) => set({ account_no: e.target.value.replace(/[^\d]/g, "") })} /></Field>
          <Field label="Tên chủ tài khoản" hint="Tự viết HOA, bỏ dấu — đúng như trên app ngân hàng">
            <Input value={p.account_name} onChange={(e) => set({ account_name: toAccountName(e.target.value) })} placeholder="NGUYEN VAN A" />
          </Field>
        </SettingsSection>

        <SettingsSection title="Nội dung chuyển khoản" description="Mỗi đơn có mã thanh toán = tiền tố + số đơn, ví dụ TAYLANA1024.">
          <Field label="Tiền tố" hint="Chỉ chữ không dấu và số, không khoảng trắng">
            <Input value={p.prefix} onChange={(e) => set({ prefix: toPrefix(e.target.value) })} />
          </Field>
        </SettingsSection>

        <SettingsSection title="Hình thức thu" description="Áp dụng cho đơn đặt sau khi lưu.">
          <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
            {(["full", "deposit"] as const).map((m) => (
              <button key={m} type="button" onClick={() => set({ mode: m })}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${p.mode === m ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]"}`}>
                {m === "full" ? "Thu 100%" : "Đặt cọc"}
              </button>
            ))}
          </div>
          {p.mode === "deposit" && (
            <Field label="Phần trăm đặt cọc (%)" hint="Số tiền cọc làm tròn lên nghìn đồng">
              <Input type="number" min={1} max={100} value={p.deposit_percent} onChange={(e) => set({ deposit_percent: Number(e.target.value) })} className="sm:w-32" />
            </Field>
          )}
          <Field label="Thời hạn thanh toán (giờ)" hint="Quá hạn chưa thanh toán thì đơn chuyển sang Hết hạn">
            <Input type="number" min={1} value={p.deadline_hours} onChange={(e) => set({ deadline_hours: Number(e.target.value) })} className="sm:w-32" />
          </Field>
        </SettingsSection>

        <SettingsSection title="Ghi chú cho khách" description="Hiện ở trang thanh toán và sau khi khách bấm “Tôi đã chuyển khoản”.">
          <Textarea rows={2} value={p.note} onChange={(e) => set({ note: e.target.value })} />
        </SettingsSection>
      </div>

      <aside className="xl:sticky xl:top-[88px] xl:self-start">
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white">
          <div className="border-b border-[#efeff1] px-4 py-3">
            <p className="text-[15px] font-semibold">QR mẫu</p>
            <p className="text-[12px] text-[#71717a]">Số tiền 10.000đ — quét thử để kiểm tra tài khoản</p>
          </div>
          <div className="p-4">
            {sample ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sample} alt="QR mẫu" className="mx-auto w-full max-w-[260px] rounded-[8px]" />
            ) : (
              <p className="py-10 text-center text-[13px] text-[#71717a]">Nhập số tài khoản và tên chủ tài khoản để xem QR mẫu.</p>
            )}
          </div>
        </div>
      </aside>

      <SaveBar show={dirty} saving={saving} onReset={() => setP(saved)} />
      <Message msg={msg} />
    </form>
  );
}
