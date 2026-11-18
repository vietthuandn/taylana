import "server-only";
import { publicClient } from "@/lib/supabase/public";
import type { ScrapAsset, TemplateSetting } from "./types";

// Chất liệu + cài đặt mẫu đang bật (chưa chạy migration → rỗng, trang tự dùng bộ mặc định vẽ bằng code)
export async function getScrapbookData() {
  const sb = publicClient();
  if (!sb) return { assets: [] as ScrapAsset[], settings: [] as TemplateSetting[] };
  const [a, t] = await Promise.all([
    sb.from("scrapbook_assets").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("scrapbook_template_settings").select("*"),
  ]);
  return { assets: (a.data ?? []) as ScrapAsset[], settings: (t.data ?? []) as TemplateSetting[] };
}
