import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { mergePayment } from "./settings";

export async function getPaymentSettings() {
  const sb = publicClient();
  if (!sb) return mergePayment(null);
  const { data } = await sb.from("site_settings").select("value").eq("key", "payment").maybeSingle();
  return mergePayment(data?.value);
}
