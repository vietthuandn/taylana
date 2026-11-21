"use client";
/* Thanh tab ngang dùng chung (admin + trang khách).
   ≥ 640px: hàng nút / link. < 640px: 1 dropdown hiện tab đang chọn, bấm để chọn tab khác.
   Tab có href → chuyển trang; không có → gọi onChange. */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export type TabItem<T extends string = string> = { id: T; label: string; href?: string; icon?: React.ReactNode };

export function ResponsiveTabs<T extends string>({ tabs, value, onChange, className = "", size = "md" }: {
  tabs: readonly TabItem<T>[]; value: T; onChange?: (id: T) => void; className?: string; size?: "md" | "sm";
}) {
  const router = useRouter();
  const pick = (id: T) => { const t = tabs.find((x) => x.id === id); if (t?.href) router.push(t.href); else onChange?.(id); };
  const cls = (on: boolean) => `inline-flex items-center gap-1.5 whitespace-nowrap rounded-[8px] ${size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-3.5 py-1.5 text-[14px]"} font-medium ${on ? "bg-[var(--c-secondary)] text-[var(--c-primary)]" : "text-[#52525b] hover:text-[#18181b]"}`;
  return (
    <>
      <div className={`relative sm:hidden ${className}`}>
        <select aria-label="Chọn mục" value={value} onChange={(e) => pick(e.target.value as T)}
          className="h-10 w-full min-w-0 appearance-none rounded-[10px] border border-[#e5e5e7] bg-white pl-3 pr-9 text-[16px] font-medium text-[var(--c-primary)] outline-none focus:border-[var(--c-primary)]">
          {tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
      </div>
      <nav className={`hidden max-w-full flex-wrap gap-0.5 rounded-[10px] border border-[#e5e5e7] bg-white p-1 sm:inline-flex ${className}`}>
        {tabs.map((t) => t.href
          ? <Link key={t.id} href={t.href} className={cls(t.id === value)}>{t.icon}{t.label}</Link>
          : <button key={t.id} type="button" onClick={() => onChange?.(t.id)} className={cls(t.id === value)}>{t.icon}{t.label}</button>)}
      </nav>
    </>
  );
}
