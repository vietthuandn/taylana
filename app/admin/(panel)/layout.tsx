import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const metadata: Metadata = { title: "Quản trị", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await requireAdmin();

  if (!isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        <div className="pop rounded-[2rem] bg-cream-50 px-6 py-8">
          <h1 className="text-2xl">Tài khoản không có quyền quản trị</h1>
          <p className="mt-2 text-sm text-cocoa-500">{user.email}</p>
          <div className="mt-4"><LogoutButton /></div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[230px_1fr]">
      <aside className="border-b-2 border-cocoa-700 bg-pink-200 md:min-h-dvh md:border-b-0 md:border-r-2">
        <div className="flex items-center justify-between px-4 py-3 md:block">
          <p className="font-display text-2xl">Taylana Admin</p>
          <p className="hidden truncate text-xs text-cocoa-500 md:block">{user.email}</p>
        </div>
        <AdminNav />
        <div className="hidden px-4 py-4 md:block"><LogoutButton /></div>
      </aside>
      <main className="px-4 py-6 md:px-8">
        {children}
        <div className="mt-10 md:hidden"><LogoutButton /></div>
      </main>
    </div>
  );
}
