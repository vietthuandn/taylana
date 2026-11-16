"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLinks } from "@/lib/adminLinks";


export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
      {adminLinks.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        if (l.soon) {
          return (
            <span key={l.href} className="shrink-0 cursor-default rounded-full px-3 py-2 text-sm text-white/40" title="Giai đoạn sau">
              {l.label} <small>· sắp có</small>
            </span>
          );
        }
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-lime-500 text-ink-900" : "text-white/85 hover:bg-white/10"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
