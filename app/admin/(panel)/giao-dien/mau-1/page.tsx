import { ArrowLeft } from "lucide-react";
import { loadAdminSettings } from "@/lib/adminSettings";
import { HomeForm } from "./HomeForm";
import { AdminPage, Button, PageHeader } from "@/components/admin/ui";

// Giao diện trang chủ → Mẫu 1 · Hiện tại → Chỉnh sửa (banner, 6 ô…) — trước đây là menu "Trang chủ"
export default async function HomeAdminPage() {
  const { home, options } = await loadAdminSettings();
  return (
    <AdminPage wide>
      <PageHeader title="Chỉnh sửa Mẫu 1 · Hiện tại" actions={<Button variant="secondary" size="sm" href="/admin/giao-dien" icon={<ArrowLeft size={16} />}>Giao diện</Button>} />
      <HomeForm initialHome={home} initialOptions={options} />
    </AdminPage>
  );
}
