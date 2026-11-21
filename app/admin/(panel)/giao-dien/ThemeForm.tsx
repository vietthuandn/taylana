"use client";
/* Giao diện → Theme: màu trang khách — Màu chính · Màu nút khi chọn · Nền trang (màu / ảnh) · Header (nền, chữ, mục đang chọn).
   Mặc định = bộ màu gốc; "Đặt lại mặc định" lúc nào cũng được. Lưu → làm mới toàn bộ trang khách. */
import { useState } from "react";
import { RotateCcw, Save, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { DEFAULT_THEME, isHeaderBg, suggestGradient, type Theme } from "@/lib/theme";
import { revalidatePublic } from "@/app/admin/actions";
import { Button, ImageInput, Message, SaveBar, SettingsSection, confirmDialog } from "@/components/admin/ui";

/** mã màu khách dán vào: có / không có "#", 3 hoặc 6 ký tự → "#rrggbb" (sai → null) */
function parseHex(v: string) {
  let h = v.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

function Color({ label, hint, value, def, onChange }: { label: string; hint?: string; value: string; def: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-[8px] border border-[#e5e5e7]" style={{ background: value }} title="Chọn màu">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
        </label>
        <input defaultValue={value} key={value} maxLength={9} aria-label={`${label} (mã màu)`} placeholder="#FF5FA2"
          onChange={(e) => { const h = parseHex(e.target.value); if (h && e.target.value.replace(/^#/, "").length === 6) onChange(h); }}
          onBlur={(e) => { const h = parseHex(e.target.value); if (h) onChange(h); else e.target.value = value; }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
          className="h-9 w-[96px] rounded-[8px] border border-[#e5e5e7] px-2 font-mono text-[13px] uppercase outline-none focus:border-[#ff5fa2]" />
        {value !== def && <button type="button" onClick={() => onChange(def)} className="text-[12px] text-[#71717a] hover:text-[#18181b]">Mặc định</button>}
      </div>
      {hint && <span className="mt-1 block text-[12px] text-[#71717a]">{hint}</span>}
    </div>
  );
}

/** nền header: chọn màu, hoặc dán mã CSS gradient (linear-gradient(...)) · nút gợi ý gradient từ 1 màu */
function HeaderBg({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : (value.match(/#[0-9a-f]{6}/i)?.[0] ?? "#fb9db0");
  const [code, setCode] = useState(value);
  const [base, setBase] = useState("#fb9db0");
  const ok = isHeaderBg(code.trim());
  return (
    <div className="space-y-2 sm:col-span-3">
      <span className="block text-[13px] font-medium">Nền header (màu hoặc mã gradient)</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-[8px] border border-[#e5e5e7]" style={{ background: value }} title="Chọn 1 màu">
          <input type="color" value={hex} onChange={(e) => { onChange(e.target.value); setCode(e.target.value); }} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu nền header" />
        </label>
        <input value={code} onChange={(e) => { setCode(e.target.value); const v = e.target.value.trim(); if (isHeaderBg(v)) onChange(v); }} placeholder="#ffffff hoặc linear-gradient(120deg, #fb9db0 0%, #ffe1e8 100%)"
          className={`h-9 min-w-0 flex-1 rounded-[8px] border px-2 font-mono text-[12px] outline-none focus:border-[#ff5fa2] ${code && !ok ? "border-[#f59e0b] bg-[#fffbeb]" : "border-[#e5e5e7]"}`} aria-label="Mã màu / gradient nền header" />
        {value !== DEFAULT_THEME.header_bg && <button type="button" onClick={() => { onChange(DEFAULT_THEME.header_bg); setCode(DEFAULT_THEME.header_bg); }} className="text-[12px] text-[#71717a] hover:text-[#18181b]">Mặc định</button>}
      </div>
      {code && !ok && <p className="text-[12px] text-[#b45309]">Mã chưa đúng — dùng #rrggbb hoặc linear-gradient(...) / radial-gradient(...).</p>}
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[#fafafa] p-2.5">
        <span className="text-[12px] text-[#52525b]">Sinh gradient đẹp từ màu</span>
        <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-[6px] border border-[#e5e5e7]" style={{ background: base }}>
          <input type="color" value={base} onChange={(e) => setBase(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu gốc gradient" />
        </label>
        <input defaultValue={base} key={base} maxLength={7} onChange={(e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value.trim())) setBase(e.target.value.trim().toLowerCase()); }} className="h-7 w-[84px] rounded-[6px] border border-[#e5e5e7] px-1.5 font-mono text-[12px] uppercase" aria-label="Mã màu gốc" />
        <span className="h-7 w-24 rounded-[6px] border border-[#e5e5e7]" style={{ background: suggestGradient(base) }} />
        <button type="button" onClick={() => { const g = suggestGradient(base); onChange(g); setCode(g); }} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#e5e5e7] bg-white px-2.5 text-[12px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Sparkles size={12} /> Dùng gradient này</button>
      </div>
    </div>
  );
}

function Preview({ t }: { t: Theme }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#e5e5e7]">
      <div className="flex h-11 items-center gap-3 border-b border-[#e5e5e7] px-3" style={{ background: t.header_bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {t.logo_url ? <img src={t.logo_url} alt="" className="h-7 w-auto max-w-[90px] object-contain" /> : <span className="font-display text-[18px]" style={{ color: t.header_text }}>TAYLANA</span>}
        <span className="text-[12px] font-medium" style={{ color: t.header_active }}>Đặt đơn</span>
        <span className="text-[12px] font-medium" style={{ color: t.header_text }}>Thiết Kế</span>
        <span className="text-[12px] font-medium" style={{ color: t.header_text }}>Hướng dẫn</span>
      </div>
      <div className="space-y-3 p-4" style={{ backgroundColor: t.page_bg, backgroundImage: t.page_bg_image ? `url("${t.page_bg_image}")` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border px-3 py-1 text-[12px] font-medium" style={{ borderColor: t.primary, background: t.secondary, color: t.primary }}>Đang chọn</span>
          <span className="rounded-full border border-[#e5e5e7] bg-white px-3 py-1 text-[12px] font-medium text-[#52525b]">Chưa chọn</span>
        </div>
        <div className="flex gap-2">
          <span className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-white" style={{ background: t.primary }}>Nút chính</span>
          <span className="rounded-[8px] border border-[#e5e5e7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#18181b]">Nút phụ</span>
        </div>
        <p className="text-[13px] font-semibold" style={{ color: t.section_text }}>Tiêu đề khối</p>
        <p className="font-tile text-[18px] font-bold" style={{ color: t.section_text }}>Tên mục trang chủ</p>
        <p className="text-[13px] text-[#3f3f46]">Chữ thường · <span style={{ color: t.primary }}>chữ nhấn / link</span></p>
      </div>
    </div>
  );
}

export function ThemeForm({ initial }: { initial: Theme }) {
  const [t, setT] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const set = (p: Partial<Theme>) => setT({ ...t, ...p });
  async function persist(v: Theme, text: string) {
    setSaving(true); setMsg(null);
    const { error } = await createClient().from("site_settings").upsert({ key: "theme", value: v, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    if (saved.page_bg_image && saved.page_bg_image !== v.page_bg_image) await removePublicImage(saved.page_bg_image);
    if (saved.logo_url && saved.logo_url !== v.logo_url) await removePublicImage(saved.logo_url);
    await revalidatePublic(["/", "/api/favicon"], true); // làm mới mọi trang khách + favicon
    setSaved(v); setT(v);
    setMsg({ type: "ok", text });
  }
  const isDefault = JSON.stringify(saved) === JSON.stringify(DEFAULT_THEME);
  return (
    <form onSubmit={(e) => { e.preventDefault(); persist(t, "Đã lưu Theme — trang khách đã cập nhật."); }} className="grid gap-6 pb-20 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-4">
        <SettingsSection title="Màu nhấn" description="Áp dụng cho trang khách (trang admin giữ nguyên).">
          <div className="grid gap-4 sm:grid-cols-2">
            <Color label="Màu chính (Primary)" hint="Nút chính, chữ nhấn, viền mục đang chọn." value={t.primary} def={DEFAULT_THEME.primary} onChange={(v) => set({ primary: v })} />
            <Color label="Màu phụ (Secondary)" hint="Nền nút / chip khi đang được chọn." value={t.secondary} def={DEFAULT_THEME.secondary} onChange={(v) => set({ secondary: v })} />
          </div>
        </SettingsSection>
        <SettingsSection title="Nền trang" description="Chọn màu nền, hoặc tải ảnh nền (ảnh phủ kín, đè lên màu nền).">
          <div className="grid gap-4 sm:grid-cols-2">
            <Color label="Màu nền" value={t.page_bg} def={DEFAULT_THEME.page_bg} onChange={(v) => set({ page_bg: v })} />
            <ImageInput label="Ảnh nền (không bắt buộc)" value={t.page_bg_image} onChange={(u) => set({ page_bg_image: u })} folder="theme" shrink={2000} removeLabel="Bỏ ảnh nền" />
          </div>
        </SettingsSection>
        <SettingsSection title="Chữ của khối" description="Tiêu đề các khối (vd. “Giỏ hàng”, tên danh mục mẫu) và tên các mục ở Trang chủ / trang Thiết kế.">
          <Color label="Màu chữ khối (Section text)" value={t.section_text} def={DEFAULT_THEME.section_text} onChange={(v) => set({ section_text: v })} />
        </SettingsSection>
        <SettingsSection title="Logo" description="Ảnh logo hiện trên header (nên dùng PNG nền trong suốt). Không có logo thì hiện chữ TAYLANA.">
          <ImageInput label="Logo website" value={t.logo_url} onChange={(u) => set({ logo_url: u })} folder="logo" allowSvg shrink={600} removeLabel="Bỏ logo — dùng chữ" />
        </SettingsSection>
        <SettingsSection title="Header">
          <div className="grid gap-4 sm:grid-cols-3">
            <HeaderBg key={saved.header_bg} value={t.header_bg} onChange={(v) => set({ header_bg: v })} />
            <Color label="Màu chữ" value={t.header_text} def={DEFAULT_THEME.header_text} onChange={(v) => set({ header_text: v })} />
            <Color label="Mục đang chọn" value={t.header_active} def={DEFAULT_THEME.header_active} onChange={(v) => set({ header_active: v })} />
          </div>
        </SettingsSection>
        <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" icon={<Save size={16} />} loading={saving} disabled={JSON.stringify(t) === JSON.stringify(saved)}>Lưu thay đổi</Button>
        <Button variant="secondary" icon={<RotateCcw size={16} />} disabled={isDefault && JSON.stringify(t) === JSON.stringify(DEFAULT_THEME)} loading={saving}
          onClick={async () => { if (await confirmDialog("Đưa toàn bộ màu, nền và header về mặc định ban đầu?", { title: "Đặt lại mặc định", ok: "Đặt lại" })) persist(DEFAULT_THEME, "Đã đặt lại Theme mặc định."); }}>Đặt lại mặc định</Button>
        </div>
      </div>
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-[13px] font-medium text-[#52525b]">Xem trước</p>
        <Preview t={t} />
      </aside>
      <SaveBar show={JSON.stringify(t) !== JSON.stringify(saved)} saving={saving} onReset={() => setT(saved)} />
      <Message msg={msg} />
    </form>
  );
}
