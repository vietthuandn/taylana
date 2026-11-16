import { CatalogEditor } from "@/components/admin/CatalogEditor";

export default function PackagesAdmin() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-3xl">Gói sản phẩm & phụ kiện</h1>
      <p className="mb-6 text-sm text-cocoa-500">Dùng mũi tên ↑↓ để đổi thứ tự hiển thị trên trang Đặt đơn.</p>
      <CatalogEditor table="packages" title="Gói sản phẩm" withFeatures />
      <CatalogEditor table="addons" title="Phụ kiện mua kèm" />
    </div>
  );
}
