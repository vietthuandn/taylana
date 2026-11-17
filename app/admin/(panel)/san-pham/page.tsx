import { ShowcaseAdmin } from "./ShowcaseAdmin";
import { ReviewsAdmin } from "./ReviewsAdmin";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default function ProductsAdmin() {
  return (
    <AdminPage>
      <PageHeader title="Sản phẩm & đánh giá" description="Ảnh sản phẩm tiệm đã làm và đánh giá của khách, hiện ở trang Sản phẩm." />
      <div className="space-y-8">
        <ShowcaseAdmin />
        <ReviewsAdmin />
      </div>
    </AdminPage>
  );
}
