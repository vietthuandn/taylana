"use client";
/* Giao diện → Theme: màu trang khách — Màu chính · Màu nút khi chọn · Nền trang (màu / ảnh) · Header (nền, chữ, mục đang chọn).
   Mặc định = bộ màu gốc; "Đặt lại mặc định" lúc nào cũng được. Lưu → làm mới toàn bộ trang khách. */
import { useState } from "react";
import { ChevronDown, Plus, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { DEFAULT_THEME, MAX_THEMES, isHeaderBg, suggestGradient, type SavedTheme, type Theme } from "@/lib/theme";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Button, ImageInput, Message, SettingsSection, confirmDialog } from "@/components/admin/ui";

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
        <div className="w-32 text-center">
          <span className="relative block aspect-[1400/1150]"><span className="absolute left-1/2 top-1/2 h-[91.13%] w-[93.43%] -translate-x-1/2 -translate-y-1/2 rounded-[6%/7.3%]" style={{ background: t.tile_bg }} /></span>
          <p className="mt-1 font-tile text-[14px] font-bold" style={{ color: t.section_text }}>Tên mục</p>
        </div>
        <p className="text-[13px] text-[#3f3f46]">Chữ thường · <span style={{ color: t.primary }}>chữ nhấn / link</span></p>
      </div>
    </div>
  );
}

/** các ô chỉnh 1 theme (màu nhấn · nền trang · chữ khối · logo · header) */
function ThemeFields({ t, set, k }: { t: Theme; set: (p: Partial<Theme>) => void; k: string }) {
  return (
    <div className="space-y-4">
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
      <SettingsSection title="Chữ của khối" description="Tiêu đề các khối (vd. “Giỏ hàng”, tên danh mục mẫu) và tên các mục ở Trang chủ / Thiết kế / Liên hệ.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Color label="Màu chữ khối (Section text)" value={t.section_text} def={DEFAULT_THEME.section_text} onChange={(v) => set({ section_text: v })} />
          <Color label="Nền phía sau ảnh các mục" hint="Khung bo góc sau ảnh icon (ảnh nên là PNG 1400 × 1150 nền trong suốt)." value={t.tile_bg} def={DEFAULT_THEME.tile_bg} onChange={(v) => set({ tile_bg: v })} />
        </div>
      </SettingsSection>
      <SettingsSection title="Logo" description="Ảnh logo hiện trên header (nên dùng PNG nền trong suốt). Không có logo thì hiện chữ TAYLANA.">
        <ImageInput label="Logo website" value={t.logo_url} onChange={(u) => set({ logo_url: u })} folder="logo" allowSvg shrink={600} removeLabel="Bỏ logo — dùng chữ" />
      </SettingsSection>
      <SettingsSection title="Header">
        <div className="grid gap-4 sm:grid-cols-3">
          <HeaderBg key={k} value={t.header_bg} onChange={(v) => set({ header_bg: v })} />
          <Color label="Màu chữ" value={t.header_text} def={DEFAULT_THEME.header_text} onChange={(v) => set({ header_text: v })} />
          <Color label="Mục đang chọn" value={t.header_active} def={DEFAULT_THEME.header_active} onChange={(v) => set({ header_active: v })} />
        </div>
      </SettingsSection>
    </div>
  );
}

/** dải màu nhỏ tóm tắt 1 theme */
function Swatches({ t }: { t: Theme }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-[6px] border border-[#e5e5e7]">
      {[t.header_bg, t.primary, t.secondary, t.page_bg, t.tile_bg, t.section_text].map((c, i) => <span key={i} className="h-6 w-5" style={{ background: c }} />)}
    </span>
  );
}


/* Giao diện → Theme: tối đa 5 theme tự tạo (site_settings.themes = { list, active }) — mỗi theme 1 khối thu gọn, mở ra để sửa.
   "Áp dụng" = ghi theme đó vào site_settings.theme (trang khách dùng). "Đặt lại mặc định" = dùng bộ màu gốc, không theme nào được chọn. */
export function ThemeForm({ initialList, initialActive }: { initialList: SavedTheme[]; initialActive: string | null }) {
  const [list, setList] = useState(initialList);
  const [active, setActive] = useState(initialActive);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<SavedTheme | null>(null); // theme đang sửa (bản nháp chưa lưu)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /** lưu danh sách + theme đang dùng lên database rồi làm mới trang khách */
  async function persist(nextList: SavedTheme[], nextActive: string | null, text: string, before: SavedTheme[] = list) {
    setBusy(true); setMsg(null);
    const applied = nextList.find((x) => x.id === nextActive)?.theme ?? DEFAULT_THEME;
    const now = new Date().toISOString();
    const { error } = await createClient().from("site_settings").upsert([
      { key: "themes", value: { list: nextList, active: nextActive }, updated_at: now },
      { key: "theme", value: applied, updated_at: now },
    ]);
    setBusy(false);
    if (error) { setMsg({ type: "err", text: error.message }); return false; }
    // ảnh (nền / logo) không còn theme nào dùng → xoá
    const used = new Set(nextList.flatMap((x) => [x.theme.page_bg_image, x.theme.logo_url]));
    await Promise.all(before.flatMap((x) => [x.theme.page_bg_image, x.theme.logo_url]).filter((u) => u && !used.has(u)).map(removePublicImage));
    await revalidatePublic(["/", "/api/favicon"], true);
    setList(nextList); setActive(nextActive); setMsg({ type: "ok", text });
    return true;
  }
  function edit(x: SavedTheme) {
    if (open === x.id) { setOpen(null); setDraft(null); return; }
    setOpen(x.id); setDraft(structuredClone(x));
  }
  function addTheme() {
    if (list.length >= MAX_THEMES) return;
    const cur = list.find((x) => x.id === active)?.theme ?? DEFAULT_THEME;
    const x: SavedTheme = { id: Math.random().toString(36).slice(2, 10), name: `Theme ${list.length + 1}`, theme: { ...cur } };
    setOpen(x.id); setDraft(x);
  }
  const isNew = !!draft && !list.some((x) => x.id === draft.id);
  const dirty = !!draft && (isNew || JSON.stringify(draft) !== JSON.stringify(list.find((x) => x.id === draft.id)));
  async function saveDraft(apply: boolean) {
    if (!draft) return;
    const v = { ...draft, name: draft.name.trim() || "Theme" };
    const next = isNew ? [...list, v] : list.map((x) => (x.id === v.id ? v : x));
    const nextActive = apply ? v.id : active;
    if (await persist(next, nextActive, apply ? `Đã lưu và áp dụng “${v.name}”.` : v.id === active ? `Đã lưu “${v.name}” — trang khách đã cập nhật.` : `Đã lưu “${v.name}”.`)) setDraft(v);
  }

  const rows = [...list, ...(isNew && draft ? [draft] : [])];
  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#e5e5e7] bg-white p-3">
        <Button variant="secondary" icon={<RotateCcw size={16} />} loading={busy} disabled={active === null}
          onClick={async () => { if (await confirmDialog("Trang khách dùng lại bộ màu mặc định ban đầu, không theme nào được chọn. Các theme đã lưu vẫn giữ nguyên.", { title: "Đặt lại mặc định", ok: "Đặt lại" })) persist(list, null, "Đã đặt lại mặc định — không theme nào được chọn."); }}>Đặt lại mặc định</Button>
        <span className="text-[13px] text-[#71717a]">{active === null ? "Đang dùng: Mặc định" : `Đang dùng: ${list.find((x) => x.id === active)?.name ?? ""}`}</span>
        <span className="flex-1" />
        <span className="text-[12px] text-[#a1a1aa]">{list.length} / {MAX_THEMES} theme</span>
        <Button icon={<Plus size={16} />} disabled={list.length >= MAX_THEMES || isNew} onClick={addTheme} title={list.length >= MAX_THEMES ? "Tối đa 5 theme — xoá bớt để thêm" : undefined}>Thêm theme</Button>
      </div>

      {!rows.length && <p className="rounded-[12px] border border-dashed border-[#d4d4d8] bg-white p-8 text-center text-[14px] text-[#71717a]">Chưa có theme nào — trang khách đang dùng màu mặc định. Bấm “Thêm theme” để tự tạo (tối đa 5).</p>}

      {rows.map((x) => {
        const on = active === x.id, isOpen = open === x.id && draft?.id === x.id, t = isOpen ? draft!.theme : x.theme;
        return (
          <section key={x.id} className={`overflow-hidden rounded-[12px] border bg-white ${on ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/15" : "border-[#e5e5e7]"}`}>
            <div className="flex flex-wrap items-center gap-3 p-3">
              <button type="button" onClick={() => edit(x)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                <ChevronDown size={16} className={`shrink-0 text-[#71717a] transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                <Swatches t={t} />
                <span className="min-w-0 truncate text-[14px] font-semibold">{isOpen ? draft!.name || "Theme" : x.name}</span>
                {on && <Badge tone="green">Đang dùng</Badge>}
                {isOpen && isNew && <Badge>Chưa lưu</Badge>}
              </button>
              {!on && !(isOpen && isNew) && <Button size="sm" loading={busy} onClick={() => persist(list, x.id, `Đã áp dụng “${x.name}”.`)}>Áp dụng</Button>}
              <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} className="!text-[#dc2626]"
                onClick={async () => {
                  if (isOpen && isNew) { setOpen(null); setDraft(null); return; }
                  if (!(await confirmDialog(`Xoá “${x.name}”?${on ? " Trang khách sẽ quay về màu mặc định." : ""}`, { title: "Xoá theme", ok: "Xoá", danger: true }))) return;
                  if (await persist(list.filter((y) => y.id !== x.id), on ? null : active, `Đã xoá “${x.name}”.`)) { if (open === x.id) { setOpen(null); setDraft(null); } }
                }}>Xoá</Button>
            </div>
            {isOpen && draft && (
              <div className="grid gap-6 border-t border-[#efeff1] p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 space-y-4">
                  <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Tên theme</span>
                    <input value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 w-full max-w-[320px] rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" /></label>
                  <ThemeFields k={draft.id} t={draft.theme} set={(p) => setDraft({ ...draft, theme: { ...draft.theme, ...p } })} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button icon={<Save size={16} />} loading={busy} disabled={!dirty} onClick={() => saveDraft(false)}>Lưu theme</Button>
                    {!on && <Button variant="secondary" loading={busy} onClick={() => saveDraft(true)}>Lưu và áp dụng</Button>}
                    {dirty && !isNew && <Button variant="ghost" onClick={() => setDraft(structuredClone(x))}>Huỷ thay đổi</Button>}
                  </div>
                </div>
                <aside className="xl:sticky xl:top-20 xl:self-start">
                  <p className="mb-2 text-[13px] font-medium text-[#52525b]">Xem trước</p>
                  <Preview t={draft.theme} />
                </aside>
              </div>
            )}
          </section>
        );
      })}
      <Message msg={msg} />
    </div>
  );
}
