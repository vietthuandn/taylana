import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { DEFAULT_STATUS, normalizeStatus, type StatusKind, type StatusPage } from "./statusPages";

async function get(key: string) {
  const sb = publicClient();
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
