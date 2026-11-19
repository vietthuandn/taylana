/* Danh mục mẫu CD / Booklet Scrapbook = mẫu tự tạo bằng code (5 phong cách × số ảnh / số trang, bật tắt + tên + thứ tự lưu ở
   scrapbook_template_settings) + mẫu admin tạo mới / nhân bản (scrapbook_templates). Dùng chung cho trang khách và admin. */
import { BOOKLET_PAGES, bookletSeed, generateBooklet, type BookletSet } from "./booklet";
import { resolveFrameSets } from "./generate";
import { settingOf, templatesFor } from "./templates";
import { MAX_PHOTOS, MIN_PHOTOS, STYLES, type CustomTemplate, type Frame, type ScrapAsset, type Style, type Template, type TemplateSetting } from "./types";

export type CatalogItem = {
  key: string; kind: "gen" | "custom"; surface: "disc" | "booklet"; n: number; style: Style; name: string; active: boolean; sort: number;
  edited: boolean; setting?: TemplateSetting; custom?: CustomTemplate;
};
const styleName = (s: Style) => STYLES.find((x) => x.id === s)?.name ?? s;
const idx = (s: Style) => STYLES.findIndex((x) => x.id === s);
export const photoCountOf = (surfaces: Template[]) => new Set(surfaces.flatMap((t) => t.layers.flatMap((l) => (l.k === "photo" ? [l.slot] : [])))).size;

export function bookletSettingOf(settings: TemplateSetting[], pages: number, style: Style): TemplateSetting {
  return settings.find((s) => s.surface_type === "booklet" && s.n === pages && s.style === style) ?? { n: pages, style, seed: bookletSeed(pages, style), is_active: true, surface_type: "booklet" };
}

/** tất cả mẫu (cả đang ẩn) của 1 loại, xếp theo nhóm (n) rồi thứ tự admin */
export function catalog(surface: "disc" | "booklet", settings: TemplateSetting[], customs: CustomTemplate[]): CatalogItem[] {
  const ns = surface === "disc" ? Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => MIN_PHOTOS + i) : [...BOOKLET_PAGES];
  const out: CatalogItem[] = [];
  for (const n of ns) {
    for (const s of STYLES) {
      const set = surface === "disc" ? settingOf(settings, n, s.id) : bookletSettingOf(settings, n, s.id);
      out.push({ key: `${n}-${s.id}`, kind: "gen", surface, n, style: s.id, name: set.name || (surface === "disc" ? s.name : `${s.name} · ${n} trang`), active: set.is_active, sort: set.sort_order ?? 1000 + idx(s.id), edited: !!set.template, setting: set });
    }
  }
  for (const c of customs.filter((x) => x.surface === surface)) {
    out.push({ key: `c:${c.id}`, kind: "custom", surface, n: c.n, style: (c.style ?? "polaroid") as Style, name: c.name, active: c.is_active, sort: c.sort_order, edited: false, custom: c });
  }
  return out.sort((a, b) => a.n - b.n || a.sort - b.sort);
}

/** mẫu tạo mới của khách dùng thẳng các lớp admin đã đặt (khung ảnh "bộ khung" → chọn khung cụ thể) */
const customSurfaces = (c: CustomTemplate, frames: Frame[]) =>
  (c.config?.surfaces ?? []).map((t, i) => ({ ...structuredClone(t), id: `c:${c.id}${i ? `-${i}` : ""}`, style: (c.style ?? t.style ?? "polaroid") as Style, fixed: true, layers: resolveFrameSets(structuredClone(t.layers), frames, i + 7) }));

/** CD Scrapbook (khách): các mẫu đang bật, đúng thứ tự admin. labels: id mẫu → tên hiển thị */
export function discTemplates(settings: TemplateSetting[], customs: CustomTemplate[], assets: ScrapAsset[], frames: Frame[]) {
  const labels: Record<string, string> = {};
  const gen: Record<number, Template[]> = {};
  const out: Template[] = [];
  for (const it of catalog("disc", settings, customs).filter((x) => x.active)) {
    let t: Template | undefined;
    if (it.kind === "gen") t = (gen[it.n] ??= templatesFor(it.n, settings, assets, {}, true, frames)).find((x) => x.style === it.style);
    else { const s = customSurfaces(it.custom!, frames)[0]; if (s) t = { ...s, n: it.n }; }
    if (!t) continue;
    labels[t.id] = it.name; out.push(t);
  }
  return { templates: out, labels };
}

/** Booklet Scrapbook (khách): các bộ mẫu đang bật cho số trang đang chọn */
export function bookletCatalogSets(pages: number, settings: TemplateSetting[], customs: CustomTemplate[], assets: ScrapAsset[], frames: Frame[]): BookletSet[] {
  const spread = settings.filter((s) => s.surface_type === "spread");
  return catalog("booklet", settings, customs).filter((x) => x.active && x.n === pages).map((it): BookletSet => {
    if (it.kind === "gen") return { ...generateBooklet(pages, it.style, it.setting!.seed, assets, frames, spread), name: it.name };
    const surfaces = customSurfaces(it.custom!, frames);
    return { id: it.key, style: it.style, seed: 0, pages, surfaces, photoCount: photoCountOf(surfaces), name: it.name };
  });
}
