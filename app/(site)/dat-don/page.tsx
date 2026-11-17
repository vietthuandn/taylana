import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { Addon, Package } from "@/lib/types";
import { FEATURE_PHOTOSTRIP, isPhotostripItem } from "@/lib/features";
import { getPaymentSettings } from "@/lib/payment/load";
import { paymentReady } from "@/lib/payment/settings";
import { OrderForm } from "./OrderForm";

export const metadata = { title: "Đặt đơn" };
export const revalidate = 60;

export default async function OrderPage() {
  const sb = publicClient();
  let packages: Package[] = [];
  let addons: Addon[] = [];
  if (sb) {
    const [p, a] = await Promise.all([
      sb.from("packages").select("*").eq("is_active", true).order("sort_order").order("created_at"),
      sb.from("addons").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    ]);
    packages = p.data ?? [];
    addons = (a.data ?? []).filter((x: Addon) => FEATURE_PHOTOSTRIP || !isPhotostripItem(x.name));
  }

  const pay = paymentReady(await getPaymentSettings());
  return (
    <>
      <Suspense>
        <OrderForm packages={packages} addons={addons} payment={pay} />
      </Suspense>
    </>
  );
}
