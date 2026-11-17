import { CatalogEditor } from "@/components/admin/CatalogEditor";
import { ShippingCard } from "@/components/admin/ShippingCard";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default function PackagesAdmin() {
  return (
    <AdminPage>
      <PageHeader title="Gói & phụ kiện" description="Gói sản phẩm, phụ kiện mua kèm và phí vận chuyển của trang Đặt đơn. Dùng mũi tên ↑↓ để đổi thứ tự." />
      <div className="space-y-8">
        <CatalogEditor table="packages" title="Gói sản phẩm" withFeatures />
        <CatalogEditor table="addons" title="Phụ kiện mua kèm" />
        <ShippingCard />
      </div>
    </AdminPage>
  );
}
