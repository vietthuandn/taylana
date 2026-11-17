"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ShoppingCart } from "lucide-react";
import { services, submenuOf } from "@/lib/services";
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

// Menu ngang (máy tính): mục của trang đang mở có chữ hồng. "Thiết Kế", "Gửi file" là menu thả xuống.
export function HeaderNav() {
  const path = usePathname();
  return (
    <nav className="ml-4 hidden flex-1 gap-0.5 lg:flex">
      {services.map((s) => {
        const sub = submenuOf(s);
        if (!sub) return <Link key={s.href} href={s.href} className={itemCls(isOn(path, s.href))}>{s.short}</Link>;
        const on = sub.some((t) => isOn(path, t.href));
        return (
          <div key={s.href} className="group relative">
            <button type="button" aria-haspopup="menu" className={`${itemCls(on)} inline-flex items-center gap-1`}>
              {s.short} <ChevronDown size={14} className="text-[#a1a1aa]" />
            </button>
            {/* hiện khi rê chuột hoặc khi focus (bàn phím / chạm) */}
            <div role="menu" className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="min-w-[180px] rounded-[12px] border border-[#e5e5e7] bg-white p-1 shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
                {sub.map((t) => (
                  <Link key={t.href} href={t.href} role="menuitem"
                    className={`block rounded-[8px] px-3 py-2 text-[14px] hover:bg-[#f4f4f5] ${isOn(path, t.href) ? "text-[#ff5fa2]" : "text-[#18181b]"}`}>
                    {t.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      {extra.filter((x) => x.desktop).map((x) => (
        <Link key={x.href} href={x.href} className={itemCls(isOn(path, x.href))}>{x.title}</Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  const row = (on: boolean) => `flex items-center justify-between rounded-[8px] px-3 py-2.5 text-[14px] font-medium hover:bg-[#f4f4f5] ${on ? "text-[#ff5fa2]" : "text-[#18181b]"}`;
  return (
    <nav>
      {services.map((s) => {
        const sub = submenuOf(s);
        if (!sub) return <Link key={s.href} href={s.href} className={row(isOn(path, s.href))}>{s.title}<span aria-hidden className="text-[#a1a1aa]">→</span></Link>;
        const on = sub.some((t) => isOn(path, t.href));
        return (
          <details key={s.href} className="group/sub" open={on}>
            <summary className={`${row(on)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
              {s.title}<ChevronDown size={16} className="text-[#a1a1aa] transition-transform group-open/sub:rotate-180" />
            </summary>
            <div className="ml-3 border-l border-[#efeff1] pl-2">
              {sub.map((t) => (
                <Link key={t.href} href={t.href} className={`block rounded-[8px] px-3 py-2 text-[14px] hover:bg-[#f4f4f5] ${isOn(path, t.href) ? "text-[#ff5fa2]" : "text-[#3f3f46]"}`}>
                  {t.title}
                </Link>
              ))}
            </div>
          </details>
        );
      })}
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
