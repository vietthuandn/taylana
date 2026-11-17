import { getPaymentSettings } from "@/lib/payment/load";
import { PaymentView } from "./PaymentView";

export const metadata = { title: "Thanh toán", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const settings = await getPaymentSettings();
  return <PaymentView code={decodeURIComponent(code)} settings={settings} />;
}
