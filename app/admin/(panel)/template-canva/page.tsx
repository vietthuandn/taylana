import { AdminPage, PageHeader } from "@/components/admin/ui";
import { CanvaAdmin } from "./CanvaAdmin";

// Admin → Template Canva: danh sách template (thẻ "Thiết kế từ Canva Template" ở trang Thiết Kế) + cài đặt nút
export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Template Canva" />
      <CanvaAdmin />
    </AdminPage>
  );
}
