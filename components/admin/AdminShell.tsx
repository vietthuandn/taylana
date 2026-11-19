"use client";

/* Khung trang Admin: sidebar trái 240px (nền trắng) + topbar 56px + vùng nội dung co giãn. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen, BookOpenText, ChevronsUpDown, Frame, Crop, CreditCard, Disc3, ExternalLink, FileStack, Home, LayoutDashboard, LogOut,
  LayoutTemplate, Menu, Package, Phone, ShoppingBag, Star, Tag, Trash2, Truck, X, type LucideIcon,
  Sticker, Users, Share2,
} from "lucide-react";
import { adminGroups, activeAdminLink, isWorkspacePath } from "@/lib/adminLinks";
import { canAccess, type StaffRole } from "@/lib/roles";
import { toast } from "@/components/ui/kit";
import { createClient } from "@/lib/supabase/client";
import { AdminOverlays, btnClass, cx } from "./ui";

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, orders: ShoppingBag, package: Package, star: Star, home: Home,
  book: BookOpen, phone: Phone, disc: Disc3, strip: FileStack, trash: Trash2, card: CreditCard, tag: Tag, truck: Truck, layout: LayoutTemplate, book2: BookOpenText, crop: Crop, frame: Frame, sticker: Sticker, users: Users, share: Share2,
};

async function logout(router: ReturnType<typeof useRouter>) {
  await createClient().auth.signOut();
  router.replace("/admin/login");
  router.refresh();
}

function Sidebar({ email, role, onNavigate }: { email: string; role: StaffRole; onNavigate?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const active = activeAdminLink(path);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [menu]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#efeff1] px-5">
        <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#ff5fa2] text-[12px] font-bold text-white">T</span>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#18181b]">Taylana</span>
        <span className="rounded-[4px] border border-[#e5e5e7] px-1.5 text-[11px] font-medium text-[#71717a]">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {adminGroups.map((g) => ({ ...g, links: g.links.filter((l) => canAccess(role, l.href)) })).filter((g) => g.links.length).map((g) => (
          <div key={g.title} className="mb-4">
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#a1a1aa]">{g.title}</p>
            {g.links.map((l) => {
              const on = active?.href === l.href;
              const Icon = icons[l.icon] ?? LayoutDashboard;
              return (
                <Link key={l.href} href={l.href} onClick={onNavigate}
                  className={cx("relative flex h-8 items-center gap-2.5 rounded-[6px] px-2 text-[14px] transition-colors",
                    on ? "bg-[#fff0f6] font-medium text-[#ff5fa2]" : "text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#18181b]")}>
                  {on && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#ff5fa2]" />}
                  <Icon size={16} className={on ? "text-[#ff5fa2]" : "text-[#71717a]"} />
                  {l.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div ref={box} className="relative shrink-0 border-t border-[#efeff1] p-3">
        {menu && (
          <div className="absolute bottom-[calc(100%-4px)] left-3 right-3 z-10 rounded-[10px] border border-[#e5e5e7] bg-white p-1 shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
            <a href="/" target="_blank" rel="noreferrer" className="flex h-8 items-center gap-2 rounded-[6px] px-2 text-[14px] text-[#18181b] hover:bg-[#f4f4f5]">
              <ExternalLink size={16} className="text-[#71717a]" /> Xem trang web
            </a>
            <button onClick={() => logout(router)} className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-[14px] text-[#dc2626] hover:bg-[#fef2f2]">
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        )}
        <button onClick={() => setMenu(!menu)} className="flex w-full items-center gap-2.5 rounded-[8px] p-1.5 text-left hover:bg-[#f4f4f5]">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff0f6] text-[12px] font-semibold uppercase text-[#ff5fa2]">{email.slice(0, 1) || "A"}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[#3f3f46]">{email}</span>
          <ChevronsUpDown size={16} className="shrink-0 text-[#a1a1aa]" />
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ email, role = "admin", children }: { email: string; role?: StaffRole; children: React.ReactNode }) {
  const path = usePathname();
  // bị chuyển về do không có quyền (proxy / layout) → báo 1 lần
  useEffect(() => {
    const u = new URL(location.href);
    if (u.searchParams.get("khong-quyen")) { toast("Bạn không có quyền truy cập trang này", "err"); u.searchParams.delete("khong-quyen"); history.replaceState(null, "", u.pathname + u.search); }
  }, [path]);
  const [open, setOpen] = useState(false);
  const active = activeAdminLink(path);
  const crumbs = [active?.group, active && active.label !== active.group ? active.label : null,
    path.startsWith("/admin/don-hang/") ? "Chi tiết đơn" : path === "/admin/giam-gia/moi" ? "Tạo mới" : /^\/admin\/goi-san-pham\/.+/.test(path) || /^\/admin\/mockup\/.+/.test(path) ? "Chi tiết" : path.startsWith("/admin/giam-gia/") ? "Chi tiết" : null].filter(Boolean) as string[];
  const workspace = isWorkspacePath(path);

  return (
    <div className={cx("admin-ui", workspace ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      {/* sidebar máy tính */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-[#e5e5e7] bg-white md:block">
        <Sidebar email={email} role={role} />
      </aside>
      {/* sidebar điện thoại */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-white shadow-xl">
            <button className="absolute right-2 top-3 grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={16} /></button>
            <Sidebar email={email} role={role} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cx("flex flex-col md:pl-[240px]", workspace ? "h-dvh" : "min-h-dvh")}>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[#e5e5e7] bg-white px-4 md:px-6">
          <button className="grid h-8 w-8 place-items-center rounded-[6px] text-[#3f3f46] hover:bg-[#f4f4f5] md:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={16} /></button>
          <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px]" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <span className="text-[#d4d4d8]">/</span>}
                <span className={cx("truncate", i === crumbs.length - 1 ? "font-medium text-[#18181b]" : "text-[#71717a]")}>{c}</span>
              </span>
            ))}
          </nav>
          <a href="/" target="_blank" rel="noreferrer" className={btnClass("secondary", "sm")}>
            <span className="hidden sm:inline">Xem trang web</span> <ExternalLink size={16} />
          </a>
        </header>
        <main className={cx("min-w-0 flex-1", workspace && "flex min-h-0 flex-col overflow-y-auto")}>{children}</main>
      </div>
      <AdminOverlays />
    </div>
  );
}
