import "server-only";
import { publicClient } from "@/lib/supabase/public";
import type { AssetGroupRow, CustomTemplate, Frame, FrameSet, ScrapAsset, TemplateSetting, Wish, WishTopic } from "./types";
import { normAsset } from "./assetGroups";
import type { CutoutFont, Glyph } from "./cutout";
import { mergeStickerCfg, type StickerCfg } from "./decor";
import { TPL_COLS, type Library, type TplKind, type CategoryScope } from "./library";

export type ScrapbookData = { assets: ScrapAsset[]; settings: TemplateSetting[]; fonts: CutoutFont[]; glyphs: Glyph[]; frames: Frame[]; frameSets: FrameSet[]; topics: WishTopic[]; wishes: Wish[]; stickerCfg: StickerCfg; stickerCfgBooklet: StickerCfg; customs: CustomTemplate[]; groups: AssetGroupRow[] };
// Chất liệu + cài đặt mẫu + khung ảnh + lời chúc đang bật (chưa chạy migration → rỗng, trang tự dùng bộ mặc định)
export async function getScrapbookData(): Promise<ScrapbookData> {
  const sb = publicClient();
  const empty: ScrapbookData = { assets: [], settings: [], fonts: [], glyphs: [], frames: [], frameSets: [], topics: [], wishes: [], stickerCfg: mergeStickerCfg(null), stickerCfgBooklet: mergeStickerCfg(null), customs: [], groups: [] };
  if (!sb) return empty;
  const [a, t, f, fs, fr, wt, w, sc, sb2, ct, ag] = await Promise.all([
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
    sb.from("asset_groups").select("*").order("sort_order").order("name"),
  ]);
  // font cut-out đang bật + các mảnh chữ (chưa chạy migration → rỗng)
  const fonts = (f.data ?? []) as CutoutFont[];
  const g = fonts.length ? await sb.from("cutout_glyphs").select("*").in("font_id", fonts.map((x) => x.id)).order("sort_order") : { data: [] };
  const frameSets = (fs.data ?? []) as FrameSet[];
  const frames = ((fr.data ?? []) as Frame[]).filter((x) => frameSets.some((s) => s.id === x.set_id));
  return {
    assets: ((a.data ?? []) as ScrapAsset[]).map(normAsset).filter((x) => x.grp !== "frame" || !frames.length), // khung cũ đã chuyển sang thư viện Khung ảnh
    settings: (t.data ?? []) as TemplateSetting[], fonts, glyphs: (g.data ?? []) as Glyph[], frames, frameSets,
    topics: (wt.data ?? []) as WishTopic[], wishes: (w.data ?? []) as Wish[], stickerCfg: mergeStickerCfg((sc.data?.value as Partial<StickerCfg>) ?? null),
    // Booklet chưa có cài đặt riêng → dùng chung cài đặt của CD
    stickerCfgBooklet: mergeStickerCfg(((sb2.data?.value ?? sc.data?.value) as Partial<StickerCfg>) ?? null),
    customs: (ct.data ?? []) as CustomTemplate[],
    groups: (ag.data ?? []) as AssetGroupRow[],
  };
}

/** thư viện mẫu cố định đang bật (khách): danh mục + mẫu theo loại + bộ booklet (chưa chạy migration → rỗng) */
export async function getLibrary(kinds: TplKind[], bundles = false): Promise<Library> {
  const sb = publicClient();
  const empty: Library = { categories: [], templates: [], bundles: [] };
  if (!sb) return empty;
  const scopes: CategoryScope[] = [...kinds, ...(bundles ? ["booklet_bundle" as const] : [])];
  const [c, t, b] = await Promise.all([
    sb.from("template_categories").select("*").in("scope", scopes).eq("is_active", true).order("sort_order"),
    sb.from("design_templates").select(TPL_COLS).in("kind", kinds).eq("is_active", true).order("sort_order"),
    bundles ? sb.from("booklet_bundles").select("*").eq("is_active", true).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  return { categories: (c.data ?? []) as Library["categories"], templates: (t.data ?? []) as unknown as Library["templates"], bundles: (b.data ?? []) as Library["bundles"] };
}
