import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin";
import { canAccess } from "@/lib/roles";
import { AdminShell } from "@/components/admin/AdminShell";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const metadata: Metadata = { title: "Quản trị", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireStaff();

  if (!role) {
    return (
      <main className="admin-ui grid min-h-dvh place-items-center px-4 text-center">
        <div className="w-full max-w-sm rounded-[12px] border border-[#e5e5e7] bg-white p-6">
          <h1>Tài khoản không có quyền quản trị</h1>
          <p className="mt-1 text-[13px] text-[#71717a]">{user.email}</p>
          <div className="mt-4 flex justify-center"><LogoutButton /></div>
        </div>
      </main>
    );
  }

  // kiểm tra quyền lần 2 ở server (đường dẫn do proxy truyền qua header)
  const path = (await headers()).get("x-pathname") ?? "/admin";
  if (!canAccess(role, path)) redirect("/admin?khong-quyen=1");
  return <AdminShell email={user.email ?? ""} role={role}>{children}</AdminShell>;
}
