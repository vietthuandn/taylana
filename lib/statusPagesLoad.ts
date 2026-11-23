import "server-only";
import { createClient } from "@supabase/supabase-js";
import { hasSupabase, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { DEFAULT_STATUS, normalizeStatus, type StatusKind, type StatusPage } from "./statusPages";

// đọc thẳng database, KHÔNG dùng bộ nhớ đệm (bật / tắt "Tạm nghỉ bán", "Yêu cầu mã" phải có tác dụng ngay)
const fresh = () => (hasSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) } }) : null);
async function get(key: string) {
  const sb = fresh();
  if (!sb) return undefined;
  const { data } = await sb.from("site_settings").select("value").eq("key", key).maybeSingle();
  return data?.value;
}
export async function getStatusPage(kind: StatusKind): Promise<StatusPage> {
  try { return normalizeStatus(await get("status_pages"))[kind]; } catch { return DEFAULT_STATUS[kind]; }
}
/** "Yêu cầu số điện thoại / mã đơn hàng" ở trang Thiết kế đang bật? (Giao diện → Thiết kế) */
export async function isDesignGated() {
  try { return (await get("design_gate")) === true; } catch { return false; }
}
/** "Tạm nghỉ bán" đang bật? (Sản phẩm của tôi) */
export async function isShopPaused() {
  try { return (await get("shop_paused")) === true; } catch { return false; }
}
