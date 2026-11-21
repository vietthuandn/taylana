"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { defaultHome, defaultOptions, isDark, TEXT_COLORS, TILE_COLORS, type HomeOption, type HomeSettings, type TextColor } from "@/lib/settings";
import { Tile } from "@/components/site/HomeTiles";
import { revalidatePublic } from "@/app/admin/actions";
import { CdDisc } from "@/components/ui/Shapes";
import { ColorInput, Field, ImageInput, Input, Message, SaveBar, SettingsSection, Swatch, Textarea, Toggle } from "@/components/admin/ui";

const BG_PRESETS = [
  { label: "Xanh chanh", value: "#c8e03c" },
  { label: "Tím", value: "#7b68ee" },
  { label: "Hồng đậm", value: "#ff5fa2" },
  { label: "Kem", value: "#f7f0e6" },
  { label: "Đen", value: "#141414" },
];

export function HomeForm({ initialHome, initialOptions }: { initialHome: HomeSettings; initialOptions: HomeOption[] }) {
  const [home, setHome] = useState(initialHome);
  const [options, setOptions] = useState(initialOptions);
  const [saved, setSaved] = useState<[HomeSettings, HomeOption[]]>([initialHome, initialOptions]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const h = (k: "banner_title" | "banner_subtitle" | "btn1_label" | "btn1_href" | "btn2_label" | "btn2_href") => ({
    value: home[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setHome({ ...home, [k]: e.target.value }),
  });
  const setOpt = (i: number, p: Partial<HomeOption>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...p } : o)));

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
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
    const before = [saved[0].banner_image, ...saved[1].map((o) => o.image_url)];
    const now2 = new Set([home.banner_image, ...options.map((o) => o.image_url)]);
    await Promise.all(before.filter((u) => u && !now2.has(u)).map(removePublicImage));
    await revalidatePublic(["/"]);
    setSaved([home, options]);
    setMsg({ type: "ok", text: "Đã lưu — trang chủ đã cập nhật." });
  }

  const dirty = JSON.stringify([home, options]) !== JSON.stringify(saved);
  const dark = isDark(home.banner_bg);

  return (
    <form onSubmit={save} className="grid gap-6 pb-20 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        {/* ---------- Banner ---------- */}
        <SettingsSection title="Banner" description="Chỉ hiện trên máy tính (từ 768px). Tắt banner thì 6 ô menu ra giữa màn hình, 3 ô mỗi hàng.">
          <Toggle checked={home.banner_enabled} onChange={(v) => setHome({ ...home, banner_enabled: v })} label="Hiện banner" />
          <Field label="Tiêu đề" hint="Tự in hoa trên trang chủ"><Input {...h("banner_title")} /></Field>
          <Field label="Nội dung" hint="1–2 dòng"><Textarea rows={2} {...h("banner_subtitle")} /></Field>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium">Màu nền banner</span>
            <div className="flex flex-wrap items-center gap-2.5">
              {BG_PRESETS.map((c) => <Swatch key={c.value} color={c.value} title={c.label} active={home.banner_bg === c.value} onClick={() => setHome({ ...home, banner_bg: c.value })} />)}
              <ColorInput value={home.banner_bg} onChange={(v) => setHome({ ...home, banner_bg: v })} />
              <button type="button" className="text-[12px] text-[#71717a] hover:text-[#18181b]" onClick={() => setHome({ ...home, banner_bg: defaultHome.banner_bg })}>Mặc định</button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Nút trên banner" description="Tên nút và đường dẫn khi bấm.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nút 1 — tên"><Input {...h("btn1_label")} /></Field>
            <Field label="Nút 1 — link" hint="Ví dụ /dat-don hoặc https://..."><Input {...h("btn1_href")} /></Field>
          </div>
          <Toggle checked={home.btn2_enabled} onChange={(v) => setHome({ ...home, btn2_enabled: v })} label="Bật nút thứ 2" />
          {home.btn2_enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nút 2 — tên"><Input {...h("btn2_label")} /></Field>
              <Field label="Nút 2 — link"><Input {...h("btn2_href")} /></Field>
            </div>
          )}
        </SettingsSection>

        <SettingsSection title="Ảnh banner" description="Ảnh vuông bên phải banner, ảnh sẽ phủ kín khung.">
          <Toggle checked={home.banner_image_enabled} onChange={(v) => setHome({ ...home, banner_image_enabled: v })} label="Hiện ảnh bên phải" />
          {home.banner_image_enabled && (
            <>
              <ImageInput value={home.banner_image} onChange={(u) => setHome({ ...home, banner_image: u })} folder="home"
                label="Ảnh" removeLabel="Xoá — dùng ảnh mặc định" />
              <Toggle checked={home.banner_image_petal} onChange={(v) => setHome({ ...home, banner_image_petal: v })}
                label="Khung cánh hoa tròn (tắt = hình vuông)" />
            </>
          )}
        </SettingsSection>

        {/* ---------- 6 ô menu ---------- */}
        {options.map((o, i) => (
          <SettingsSection key={i} title={`Ô menu ${i + 1}`}
            description={i === 0 ? "Mẹo: viết chữ trong [ngoặc vuông] để tô màu tím nhạt, ví dụ “Sản phẩm & [đánh giá]”." : undefined}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Chữ menu"><Input value={o.title} onChange={(e) => setOpt(i, { title: e.target.value })} /></Field>
              <Field label="Link"><Input value={o.href} onChange={(e) => setOpt(i, { href: e.target.value })} /></Field>
            </div>
            <ImageInput value={o.image_url} onChange={(u) => setOpt(i, { image_url: u })} folder="icons" allowSvg
              label="Ảnh (PNG/SVG, nên nền trong suốt)" removeLabel="Xoá ảnh — chỉ hiện chữ" />
            <button type="button" className="text-[12px] text-[#71717a] hover:text-[#18181b]" onClick={() => setOpt(i, { title: defaultOptions[i].title, href: defaultOptions[i].href })}>
              Đặt lại tên, link mặc định (giữ ảnh)
            </button>
          </SettingsSection>
        ))}
      </div>

      {/* ---------- Xem trước trực tiếp ---------- */}
      <aside className="xl:sticky xl:top-[88px] xl:self-start">
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white">
          <div className="flex items-center justify-between border-b border-[#efeff1] px-4 py-3">
            <p className="text-[15px] font-semibold">Xem trước</p>
            <span className="text-[12px] text-[#71717a]">Cập nhật ngay khi sửa</span>
          </div>
          <div className="site-ui space-y-3 rounded-b-[12px] bg-[#f7f0e6] p-3">
            {home.banner_enabled && (
              <div className={`grid items-center gap-3 overflow-hidden rounded-[14px] p-4 ${home.banner_image_enabled ? "grid-cols-[1.3fr_1fr]" : ""}`} style={{ background: home.banner_bg }}>
                <div>
                  <p className={`font-display text-[20px] leading-[1.05] ${dark ? "!text-white" : "text-ink-900"}`}>{home.banner_title}</p>
                  {home.banner_subtitle && <p className={`mt-1.5 text-[10px] leading-snug ${dark ? "text-white/85" : "text-ink-700"}`}>{home.banner_subtitle}</p>}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {home.btn1_label && <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${dark ? "bg-lime-500 text-ink-900" : "bg-ink-900 text-white"}`}>{home.btn1_label}</span>}
                    {home.btn2_enabled && home.btn2_label && <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${dark ? "border-white text-white" : "border-ink-900 text-ink-900"}`}>{home.btn2_label}</span>}
                  </div>
                </div>
                {home.banner_image_enabled && (
                  <div className={`relative aspect-square overflow-hidden ${home.banner_image_petal ? "rounded-[40%_40%_40%_40%/45%_45%_45%_45%]" : "border border-ink-900"}`}>
                    {home.banner_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={home.banner_image} alt="" className="h-full w-full object-cover" />
                    ) : <div className="grid h-full place-items-center bg-violet-500"><CdDisc className="w-3/4" /></div>}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {options.map((o, i) => <Tile key={i} o={o} index={i} preview />)}
            </div>
          </div>
        </div>
      </aside>

      <SaveBar show={dirty} saving={saving} onReset={() => { setHome(saved[0]); setOptions(saved[1]); }} />
      <Message msg={msg} />
    </form>
  );
}
