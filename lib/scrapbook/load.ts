import "server-only";
import { publicClient } from "@/lib/supabase/public";
import type { ScrapAsset, TemplateSetting } from "./types";
import type { CutoutFont, Glyph } from "./cutout";

// Chất liệu + cài đặt mẫu đang bật (chưa chạy migration → rỗng, trang tự dùng bộ mặc định vẽ bằng code)
export async function getScrapbookData() {
  const sb = publicClient();
  if (!sb) return { assets: [] as ScrapAsset[], settings: [] as TemplateSetting[], fonts: [] as CutoutFont[], glyphs: [] as Glyph[] };
  const [a, t, f] = await Promise.all([
    sb.from("scrapbook_assets").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("scrapbook_template_settings").select("*"),
    sb.from("cutout_fonts").select("*").eq("is_active", true).order("sort_order"),
  ]);
  // font cut-out đang bật + các mảnh chữ (chưa chạy migration → rỗng)
  const fonts = (f.data ?? []) as CutoutFont[];
  const g = fonts.length ? await sb.from("cutout_glyphs").select("*").in("font_id", fonts.map((x) => x.id)).order("sort_order") : { data: [] };
  return { assets: (a.data ?? []) as ScrapAsset[], settings: (t.data ?? []) as TemplateSetting[], fonts, glyphs: (g.data ?? []) as Glyph[] };
}
