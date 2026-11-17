import { publicClient } from "@/lib/supabase/public";
import type { PublicDiscount } from "@/lib/discount";
import { getCatalog } from "@/lib/catalogLoad";
import { getPaymentSettings } from "@/lib/payment/load";
import { paymentReady } from "@/lib/payment/settings";
import { getShippingSettings } from "@/lib/shippingLoad";
import { CartView } from "./CartView";

export const metadata = { title: "Giỏ hàng", robots: { index: false } };
// giá trong giỏ được làm mới mỗi lần mở
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const sb = publicClient();
  const [products, d, settings, shipping] = await Promise.all([
    getCatalog(sb),
    sb ? sb.rpc("get_public_discounts") : Promise.resolve({ data: [], error: null }),
    getPaymentSettings(),
    getShippingSettings(),
  ]);
  const discounts = (d.error ? [] : d.data ?? []) as PublicDiscount[];
  return <CartView products={products} discounts={discounts} shipping={shipping} payment={paymentReady(settings) ? settings : null} />;
}
