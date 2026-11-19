import { AdminPage, PageHeader } from "@/components/admin/ui";
import { SharesAdmin } from "./SharesAdmin";

// Admin → Link chia sẻ: các link xem mockup còn hạn (tạo ở trang Xem Mockup → "Chia sẻ")
export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Link chia sẻ" />
      <SharesAdmin />
    </AdminPage>
  );
}
