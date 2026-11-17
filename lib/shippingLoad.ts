import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { mergeShipping, type ShippingTier } from "./shipping";

export async function getShippingSettings() {
  const sb = publicClient();
  if (!sb) return mergeShipping(null);
  const [s, t] = await Promise.all([
    sb.from("site_settings").select("value").eq("key", "shipping").maybeSingle(),
    sb.from("shipping_tiers").select("id, min_amount, percent").order("min_amount"),
  ]);
  let tiers = (t.error ? [] : t.data ?? []) as ShippingTier[];
  // chưa chạy migration_products.sql: đổi cài đặt freeship cũ thành 1 bậc 100%
  const v = s.data?.value as { free_enabled?: boolean; free_threshold?: number } | undefined;
  if (t.error && v?.free_enabled) tiers = [{ min_amount: Number(v.free_threshold) || 0, percent: 100 }];
  return mergeShipping(s.data?.value, tiers);
}
