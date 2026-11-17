"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ContactSettings } from "@/lib/settings";
import { revalidatePublic } from "../../actions";
import { Field, Input, Message, SaveBar, SettingsSection, Textarea } from "@/components/admin/ui";

export function ContactForm({ initial }: { initial: ContactSettings }) {
  const [saved, setSaved] = useState(initial);
  const [c, setC] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);
  const f = (k: keyof ContactSettings) => ({
    value: c[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value }),
  });

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    const { error } = await createClient().from("site_settings").upsert({ key: "contact", value: c, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    await revalidatePublic(["/lien-he"], true);
    setSaved(c);
    setMsg({ type: "ok", text: "Đã lưu thông tin liên hệ." });
  }

  return (
    <form onSubmit={save} className="space-y-4 pb-20">
      <SettingsSection title="Giới thiệu" description="Đoạn chữ ngắn hiện dưới tiêu đề trang Liên hệ.">
        <Field label="Lời giới thiệu"><Textarea rows={2} {...f("note")} /></Field>
      </SettingsSection>
      <SettingsSection title="Mạng xã hội" description="Link đầy đủ, bắt đầu bằng https://">
        <Field label="Link Zalo" hint="Ví dụ: https://zalo.me/0912345678"><Input type="url" placeholder="https://zalo.me/..." {...f("zalo")} /></Field>
        <Field label="Link Shopee"><Input type="url" placeholder="https://shopee.vn/..." {...f("shopee")} /></Field>
        <Field label="Link Facebook"><Input type="url" placeholder="https://facebook.com/..." {...f("facebook")} /></Field>
      </SettingsSection>
      <SettingsSection title="Thông tin cửa hàng" description="Số điện thoại, địa chỉ và giờ làm việc.">
        <Field label="Số điện thoại"><Input type="tel" {...f("phone")} /></Field>
        <Field label="Địa chỉ"><Textarea rows={2} {...f("address")} /></Field>
        <Field label="Giờ làm việc"><Input {...f("hours")} /></Field>
      </SettingsSection>
      <SaveBar show={dirty} saving={saving} onReset={() => setC(saved)} />
      <Message msg={msg} />
    </form>
  );
}
