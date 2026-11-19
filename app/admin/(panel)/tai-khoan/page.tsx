import { AdminPage, PageHeader } from "@/components/admin/ui";
import { StaffAdmin } from "./StaffAdmin";

// Admin → Hệ thống → Quản lý tài khoản (chỉ quản trị viên — Nhà thiết kế bị chặn ở proxy + layout + API + RLS)
export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Quản lý tài khoản" />
      <StaffAdmin />
    </AdminPage>
  );
}
