import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { StaffAdmin } from "./StaffAdmin";
import { CustomersAdmin } from "./CustomersAdmin";

// Admin → Hệ thống → Quản lý tài khoản (chỉ quản trị viên — Nhà thiết kế bị chặn ở proxy + layout + API + RLS)
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "khach-hang" ? "khach-hang" : "nhan-su";
  return (
    <AdminPage>
      <PageHeader title="Quản lý tài khoản" />
      <div className="mb-6"><ResponsiveTabs value={tab} tabs={[{ id: "nhan-su", label: "Nhân sự", href: "/admin/tai-khoan" }, { id: "khach-hang", label: "Khách hàng", href: "/admin/tai-khoan?tab=khach-hang" }]} /></div>
      {tab === "khach-hang" ? <CustomersAdmin /> : <StaffAdmin />}
    </AdminPage>
  );
}
