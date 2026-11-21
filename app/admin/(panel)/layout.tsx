import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin";
import { canAccess } from "@/lib/roles";
import { AdminShell } from "@/components/admin/AdminShell";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { getStatusPage } from "@/lib/statusPagesLoad";
import { StatusView } from "@/components/site/StatusView";

export const metadata: Metadata = { title: "Quản trị", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireStaff();

  if (!role) {
    // 403 (trang hệ thống — không có header). Nội dung chỉnh ở Admin → Giao diện → Khác.
    return (
      <div className="relative">
        <StatusView page={await getStatusPage("forbidden")} full />
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 text-[13px] text-[#71717a]">{user.email}<LogoutButton /></div>
      </div>
    );
  }

  // kiểm tra quyền lần 2 ở server (đường dẫn do proxy truyền qua header)
  const path = (await headers()).get("x-pathname") ?? "/admin";
  if (!canAccess(role, path)) redirect("/admin?khong-quyen=1");
  return <AdminShell email={user.email ?? ""} role={role}>{children}</AdminShell>;
}
