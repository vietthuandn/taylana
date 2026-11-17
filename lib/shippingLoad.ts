import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { mergeShipping } from "./shipping";

export async function getShippingSettings() {
  const sb = publicClient();
  if (!sb) return mergeShipping(null);
  const { data } = await sb.from("site_settings").select("value").eq("key", "shipping").maybeSingle();
  return mergeShipping(data?.value);
}
