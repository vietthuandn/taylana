import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { Addon, Package } from "@/lib/types";
import type { PublicDiscount } from "@/lib/discount";
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
  let discounts: PublicDiscount[] = [];
  if (sb) {
    const [p, a, d] = await Promise.all([
      sb.from("packages").select("*").eq("is_active", true).order("sort_order").order("created_at"),
      sb.from("addons").select("*").eq("is_active", true).order("sort_order").order("created_at"),
      sb.rpc("get_public_discounts"), // chương trình toàn shop đang hiệu lực (lỗi = chưa chạy migration → bỏ qua)
    ]);
    packages = p.data ?? [];
    addons = (a.data ?? []).filter((x: Addon) => FEATURE_PHOTOSTRIP || !isPhotostripItem(x.name));
    discounts = (d.error ? [] : d.data ?? []) as PublicDiscount[];
  }

  const settings = await getPaymentSettings();
  return (
    <Suspense>
      <OrderForm packages={packages} addons={addons} discounts={discounts} payment={paymentReady(settings) ? settings : null} />
    </Suspense>
  );
}
