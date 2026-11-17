import { publicClient } from "@/lib/supabase/public";
import type { Addon, Package } from "@/lib/types";
import type { PublicDiscount } from "@/lib/discount";
import { FEATURE_PHOTOSTRIP, isPhotostripItem } from "@/lib/features";
import { getPaymentSettings } from "@/lib/payment/load";
import { paymentReady } from "@/lib/payment/settings";
import { CartView } from "./CartView";

export const metadata = { title: "Giỏ hàng", robots: { index: false } };
// giá trong giỏ được làm mới mỗi lần mở
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const sb = publicClient();
  let packages: Package[] = [];
  let addons: Addon[] = [];
  let discounts: PublicDiscount[] = [];
  if (sb) {
    const [p, a, d] = await Promise.all([
      sb.from("packages").select("*").eq("is_active", true).order("sort_order"),
      sb.from("addons").select("*").eq("is_active", true).order("sort_order"),
      sb.rpc("get_public_discounts"),
    ]);
    packages = p.data ?? [];
    addons = (a.data ?? []).filter((x: Addon) => FEATURE_PHOTOSTRIP || !isPhotostripItem(x.name));
    discounts = (d.error ? [] : d.data ?? []) as PublicDiscount[];
  }
  const settings = await getPaymentSettings();
  return <CartView packages={packages} addons={addons} discounts={discounts} payment={paymentReady(settings) ? settings : null} />;
}
