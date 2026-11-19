import { AdminPage } from "@/components/admin/ui";
import { TemplateTabs } from "../Tabs";
import { CanvaAdmin } from "../../../template-canva/CanvaAdmin";

// Template Canva: danh sách template (thẻ "Thiết kế từ Canva Template" ở trang Thiết Kế) + cài đặt nút
export default function Page() {
  return (
    <AdminPage wide>
      <TemplateTabs tab="canva" />
      <CanvaAdmin />
    </AdminPage>
  );
}
