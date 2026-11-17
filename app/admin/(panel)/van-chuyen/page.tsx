import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ShippingForm } from "./ShippingForm";

export default function ShippingAdminPage() {
  return (
    <AdminPage>
      <PageHeader title="Vận chuyển" description="Phí ship mặc định và ưu đãi theo giá trị đơn. Server tính lại khi khách đặt hàng." />
      <ShippingForm />
    </AdminPage>
  );
}
