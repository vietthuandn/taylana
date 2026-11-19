import { AdminPage } from "@/components/admin/ui";
import { TemplateTabs } from "../Tabs";
import { MockupAdmin } from "../../../mockup/MockupAdmin";

// Mockup: ảnh nền shop + cài đặt Lên mockup (chuyển từ "Mẫu mockup" cũ — dữ liệu, code giữ nguyên)
export default function Page() {
  return (
    <AdminPage wide>
      <TemplateTabs tab="mockup" />
      <MockupAdmin />
    </AdminPage>
  );
}
