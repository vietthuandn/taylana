import "server-only";
import { requireAdmin } from "./admin";
import { defaultContact, defaultHome, mergeOptions } from "./settings";

// Đọc cài đặt trang chủ/liên hệ cho trang admin
export async function loadAdminSettings() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("key, value").in("key", ["home", "contact", "home_options"]);
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  return {
    home: { ...defaultHome, ...(get("home") ?? {}) },
    contact: { ...defaultContact, ...(get("contact") ?? {}) },
    options: mergeOptions(get("home_options")),
  };
}
