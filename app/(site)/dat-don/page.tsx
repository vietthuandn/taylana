import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { PublicDiscount } from "@/lib/discount";
import { getCatalog } from "@/lib/catalogLoad";
import { getPaymentSettings } from "@/lib/payment/load";
import { paymentReady } from "@/lib/payment/settings";
import { getShippingSettings } from "@/lib/shippingLoad";
import { OrderForm } from "./OrderForm";

export const metadata = { title: "Đặt đơn" };
export const revalidate = 60;

export default async function OrderPage() {
  const sb = publicClient();
  const [products, d, settings, shipping] = await Promise.all([
    getCatalog(sb),
    sb ? sb.rpc("get_public_discounts") : Promise.resolve({ data: [], error: null }),
    getPaymentSettings(),
    getShippingSettings(),
  ]);
  const discounts = (d.error ? [] : d.data ?? []) as PublicDiscount[];
  return (
    <Suspense>
      <OrderForm products={products} discounts={discounts} shipping={shipping} payment={paymentReady(settings) ? settings : null} />
    </Suspense>
  );
}
