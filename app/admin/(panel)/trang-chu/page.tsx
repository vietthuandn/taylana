import { loadAdminSettings } from "@/lib/adminSettings";
import { HomeForm } from "./HomeForm";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default async function HomeAdminPage() {
  const { home, options } = await loadAdminSettings();
  return (
    <AdminPage wide>
      <PageHeader title="Trang chủ" description="Banner chỉ hiện trên máy tính (từ 768px). 6 ô menu hiện ở mọi thiết bị." />
      <HomeForm initialHome={home} initialOptions={options} />
    </AdminPage>
  );
}
