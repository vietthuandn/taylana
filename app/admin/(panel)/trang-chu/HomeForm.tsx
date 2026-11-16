"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { defaultHome, defaultOptions, type HomeOption, type HomeSettings, type OptionColor } from "@/lib/settings";
import { revalidatePublic } from "../../actions";
import { Field, ImageInput, Message, Toggle } from "@/components/admin/ui";

const BG_PRESETS = [
  { label: "Xanh chanh", value: "#c8e03c" },
  { label: "Tím", value: "#7b68ee" },
  { label: "Hồng đậm", value: "#ff5fa2" },
  { label: "Kem", value: "#f7f0e6" },
  { label: "Đen", value: "#141414" },
];
const COLORS: { value: Exclude<OptionColor, "custom">; label: string; cls: string }[] = [
  { value: "lime", label: "Xanh chanh", cls: "bg-lime-500" },
  { value: "violet", label: "Tím", cls: "bg-violet-500" },
  { value: "hot", label: "Hồng", cls: "bg-hot-500" },
];

export function HomeForm({ initialHome, initialOptions }: { initialHome: HomeSettings; initialOptions: HomeOption[] }) {
  const [home, setHome] = useState(initialHome);
  const [options, setOptions] = useState(initialOptions);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const h = (k: "banner_title" | "banner_subtitle" | "btn1_label" | "btn1_href" | "btn2_label" | "btn2_href") => ({
    value: home[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setHome({ ...home, [k]: e.target.value }),
  });
  const setOpt = (i: number, p: Partial<HomeOption>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...p } : o)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const now = new Date().toISOString();
    const { error } = await createClient().from("site_settings").upsert([
      { key: "home", value: home, updated_at: now },
      { key: "home_options", value: options, updated_at: now },
    ]);
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    // xoá ảnh/icon cũ đã bị thay
    const before = [initialHome.banner_image, ...initialOptions.map((o) => o.icon_url)];
    const now2 = new Set([home.banner_image, ...options.map((o) => o.icon_url)]);
    await Promise.all(before.filter((u) => u && !now2.has(u)).map(removePublicImage));
    await revalidatePublic(["/"]);
    setMsg({ type: "ok", text: "✓ Đã lưu — trang chủ đã cập nhật." });
  }

  return (
    <form onSubmit={save} className="space-y-8">
      {/* ---------- Banner ---------- */}
      <fieldset className="panel space-y-4 p-5">
        <legend className="eyebrow bg-lime-500 text-ink-900">Banner (máy tính)</legend>
        <Toggle checked={home.banner_enabled} onChange={(v) => setHome({ ...home, banner_enabled: v })}
          label={home.banner_enabled ? "Đang hiện banner" : "Đang tắt banner — 6 lựa chọn ra giữa màn hình, 3 mỗi hàng"} />
        <Field label="Tiêu đề (tự in hoa)"><input className="field" {...h("banner_title")} /></Field>
        <Field label="Nội dung (1–2 dòng)"><textarea rows={2} className="field" {...h("banner_subtitle")} /></Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nút 1 — tên"><input className="field" {...h("btn1_label")} /></Field>
          <Field label="Nút 1 — link" hint="Ví dụ /dat-don hoặc https://..."><input className="field" {...h("btn1_href")} /></Field>
        </div>
        <Toggle checked={home.btn2_enabled} onChange={(v) => setHome({ ...home, btn2_enabled: v })} label="Bật nút thứ 2" />
        {home.btn2_enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nút 2 — tên"><input className="field" {...h("btn2_label")} /></Field>
            <Field label="Nút 2 — link"><input className="field" {...h("btn2_href")} /></Field>
          </div>
        )}

        <Toggle checked={home.banner_image_enabled} onChange={(v) => setHome({ ...home, banner_image_enabled: v })} label="Hiện ảnh bên phải" />
        {home.banner_image_enabled && (
          <>
            <ImageInput value={home.banner_image} onChange={(u) => setHome({ ...home, banner_image: u })} folder="home"
              label="Ảnh bên phải (vuông, ảnh sẽ phủ kín khung)" removeLabel="Xoá — dùng ảnh mặc định" />
            <Toggle checked={home.banner_image_petal} onChange={(v) => setHome({ ...home, banner_image_petal: v })}
              label={home.banner_image_petal ? "Khung: cánh hoa tròn" : "Khung: hình vuông"} />
          </>
        )}

        <div>
          <span className="mb-1 block text-sm font-medium">Màu nền banner</span>
          <div className="flex flex-wrap items-center gap-2">
            {BG_PRESETS.map((c) => (
              <button key={c.value} type="button" title={c.label} aria-label={c.label} onClick={() => setHome({ ...home, banner_bg: c.value })}
                className={`h-9 w-9 rounded-full border-2 border-ink-900 ${home.banner_bg === c.value ? "ring-4 ring-violet-500" : ""}`} style={{ background: c.value }} />
            ))}
            <input type="color" value={home.banner_bg} onChange={(e) => setHome({ ...home, banner_bg: e.target.value })} className="h-9 w-12" aria-label="Màu khác" />
            <button type="button" className="text-xs underline" onClick={() => setHome({ ...home, banner_bg: defaultHome.banner_bg })}>Mặc định</button>
          </div>
        </div>
      </fieldset>

      {/* ---------- 6 lựa chọn ---------- */}
      <fieldset className="panel space-y-4 p-5">
        <legend className="eyebrow bg-violet-500 text-white">6 lựa chọn</legend>
        {options.map((o, i) => (
          <div key={i} className="rounded-[18px] bg-cream-100 p-4">
            <p className="mb-3 font-display text-xl text-ink-900">Lựa chọn {i + 1} · {i % 2 === 0 ? "bông hoa" : "vuông 8 cánh"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên hiển thị"><input className="field" value={o.title} onChange={(e) => setOpt(i, { title: e.target.value })} /></Field>
              <Field label="Link"><input className="field" value={o.href} onChange={(e) => setOpt(i, { href: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-6">
              <ImageInput value={o.icon_url} onChange={(u) => setOpt(i, { icon_url: u })} folder="icons" allowSvg
                label="Icon riêng (PNG/SVG)" removeLabel="Dùng icon mặc định" />
              <div>
                <span className="mb-1 block text-sm font-medium">Màu nền</span>
                <div className="flex items-center gap-2">
                  {COLORS.map((c) => (
                    <button key={c.value} type="button" title={c.label} aria-label={c.label} onClick={() => setOpt(i, { color: c.value })}
                      className={`h-9 w-9 rounded-full border-2 border-ink-900 ${c.cls} ${o.color === c.value ? "ring-4 ring-violet-300" : ""}`} />
                  ))}
                  <label title="Màu riêng" className={`flex items-center gap-1 rounded-full border-2 border-ink-900 bg-white py-0.5 pl-0.5 pr-2 text-xs ${o.color === "custom" ? "ring-4 ring-violet-300" : ""}`}>
                    <input type="color" value={o.bg_custom} onChange={(e) => setOpt(i, { color: "custom", bg_custom: e.target.value })}
                      onClick={() => setOpt(i, { color: "custom" })} className="h-7 w-7 cursor-pointer rounded-full" aria-label="Màu nền riêng" />
                    Màu riêng
                  </label>
                </div>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">Màu icon</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setOpt(i, { icon_color: "" })}
                    className={`rounded-full border-2 border-ink-900 bg-white px-3 py-1.5 text-xs ${!o.icon_color ? "ring-4 ring-violet-300" : ""}`}>Tự động</button>
                  <label className={`flex items-center gap-1 rounded-full border-2 border-ink-900 bg-white py-0.5 pl-0.5 pr-2 text-xs ${o.icon_color ? "ring-4 ring-violet-300" : ""}`}>
                    <input type="color" value={o.icon_color || "#141414"} onChange={(e) => setOpt(i, { icon_color: e.target.value })}
                      className="h-7 w-7 cursor-pointer rounded-full" aria-label="Màu icon riêng" />
                    Chọn màu
                  </label>
                </div>
                <span className="mt-1 block text-xs text-ink-500">Chỉ áp dụng cho icon mặc định</span>
              </div>
              <button type="button" className="text-xs underline" onClick={() => setOpt(i, { ...defaultOptions[i], icon_url: o.icon_url })}>
                Đặt lại tên, link, màu mặc định
              </button>
            </div>
          </div>
        ))}
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn" disabled={saving}>{saving ? "Đang lưu..." : "Lưu trang chủ"}</button>
        <Message msg={msg} />
      </div>
    </form>
  );
}
