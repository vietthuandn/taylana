"use client";
/* Header riêng của các trình chỉnh phía khách (CD Template, Booklet Template, Back cover Template, Booklet Lyrics, Lên mockup) — cao 56px,
   THAY header của web (layout ẩn header web khi trang có [data-editor]). Màu nền / chữ / logo theo Theme (Admin → Giao diện → Theme).
   Nút: trong suốt, chữ + viền mảnh theo màu chữ header.
   Điện thoại: trái logo (về /thiet-ke) · Hoàn tác · Làm lại — phải "4 trang ▾" (Booklet) · Lưu · Tải về · ⋯
   Máy tính: trái ← (về /thiet-ke) · logo — phải "Số trang: 4 ▾" (Booklet) · Lưu · Tải về · (Chia sẻ) · ⋯ (Hoàn tác / Làm lại: Ctrl+Z / Ctrl+Shift+Z) */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Download, MoreHorizontal, Redo2, Save, Share2, Undo2 } from "lucide-react";
import { useSiteTheme } from "@/components/site/ThemeContext";
import { cx } from "@/components/ui/styles";

export type EditorHeaderProps = {
  pages?: { value: number; options: readonly number[]; onChange: (n: number) => void; unit?: string }; // Booklet: số trang · Bìa sau: số mặt (unit "mặt")
  onSave?: () => void; downloads?: { label: string; onClick: () => void }[]; share?: { onClick: () => void; busy?: boolean };
  guides?: { value: boolean; onChange: (v: boolean) => void };
  undo?: { onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean };
  busy?: boolean;
};

function Menu({ button, children }: { button: (toggle: () => void) => React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", h); return () => document.removeEventListener("pointerdown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {button(() => setOpen((o) => !o))}
      {open && <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-[12px] border border-[#e5e5e7] bg-white p-1 text-[14px] text-[#18181b] shadow-[0_8px_24px_rgb(0_0_0/0.12)]" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export function EditorHeader({ h }: { h: EditorHeaderProps }) {
  const theme = useSiteTheme(), logo = theme?.logo_url;
  // nút trên header: trong suốt, chữ + viền mảnh theo màu chữ header
  const icon = "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-current hover:bg-white/15 disabled:opacity-40";
  const pill = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-current/60 bg-transparent px-3 text-[14px] font-medium text-current hover:bg-white/15 disabled:opacity-50";
  const item = "flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left hover:bg-[#f4f4f5]";
  const dls = h.downloads ?? [];
  const dl = (label: React.ReactNode, cls: string) => !dls.length ? null : dls.length === 1
    ? <button type="button" onClick={dls[0].onClick} disabled={h.busy} className={cls} title="Tải về" aria-label="Tải về">{label}</button>
    : <Menu button={(t) => <button type="button" onClick={t} disabled={h.busy} className={cls} title="Tải về" aria-label="Tải về">{label}</button>}>
        {dls.map((d) => <button key={d.label} type="button" onClick={d.onClick} className={item}><Download size={15} /> {d.label}</button>)}
      </Menu>;
  const pages = (label: React.ReactNode, cls: string) => h.pages && (
    <Menu button={(t) => <button type="button" onClick={t} className={cls}>{label} <ChevronDown size={14} /></button>}>
      {h.pages.options.map((n) => <button key={n} type="button" onClick={() => h.pages!.onChange(n)} className={cx(item, h.pages!.value === n && "font-semibold text-[var(--c-primary)]")}>{n} {h.pages!.unit ?? "trang"}{h.pages!.value === n && <Check size={15} className="ml-auto" />}</button>)}
    </Menu>
  );
  const more = h.guides && (
    <Menu button={(t) => <button type="button" onClick={t} title="Thêm" aria-label="Thêm" className={icon}><MoreHorizontal size={18} /></button>}>
      <button type="button" onClick={() => h.guides!.onChange(!h.guides!.value)} className={item}>Hiển thị guideline{h.guides.value && <Check size={15} className="ml-auto text-[var(--c-primary)]" />}</button>
    </Menu>
  );
  const brand = (
    <Link href="/thiet-ke" aria-label="Taylana — về trang Thiết kế" className="flex shrink-0 items-center px-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo ? <img src={logo} alt="Taylana" className="block h-8 w-auto max-w-[130px] object-contain" /> : <span className="font-display text-[22px] leading-none md:text-[24px]">TAYLANA</span>}
    </Link>
  );
  const share = h.share && <button type="button" onClick={h.share.onClick} disabled={h.share.busy} className={pill}><Share2 size={16} /> Chia sẻ</button>;
  return (
    <header className="sticky top-0 z-40 shrink-0 pt-[env(safe-area-inset-top)] border-b border-black/5 font-sans text-[var(--c-header-text)] [background:var(--c-header-bg)]">
      {/* điện thoại */}
      <div className="flex h-14 items-center gap-0.5 px-2 md:hidden">
        <Link href="/thiet-ke" aria-label="Quay lại Thiết kế" title="Quay lại" className={icon}><ArrowLeft size={20} /></Link>
        {h.undo && <button type="button" onClick={h.undo.onUndo} disabled={!h.undo.canUndo} title="Hoàn tác" aria-label="Hoàn tác" className={icon}><Undo2 size={18} /></button>}
        {h.undo && <button type="button" onClick={h.undo.onRedo} disabled={!h.undo.canRedo} title="Làm lại" aria-label="Làm lại" className={icon}><Redo2 size={18} /></button>}
        <span className="min-w-0 flex-1" />
        {pages(<>{h.pages?.value} {h.pages?.unit ?? "trang"}</>, "inline-flex h-9 items-center gap-1 rounded-[10px] border border-current/60 px-2.5 text-[13px] font-medium")}
        {h.share && <button type="button" onClick={h.share.onClick} disabled={h.share.busy} title="Chia sẻ" aria-label="Chia sẻ" className={icon}><Share2 size={18} /></button>}
        {h.onSave && <button type="button" onClick={h.onSave} disabled={h.busy} title="Lưu" aria-label="Lưu" className={icon}><Save size={18} /></button>}
        {dl(<Download size={18} />, icon)}
        {more}
      </div>
      {/* máy tính */}
      <div className="hidden h-14 items-center gap-1.5 px-3 md:flex">
        <Link href="/thiet-ke" aria-label="Quay lại Thiết kế" title="Quay lại" className={icon}><ArrowLeft size={18} /></Link>
        {brand}
        <span className="flex-1" />
        {pages(<>Số {h.pages?.unit ?? "trang"}: {h.pages?.value}</>, pill)}
        {share}
        {h.onSave && <button type="button" onClick={h.onSave} disabled={h.busy} className={pill}><Save size={16} /> Lưu</button>}
        {dl(<><Download size={16} /> Tải về</>, pill)}
        {more}
      </div>
    </header>
  );
}
