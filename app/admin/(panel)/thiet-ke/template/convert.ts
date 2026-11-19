"use client";
/* Chuyển mẫu cũ (sinh bằng code) thành mẫu CỐ ĐỊNH trong design_templates — chạy trên trình duyệt admin:
   · CD: 5 phong cách × 5–10 ảnh (ưu tiên bản admin đã sửa) + mẫu CD tạo mới trước đây (scrapbook_templates)
   · Booklet: các bộ mẫu cũ 4 / 8 / 12 trang (và bản đã sửa) → trang bìa / trang cuối = Trang đơn, từng cặp = Trang đôi (bỏ trùng)
   Mẫu được dựng lại bằng code cũ, đóng băng thành JSON (gồm sticker đang hiển thị), tạo ảnh thu nhỏ, lưu vào danh mục "Cơ bản".
   Chạy lại không tạo trùng (mỗi mẫu có mã nguồn config.legacy). */
import { createClient } from "@/lib/supabase/client";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { loadFrameImages } from "@/lib/scrapbook/frames";
import { mergeStickerCfg, setFrameLibrary, setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import { templatesFor } from "@/lib/scrapbook/templates";
import { resolveFrameSets } from "@/lib/scrapbook/generate";
import { BOOKLET_PAGES, generateBooklet } from "@/lib/scrapbook/booklet";
import { bookletOverride, bookletSettingOf } from "@/lib/scrapbook/catalog";
import { loadFonts } from "@/lib/scrapbook/render";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { slotCount, type TplKind } from "@/lib/scrapbook/library";
import { basicCategory, isMissing, MIGRATE_MSG, uploadThumb } from "@/lib/scrapbook/libraryClient";
import { normAsset } from "@/lib/scrapbook/assetGroups";
import { customizeText } from "@/components/scrapbook/useScrapStudio";
import { buildCdDoc } from "@/lib/scrapbook/toCdDoc";
import { MAX_PHOTOS, MIN_PHOTOS, STYLES, type CustomTemplate, type Frame, type FrameSet, type ScrapAsset, type Template, type TemplateSetting } from "@/lib/scrapbook/types";

const TEXT0 = { main: "Happy Birthday", sub: "" };
type Item = { legacy: string; name: string; kind: TplKind; template: Template };

async function context(stickerKey: string) {
  const sb = createClient();
  const [t, c, a, fs, fr, sc, sc0] = await Promise.all([
    sb.from("scrapbook_template_settings").select("*"), sb.from("scrapbook_templates").select("*"),
    sb.from("scrapbook_assets").select("*").eq("is_active", true).order("sort_order"),
    sb.from("frame_sets").select("*").eq("is_active", true).order("sort_order"), sb.from("frames").select("*").eq("is_active", true).order("sort_order"),
    sb.from("site_settings").select("value").eq("key", stickerKey).maybeSingle(), sb.from("site_settings").select("value").eq("key", "scrap_stickers").maybeSingle(),
  ]);
  setStickerConfig(mergeStickerCfg(((sc.data?.value ?? sc0.data?.value) as Partial<StickerCfg>) ?? null));
  const sets = (fs.data ?? []) as FrameSet[], frames = ((fr.data ?? []) as Frame[]).filter((x) => sets.some((s) => s.id === x.set_id));
  setFrameLibrary(sets);
  const assets = ((a.data ?? []) as ScrapAsset[]).map(normAsset).filter((x) => x.grp !== "frame" || !frames.length);
  await loadFonts();
  const [ai, fi] = await Promise.all([loadAssetImages(assets), loadFrameImages(frames)]);
  return { settings: (t.data ?? []) as TemplateSetting[], customs: (c.data ?? []) as CustomTemplate[], assets, frames, ro: { photos: samplePhotos(), text: TEXT0, assets: ai, frames: fi } };
}
/** đóng băng: chữ mẫu → chữ thường, khung "ngẫu nhiên từ bộ" → khung cụ thể, bỏ cờ tự rải, ô ảnh trống */
const freeze = (t: Template, frames: Frame[], seed: number): Template => {
  const c = customizeText(structuredClone(t), TEXT0);
  return { ...c, id: "", fixed: true, layers: resolveFrameSets(c.layers, frames, seed).map((l) => { const { auto: _a, user: _u, ...rest } = l as typeof l & { auto?: boolean; user?: boolean }; void _a; void _u; return (rest.k === "photo" ? { ...rest, photo: undefined } : rest) as typeof l; }) };
};
const sig = (t: Template) => JSON.stringify({ s: t.surface, g: t.gutter, b: t.bg, b2: t.bg2, l: t.layers.map((l) => ({ ...l, seed: undefined })) });

async function save(items: Item[], ro: Parameters<typeof uploadThumb>[1], onProgress: (done: number, total: number) => void) {
  const sb = createClient();
  const { data: have, error } = await sb.from("design_templates").select("config").in("kind", [...new Set(items.map((i) => i.kind))]);
  if (error) throw new Error(isMissing(error.message) ? MIGRATE_MSG : error.message);
  const done = new Set((have ?? []).map((r) => (r.config as { legacy?: string } | null)?.legacy).filter(Boolean));
  const todo = items.filter((i) => !done.has(i.legacy));
  const cats: Record<string, string> = {};
  let n = 0, added = 0;
  onProgress(0, todo.length);
  for (const it of todo) {
    const cat = (cats[it.kind] ??= await basicCategory(it.kind));
    const thumb = await uploadThumb([it.template], ro).catch(() => null);
    const cdDoc = it.kind === "booklet_spread" ? undefined : await buildCdDoc(it.template, ro).catch(() => undefined);
    const r = await sb.from("design_templates").insert({ kind: it.kind, name: it.name, category_id: cat, config: { template: it.template, legacy: it.legacy, ...(cdDoc ? { cdDoc } : {}) }, photo_count: slotCount(it.template), thumbnail_url: thumb, is_active: true, sort_order: ++n });
    if (r.error) throw new Error(isMissing(r.error.message) ? MIGRATE_MSG : r.error.message);
    added++; onProgress(n, todo.length);
  }
  return { added, skipped: items.length - todo.length };
}

export async function convertLegacyCd(onProgress: (done: number, total: number) => void) {
  const { settings, customs, assets, frames, ro } = await context("scrap_stickers");
  const items: Item[] = [];
  for (let n = MIN_PHOTOS; n <= MAX_PHOTOS; n++) {
    const list = templatesFor(n, settings, assets, {}, true, frames);
    for (const s of STYLES) {
      const t = list.find((x) => x.style === s.id);
      const set = settings.find((x) => (x.surface_type ?? "disc") === "disc" && x.n === n && x.style === s.id);
      if (t) items.push({ legacy: `cd:${n}-${s.id}`, name: set?.name || `${s.name} · ${n} ảnh`, kind: "cd", template: freeze({ ...t, surface: "disc" }, frames, n) });
    }
  }
  for (const c of customs.filter((x) => x.surface === "disc")) {
    const t = c.config?.surfaces?.[0];
    if (t) items.push({ legacy: `cdc:${c.id}`, name: c.name, kind: "cd", template: freeze({ ...t, surface: "disc" }, frames, 7) });
  }
  return save(items, ro, onProgress);
}

export async function convertLegacyBooklet(onProgress: (done: number, total: number) => void) {
  const { settings, customs, assets, frames, ro } = await context("scrap_stickers_booklet");
  const spread = settings.filter((s) => s.surface_type === "spread");
  const sets: { key: string; name: string; surfaces: Template[] }[] = [];
  for (const pages of BOOKLET_PAGES) for (const s of STYLES) {
    const set = bookletSettingOf(settings, pages, s.id);
    sets.push({ key: `${pages}-${s.id}`, name: s.name, surfaces: bookletOverride(set) ?? generateBooklet(pages, s.id, set.seed, assets, frames, spread).surfaces });
  }
  for (const c of customs.filter((x) => x.surface === "booklet")) sets.push({ key: `c${c.id}`, name: c.name, surfaces: c.config?.surfaces ?? [] });
  const items: Item[] = [], seen = new Set<string>();
  let ns = 0, nd = 0;
  for (const b of sets) b.surfaces.forEach((t, i) => {
    const kind: TplKind = t.surface === "spread" ? "booklet_spread" : "booklet_single";
    // ô ảnh đánh số lại từ 0 trong từng trang (mẫu dùng độc lập)
    const slots = [...new Set(t.layers.flatMap((l) => (l.k === "photo" ? [l.slot] : [])))].sort((a, z) => a - z);
    const local: Template = { ...t, layers: t.layers.map((l) => (l.k === "photo" ? { ...l, slot: slots.indexOf(l.slot) } : l)) };
    const f = freeze(kind === "booklet_single" ? { ...local, gutter: "left" } : local, frames, i + 3);
    const k = sig(f);
    if (seen.has(k)) return;
    seen.add(k);
    const label = kind === "booklet_single" ? (i === 0 ? "bìa" : "trang cuối") : `cặp ${i}`;
    items.push({ legacy: `bk:${b.key}:${i}`, name: `${b.name} · ${label}`, kind, template: f });
    if (kind === "booklet_single") ns++; else nd++;
  });
  const r = await save(items, ro, onProgress);
  return { ...r, singles: ns, spreads: nd };
}
