"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { services } from "@/lib/services";
import { useCart } from "@/lib/cart";

const isOn = (path: string, href: string) => path === href || path.startsWith(href + "/");

// Menu ngang (máy tính): mục của trang đang mở có chữ hồng
export function HeaderNav() {
  const path = usePathname();
  return (
    <nav className="ml-4 hidden flex-1 gap-0.5 lg:flex">
      {services.map((s) => (
        <Link key={s.href} href={s.href}
          className={`rounded-[8px] px-3 py-2 text-[14px] font-medium transition-colors hover:bg-[#f4f4f5] ${isOn(path, s.href) ? "text-[#ff5fa2]" : "text-[#3f3f46] hover:text-[#18181b]"}`}>
          {s.short}
        </Link>
      ))}
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
