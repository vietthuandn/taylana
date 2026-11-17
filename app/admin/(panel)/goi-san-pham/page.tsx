import { CatalogEditor } from "@/components/admin/CatalogEditor";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default function PackagesAdmin() {
  return (
    <AdminPage>
      <PageHeader title="Gói & phụ kiện" description="Gói sản phẩm và phụ kiện mua kèm hiện trên trang Đặt đơn. Dùng mũi tên ↑↓ để đổi thứ tự." />
      <div className="space-y-8">
        <CatalogEditor table="packages" title="Gói sản phẩm" withFeatures />
        <CatalogEditor table="addons" title="Phụ kiện mua kèm" />
      </div>
    </AdminPage>
  );
}
