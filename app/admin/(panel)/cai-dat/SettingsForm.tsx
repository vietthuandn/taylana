"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ContactSettings, HomeSettings } from "@/lib/settings";
import { revalidatePublic } from "../../actions";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export function SettingsForm({ initialHome, initialContact }: { initialHome: HomeSettings; initialContact: ContactSettings }) {
  const [home, setHome] = useState(initialHome);
  const [contact, setContact] = useState(initialContact);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [errMsg, setErrMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const { error } = await createClient().from("site_settings").upsert([
      { key: "home", value: home, updated_at: new Date().toISOString() },
      { key: "contact", value: contact, updated_at: new Date().toISOString() },
    ]);
    if (error) {
      setStatus("error");
      setErrMsg(error.message);
      return;
    }
    await revalidatePublic(["/"]);
    setStatus("saved");
  }

  const h = (k: keyof HomeSettings) => ({
    value: home[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setHome({ ...home, [k]: e.target.value }),
  });
  const c = (k: keyof ContactSettings) => ({
    value: contact[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContact({ ...contact, [k]: e.target.value }),
  });

  return (
    <form onSubmit={save}>
      <fieldset className="pop mb-6 rounded-3xl bg-cream-50 p-5">
        <legend className="rounded-full bg-hot-100 px-3 font-display text-lg">Banner trang chủ</legend>
        <Field label="Tiêu đề"><input className="field" {...h("banner_title")} /></Field>
        <Field label="Mô tả ngắn"><textarea rows={3} className="field" {...h("banner_subtitle")} /></Field>
        <Field label="Nhãn nhỏ phía trên" hint="Để trống nếu không muốn hiện"><input className="field" {...h("banner_note")} /></Field>
      </fieldset>

      <fieldset className="pop mb-6 rounded-3xl bg-cream-50 p-5">
        <legend className="rounded-full bg-lime-300 px-3 font-display text-lg">Liên hệ</legend>
        <Field label="Link Zalo" hint="Ví dụ: https://zalo.me/0912345678 — để trống thì ẩn nút">
          <input className="field" type="url" placeholder="https://zalo.me/..." {...c("zalo")} />
        </Field>
        <Field label="Link Shopee"><input className="field" type="url" placeholder="https://shopee.vn/..." {...c("shopee")} /></Field>
        <Field label="Link Facebook"><input className="field" type="url" placeholder="https://facebook.com/..." {...c("facebook")} /></Field>
        <Field label="Số điện thoại"><input className="field" type="tel" {...c("phone")} /></Field>
        <Field label="Giờ làm việc"><input className="field" {...c("hours")} /></Field>
        <Field label="Lời nhắn"><textarea rows={2} className="field" {...c("note")} /></Field>
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn" disabled={status === "saving"}>
          {status === "saving" ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        {status === "saved" && <span className="text-lime-700">✓ Đã lưu! Trang chủ đã cập nhật.</span>}
        {status === "error" && <span className="text-hot-500">Lỗi: {errMsg}</span>}
      </div>
    </form>
  );
}
