import { ShowcaseAdmin } from "./ShowcaseAdmin";
import { ReviewsAdmin } from "./ReviewsAdmin";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default function ProductsAdmin() {
  return (
    <AdminPage>
      <PageHeader title="Gallery" />
      <div className="space-y-8">
        <ShowcaseAdmin />
        <ReviewsAdmin />
      </div>
    </AdminPage>
  );
}
