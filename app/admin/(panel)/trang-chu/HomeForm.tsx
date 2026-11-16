"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { defaultHome, defaultOptions, TEXT_COLORS, TILE_COLORS, type HomeOption, type HomeSettings, type TextColor } from "@/lib/settings";
import { Tile } from "@/components/site/HomeTiles";
import { revalidatePublic } from "../../actions";
import { Field, ImageInput, Message, Toggle } from "@/components/admin/ui";

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
    const before = [initialHome.banner_image, ...initialOptions.map((o) => o.image_url)];
    const now2 = new Set([home.banner_image, ...options.map((o) => o.image_url)]);
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

      {/* ---------- 6 ô menu ---------- */}
      <fieldset className="panel space-y-4 p-5">
        <legend className="eyebrow bg-violet-500 text-white">6 ô menu</legend>
        <p className="text-xs text-ink-500">Mẹo: viết chữ trong [ngoặc vuông] để tô màu tím nhạt, ví dụ “Sản phẩm & [đánh giá]”.</p>
        {options.map((o, i) => (
          <div key={i} className="grid gap-4 rounded-[18px] bg-cream-100 p-4 sm:grid-cols-[150px_1fr]">
            <div>
              <p className="mb-2 text-sm font-bold text-ink-900">Ô {i + 1}</p>
              <Tile o={o} index={i} preview />
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Chữ menu"><input className="field" value={o.title} onChange={(e) => setOpt(i, { title: e.target.value })} /></Field>
                <Field label="Link"><input className="field" value={o.href} onChange={(e) => setOpt(i, { href: e.target.value })} /></Field>
              </div>
              <ImageInput value={o.image_url} onChange={(u) => setOpt(i, { image_url: u })} folder="tiles" allowSvg
                label="Ảnh (phủ kín ô, nên ảnh dọc 4:5)" removeLabel="Bỏ ảnh — dùng màu nền" />
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="mb-1 block text-sm font-medium">Vị trí chữ</span>
                  <div className="grid w-fit grid-cols-3 gap-1 rounded-[12px] border-[1.5px] border-ink-900 bg-white p-1">
                    {(["top", "middle", "bottom"] as const).map((v) =>
                      (["left", "center", "right"] as const).map((hh) => {
                        const on = o.text_v === v && o.text_h === hh;
                        return (
                          <button key={v + hh} type="button" onClick={() => setOpt(i, { text_v: v, text_h: hh })}
                            title={`${{ top: "Trên", middle: "Giữa", bottom: "Dưới" }[v]} · ${{ left: "trái", center: "giữa", right: "phải" }[hh]}`}
                            className={`grid h-8 w-8 place-items-center rounded-[8px] ${on ? "bg-ink-900" : "hover:bg-lime-100"}`}>
                            <span className={`block h-1.5 w-4 rounded-full ${on ? "bg-lime-500" : "bg-ink-300"}`} />
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-sm font-medium">Màu nền</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {TILE_COLORS.map((c) => (
                      <button key={c.value} type="button" title={c.label} aria-label={c.label} onClick={() => setOpt(i, { bg: c.value })}
                        className={`h-8 w-8 rounded-full border-2 border-ink-900 ${o.bg === c.value ? "ring-4 ring-violet-300" : ""}`} style={{ background: c.value }} />
                    ))}
                    <input type="color" value={o.bg} onChange={(e) => setOpt(i, { bg: e.target.value })} className="h-8 w-10" aria-label="Màu khác" />
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-sm font-medium">Màu chữ</span>
                  <div className="flex gap-2">
                    {(Object.keys(TEXT_COLORS) as TextColor[]).map((k) => (
                      <button key={k} type="button" onClick={() => setOpt(i, { text_color: k })}
                        className={`rounded-full border-2 border-ink-900 px-3 py-1 text-xs font-bold ${o.text_color === k ? "ring-4 ring-violet-300" : ""}`}
                        style={{ background: k === "white" ? "#3b1510" : "#fff", color: TEXT_COLORS[k] }}>
                        {{ brown: "Nâu", white: "Trắng", lilac: "Tím" }[k]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" className="text-xs underline" onClick={() => setOpt(i, { ...defaultOptions[i], image_url: o.image_url })}>
                Đặt lại mặc định (giữ ảnh)
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
