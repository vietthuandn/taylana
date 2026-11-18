import { AdminPage, PageHeader } from "@/components/admin/ui";
import { MockupAdmin } from "./MockupAdmin";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Mẫu mockup" description="Khung CD (tối đa 5 mẫu) và nền của tiệm cho trang Xem Mockup. Ảnh của khách không bao giờ được tải lên." />
      <MockupAdmin />
    </AdminPage>
  );
}
