import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { DEFAULT_THEME, normalizeTheme, type Theme } from "./theme";

// Theme trang khách (đọc công khai, theo bộ nhớ đệm của từng trang — admin lưu thì làm mới toàn bộ)
export async function getTheme(): Promise<Theme> {
  const sb = publicClient();
  if (!sb) return DEFAULT_THEME;
  const { data } = await sb.from("site_settings").select("value").eq("key", "theme").maybeSingle();
  return normalizeTheme(data?.value);
}
