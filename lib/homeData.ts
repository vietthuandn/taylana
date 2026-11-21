import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { getSettings, type HomeOption, type HomeSettings } from "@/lib/settings";
import { itemsFromOptions, normalizeDesignPage, normalizeItems, type DesignPage, type TileItem } from "@/lib/tileItems";

// Dữ liệu CHUNG cho mọi mẫu trang chủ (Admin → Trang chủ: banner, 6 ô) + dữ liệu riêng của mẫu (variant_settings[id])
export type HomeVariantProps = { home: HomeSettings; options: HomeOption[]; items: TileItem[]; settings: Record<string, unknown> };

export const DEFAULT_HOME_VARIANT = "v1-hien-tai";

// Lấy dữ liệu trang chủ — dùng cho mọi mẫu (xem docs/HOME_VARIANTS.md)
export async function getHomeData(variantId: string): Promise<HomeVariantProps> {
  const { home, options } = await getSettings();
  const [all, items] = await Promise.all([getVariantSettings(), getSetting("home_items")]);
  return { home, options, items: normalizeItems(items, itemsFromOptions(options)), settings: (all[variantId] as Record<string, unknown>) ?? {} };
}

async function getSetting(key: string): Promise<unknown> {
  const sb = publicClient();
  if (!sb) return undefined;
  const { data } = await sb.from("site_settings").select("value").eq("key", key).maybeSingle();
  return data?.value;
}

// Trang /thiet-ke: mẫu đang dùng + các mục (Admin → Giao diện → Thiết kế)
export async function getDesignPage(): Promise<DesignPage> {
  return normalizeDesignPage(await getSetting("design_page"));
}

// Mẫu đang dùng (site_settings.active_home_variant)
export async function getActiveHomeVariant(): Promise<string> {
  const sb = publicClient();
  if (!sb) return DEFAULT_HOME_VARIANT;
  const { data } = await sb.from("site_settings").select("value").eq("key", "active_home_variant").maybeSingle();
  return typeof data?.value === "string" && data.value ? data.value : DEFAULT_HOME_VARIANT;
}

// Dữ liệu riêng theo mẫu: site_settings.variant_settings = { "<id mẫu>": { ... } }
async function getVariantSettings(): Promise<Record<string, unknown>> {
  const sb = publicClient();
  if (!sb) return {};
  const { data } = await sb.from("site_settings").select("value").eq("key", "variant_settings").maybeSingle();
  return data?.value && typeof data.value === "object" ? (data.value as Record<string, unknown>) : {};
}
