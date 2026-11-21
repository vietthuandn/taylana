"use client";

import Link from "next/link";
import { useState } from "react";
import { useMenuDismiss } from "@/components/ui/useMenuDismiss";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { services } from "@/lib/services";
import { useCart } from "@/lib/cart";
import { FEATURE_REVIEWS } from "@/lib/features";

// Link trước đây nằm ở footer: Liên hệ hiện trên menu máy tính; tất cả hiện trong menu điện thoại
const extra = [
  { href: "/lien-he", title: "Liên hệ", desktop: true },
  ...(FEATURE_REVIEWS ? [{ href: "/san-pham#danh-gia", title: "Đánh giá", desktop: false }] : []),
  { href: "/don-hang-cua-toi", title: "Đơn hàng của tôi", desktop: false },
];

const isOn = (path: string, href: string) => path === href || path.startsWith(href + "/");

const itemCls = (on: boolean) =>
  `rounded-[8px] px-3 py-2 text-[14px] font-medium transition-colors hover:bg-[#f4f4f5] ${on ? "text-[#ff5fa2]" : "text-[#3f3f46] hover:text-[#18181b]"}`;

// Menu ngang (máy tính): link thường, mục của trang đang mở có chữ hồng
export function HeaderNav() {
  const path = usePathname();
  return (
    <nav className="ml-4 hidden flex-1 gap-0.5 lg:flex">
      {services.map((s) => <Link key={s.href} href={s.href} className={itemCls(isOn(path, s.href))}>{s.short}</Link>)}
      {extra.filter((x) => x.desktop).map((x) => <Link key={x.href} href={x.href} className={itemCls(isOn(path, x.href))}>{x.title}</Link>)}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav>
      {services.map((s) => (
        <Link key={s.href} href={s.href}
          className={`flex items-center justify-between rounded-[8px] px-3 py-2.5 text-[14px] font-medium hover:bg-[#f4f4f5] ${isOn(path, s.href) ? "text-[#ff5fa2]" : "text-[#18181b]"}`}>
          {s.title}<span aria-hidden className="text-[#a1a1aa]">→</span>
        </Link>
      ))}
      <div className="my-1 h-px bg-[#efeff1]" />
      {extra.map((x) => (
        <Link key={x.href} href={x.href}
          className={`flex items-center justify-between rounded-[8px] px-3 py-2.5 text-[14px] hover:bg-[#f4f4f5] ${isOn(path, x.href) ? "text-[#ff5fa2]" : "text-[#3f3f46]"}`}>
          {x.title}<span aria-hidden className="text-[#a1a1aa]">→</span>
        </Link>
      ))}
    </nav>
  );
}

// Icon giỏ hàng có badge số dòng
export function CartButton() {
  const lines = useCart();
  const n = lines.length;
  return (
    <Link href="/gio-hang" aria-label={`Giỏ hàng${n ? ` (${n})` : ""}`}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[#e5e5e7] bg-white text-[#18181b] hover:bg-[#f4f4f5]">
      <ShoppingCart size={17} />
      {n > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff5fa2] px-1 text-[11px] font-semibold leading-none text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}

// Điện thoại & máy tính bảng: nút hamburger + menu thả xuống (lớp nền phủ: chạm ra ngoài / Esc / chuyển trang → đóng)
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useMenuDismiss(open, () => setOpen(false));
  return (
    <div className="relative lg:hidden">
      <button type="button" aria-label={open ? "Đóng menu" : "Mở menu"} aria-expanded={open} onClick={() => setOpen(!open)}
        className="relative z-[2] grid h-9 w-9 place-items-center rounded-[8px] border border-[#e5e5e7] bg-white text-[#18181b]">
        {open ? <span className="text-[15px] leading-none">✕</span> : (
          <span className="flex flex-col gap-[4px]">
            <span className="h-[1.5px] w-4 bg-current" /><span className="h-[1.5px] w-4 bg-current" /><span className="h-[1.5px] w-4 bg-current" />
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1] bg-black/20" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-[2] mt-2 max-h-[calc(100dvh-80px)] w-72 max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain rounded-[12px] border border-[#e5e5e7] bg-white p-2 shadow-[0_8px_24px_rgb(0_0_0/0.08)]"
            onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
