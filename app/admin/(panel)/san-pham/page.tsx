import { ShowcaseAdmin } from "./ShowcaseAdmin";
import { ReviewsAdmin } from "./ReviewsAdmin";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default function ProductsAdmin() {
  return (
    <AdminPage>
      <PageHeader title="Gallery" description="Ảnh sản phẩm tiệm đã làm, hiện ở trang Về chúng tôi. Phần Đánh giá đang tạm ẩn với khách (dữ liệu vẫn giữ)." />
      <div className="space-y-8">
        <ShowcaseAdmin />
        <ReviewsAdmin />
      </div>
    </AdminPage>
  );
}
