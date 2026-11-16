"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// soon = sẽ làm ở giai đoạn sau
export const adminLinks = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/don-hang", label: "Đơn hàng", soon: true },
  { href: "/admin/goi-san-pham", label: "Gói & phụ kiện", soon: true },
  { href: "/admin/san-pham", label: "Sản phẩm & đánh giá", soon: true },
  { href: "/admin/huong-dan", label: "Hướng dẫn", soon: true },
  { href: "/admin/mau-cd", label: "Mẫu Custom CD", soon: true },
  { href: "/admin/photostrip", label: "Khung Photostrip", soon: true },
  { href: "/admin/don-file", label: "Dọn file", soon: true },
  { href: "/admin/cai-dat", label: "Trang chủ & liên hệ" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
      {adminLinks.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        if (l.soon) {
          return (
            <span key={l.href} className="shrink-0 cursor-default rounded-full px-3 py-2 text-sm text-cocoa-400" title="Giai đoạn sau">
              {l.label} <small>· sắp có</small>
            </span>
          );
        }
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${active ? "bg-cream-50 pop-sm" : "hover:bg-pink-100"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
