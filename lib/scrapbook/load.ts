import "server-only";
import { publicClient } from "@/lib/supabase/public";
import type { CustomTemplate, Frame, FrameSet, ScrapAsset, TemplateSetting, Wish, WishTopic } from "./types";
import type { CutoutFont, Glyph } from "./cutout";
import { mergeStickerCfg, type StickerCfg } from "./decor";

export type ScrapbookData = { assets: ScrapAsset[]; settings: TemplateSetting[]; fonts: CutoutFont[]; glyphs: Glyph[]; frames: Frame[]; frameSets: FrameSet[]; topics: WishTopic[]; wishes: Wish[]; stickerCfg: StickerCfg; stickerCfgBooklet: StickerCfg; customs: CustomTemplate[] };
// Chất liệu + cài đặt mẫu + khung ảnh + lời chúc đang bật (chưa chạy migration → rỗng, trang tự dùng bộ mặc định)
export async function getScrapbookData(): Promise<ScrapbookData> {
  const sb = publicClient();
  const empty: ScrapbookData = { assets: [], settings: [], fonts: [], glyphs: [], frames: [], frameSets: [], topics: [], wishes: [], stickerCfg: mergeStickerCfg(null), stickerCfgBooklet: mergeStickerCfg(null), customs: [] };
  if (!sb) return empty;
  const [a, t, f, fs, fr, wt, w, sc, sb2, ct] = await Promise.all([
    sb.from("scrapbook_assets").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("scrapbook_template_settings").select("*"),
    sb.from("cutout_fonts").select("*").eq("is_active", true).order("sort_order"),
    sb.from("frame_sets").select("*").eq("is_active", true).order("sort_order"),
    sb.from("frames").select("*").eq("is_active", true).order("sort_order"),
    sb.from("wish_topics").select("*").eq("is_active", true).order("sort_order"),
    sb.from("wishes").select("*").eq("is_active", true).order("sort_order"),
    sb.from("site_settings").select("value").eq("key", "scrap_stickers").maybeSingle(),
    sb.from("site_settings").select("value").eq("key", "scrap_stickers_booklet").maybeSingle(),
    sb.from("scrapbook_templates").select("*").eq("is_active", true).order("sort_order").order("created_at"), // chưa chạy migration → lỗi → rỗng
  ]);
  // font cut-out đang bật + các mảnh chữ (chưa chạy migration → rỗng)
  const fonts = (f.data ?? []) as CutoutFont[];
  const g = fonts.length ? await sb.from("cutout_glyphs").select("*").in("font_id", fonts.map((x) => x.id)).order("sort_order") : { data: [] };
  const frameSets = (fs.data ?? []) as FrameSet[];
  const frames = ((fr.data ?? []) as Frame[]).filter((x) => frameSets.some((s) => s.id === x.set_id));
  return {
    assets: ((a.data ?? []) as ScrapAsset[]).filter((x) => x.grp !== "frame" || !frames.length), // khung cũ đã chuyển sang thư viện Khung ảnh
    settings: (t.data ?? []) as TemplateSetting[], fonts, glyphs: (g.data ?? []) as Glyph[], frames, frameSets,
    topics: (wt.data ?? []) as WishTopic[], wishes: (w.data ?? []) as Wish[], stickerCfg: mergeStickerCfg((sc.data?.value as Partial<StickerCfg>) ?? null),
    // Booklet chưa có cài đặt riêng → dùng chung cài đặt của CD
    stickerCfgBooklet: mergeStickerCfg(((sb2.data?.value ?? sc.data?.value) as Partial<StickerCfg>) ?? null),
    customs: (ct.data ?? []) as CustomTemplate[],
  };
}
