import { requireAdmin } from "@/lib/admin";
import { mergePayment } from "@/lib/payment/settings";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { PaymentForm } from "./PaymentForm";

export default async function PaymentAdminPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "payment").maybeSingle();
  return (
    <AdminPage>
      <PageHeader title="Thanh toán" />
      <PaymentForm initial={mergePayment(data?.value)} />
    </AdminPage>
  );
}
