import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ShippingForm } from "./ShippingForm";

export default function ShippingAdminPage() {
  return (
    <AdminPage>
      <PageHeader title="Vận chuyển" />
      <ShippingForm />
    </AdminPage>
  );
}
