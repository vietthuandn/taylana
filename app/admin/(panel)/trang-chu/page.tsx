import { loadAdminSettings } from "@/lib/adminSettings";
import { HomeForm } from "./HomeForm";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default async function HomeAdminPage() {
  const { home, options } = await loadAdminSettings();
  return (
    <AdminPage wide>
      <PageHeader title="Trang chủ" />
      <HomeForm initialHome={home} initialOptions={options} />
    </AdminPage>
  );
}
