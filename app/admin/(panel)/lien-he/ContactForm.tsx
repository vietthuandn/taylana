"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ContactSettings } from "@/lib/settings";
import { revalidatePublic } from "../../actions";
import { Field, Message } from "@/components/admin/ui";

export function ContactForm({ initial }: { initial: ContactSettings }) {
  const [c, setC] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const f = (k: keyof ContactSettings) => ({
    value: c[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value }),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await createClient().from("site_settings").upsert({ key: "contact", value: c, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    await revalidatePublic(["/lien-he"], true);
    setMsg({ type: "ok", text: "✓ Đã lưu thông tin liên hệ." });
  }

  return (
    <form onSubmit={save} className="panel space-y-4 p-5">
      <Field label="Lời giới thiệu (hiện dưới tiêu đề trang Liên Hệ)"><textarea rows={2} className="field" {...f("note")} /></Field>
      <Field label="Link Zalo" hint="Ví dụ: https://zalo.me/0912345678"><input className="field" type="url" placeholder="https://zalo.me/..." {...f("zalo")} /></Field>
      <Field label="Link Shopee"><input className="field" type="url" placeholder="https://shopee.vn/..." {...f("shopee")} /></Field>
      <Field label="Link Facebook"><input className="field" type="url" placeholder="https://facebook.com/..." {...f("facebook")} /></Field>
      <Field label="Số điện thoại"><input className="field" type="tel" {...f("phone")} /></Field>
      <Field label="Địa chỉ"><textarea rows={2} className="field" {...f("address")} /></Field>
      <Field label="Giờ làm việc"><input className="field" {...f("hours")} /></Field>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn" disabled={saving}>{saving ? "Đang lưu..." : "Lưu liên hệ"}</button>
        <Message msg={msg} />
      </div>
    </form>
  );
}
