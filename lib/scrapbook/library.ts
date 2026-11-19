/* Thư viện mẫu thiết kế CỐ ĐỊNH (bảng design_templates, kind 'cd' | 'booklet_single' | 'booklet_spread') + danh mục
   (template_categories) + bộ booklet (booklet_bundles). Mỗi mẫu = 1 bề mặt đóng băng thành JSON (config.template):
   CD = mặt đĩa 12 cm · Trang đơn = trang 12 × 12 cm · Trang đôi = cặp trang 24 × 12 cm (gáy giữa).
   Không sinh mẫu / rải sticker tự động phía khách nữa. Dùng chung trang khách + admin. */
import { clone } from "@/components/scrapbook/useScrapDoc";
import type { Template } from "./types";
import type { TemplateDoc } from "@/lib/cdDoc";

export type TplKind = "cd" | "booklet_single" | "booklet_spread";
export type CategoryScope = TplKind | "booklet_bundle";
export type Category = { id: string; scope: CategoryScope; name: string; sort_order: number; is_active: boolean };
export type DesignTpl = {
  id: string; kind: TplKind; name: string; category_id: string | null; config: { template: Template; legacy?: string; cdDoc?: TemplateDoc }; // cdDoc: bản cho trình "Thiết kế CD" (mặt đĩa / trang đơn)
  photo_count: number; thumbnail_url: string | null; is_active: boolean; sort_order: number; updated_at?: string;
};
export type Bundle = { id: string; name: string; category_id: string | null; page_count: number; template_ids: string[]; thumbnail_url: string | null; is_active: boolean; sort_order: number };
export type Library = { categories: Category[]; templates: DesignTpl[]; bundles: Bundle[] };

export const KIND_INFO: Record<TplKind, { label: string; unit: string }> = {
  cd: { label: "CD Template", unit: "mặt đĩa" },
  booklet_single: { label: "Trang đơn", unit: "trang 12 × 12 cm" },
  booklet_spread: { label: "Trang đôi", unit: "cặp trang 24 × 12 cm" },
};
export const BUNDLE_PAGES = [2, 4, 8, 12] as const;
export const SUGGESTED_CATEGORIES = ["Cơ bản", "Sinh nhật", "Tốt nghiệp", "Tình iu", "Bạn thân", "Gia đình"];
export const TPL_COLS = "id, kind, name, category_id, config, photo_count, thumbnail_url, is_active, sort_order, updated_at";

const WHITE = { color: "#ffffff", pattern: "plain" as const, ink: "#3f3f46" };
/** bề mặt trống theo loại mẫu */
export function blankTemplate(kind: TplKind, gutter: "left" | "right" = "left"): Template {
  if (kind === "cd") return { id: "blank-cd", n: 0, style: "polaroid", seed: 1, surface: "disc", bg: { ...WHITE }, layers: [] };
  if (kind === "booklet_spread") return { id: "blank-spread", n: 0, style: "polaroid", seed: 1, surface: "spread", bg: { ...WHITE }, layers: [] };
  return { id: "blank-page", n: 0, style: "polaroid", seed: 1, surface: "page", gutter, bg: { ...WHITE }, layers: [] };
}
/** số ô ảnh của 1 bề mặt (số ảnh khác nhau) */
export const slotCount = (t: Template) => new Set(t.layers.flatMap((l) => (l.k === "photo" ? [l.slot] : []))).size;
/** mẫu thư viện → bề mặt độc lập (ô ảnh trống "+"); trang đơn đặt theo vị trí gáy */
export function libTemplate(d: DesignTpl, gutter?: "left" | "right"): Template {
  const t = clone(d.config.template);
  return { ...t, id: `t:${d.id}`, fixed: true, ...(t.surface === "page" && gutter ? { gutter } : {}), layers: t.layers.map((l) => (l.k === "photo" ? { ...l, photo: "" } : l)) };
}
/** điền ảnh (theo thứ tự) vào các ô ảnh còn trống của 1 bề mặt, theo số thứ tự ô. Trả bề mặt mới + ảnh đã dùng */
export function fillSlots(t: Template, ids: string[]): { t: Template; used: string[] } {
  const queue = [...ids], used: string[] = [];
  const order = t.layers.map((l, i) => ({ l, i })).filter(({ l }) => l.k === "photo" && !l.photo).sort((a, b) => (a.l as { slot: number }).slot - (b.l as { slot: number }).slot || a.i - b.i);
  const take = new Map<number, string>();
  for (const { i } of order) { const id = queue.shift(); if (!id) break; take.set(i, id); used.push(id); }
  return { t: { ...t, layers: t.layers.map((l, i) => (take.has(i) && l.k === "photo" ? { ...l, photo: take.get(i)! } : l)) }, used };
}
/** điền ảnh chưa dùng vào ô trống của nhiều bề mặt (theo thứ tự trang) */
export function fillDoc(doc: Template[], unused: string[]) {
  let rest = [...unused];
  const out = doc.map((t) => { const r = fillSlots(t, rest); rest = rest.filter((x) => !r.used.includes(x)); return r.t; });
  return out;
}
/** nhóm mẫu theo danh mục (đúng thứ tự admin); mẫu chưa có danh mục → nhóm "Khác" ở cuối */
export function groupByCategory<T extends { category_id: string | null; sort_order: number }>(items: T[], cats: Category[]) {
  const groups = cats.slice().sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ cat: c as Category | null, items: items.filter((x) => x.category_id === c.id).sort((a, b) => a.sort_order - b.sort_order) }));
  const other = items.filter((x) => !cats.some((c) => c.id === x.category_id));
  if (other.length) groups.push({ cat: null, items: other.sort((a, b) => a.sort_order - b.sort_order) });
  return groups.filter((g) => g.items.length);
}
/** các ô của 1 bộ booklet theo số trang: đơn = trang lẻ đầu / cuối, đôi = cặp giữa */
export function bundleSlots(pages: number): { label: string; kind: TplKind; gutter?: "left" | "right" }[] {
  if (pages === 2) return [{ label: "Trang 1", kind: "booklet_single", gutter: "left" }, { label: "Trang 2", kind: "booklet_single", gutter: "right" }];
  const out: { label: string; kind: TplKind; gutter?: "left" | "right" }[] = [{ label: "Trang 1", kind: "booklet_single", gutter: "left" }];
  for (let p = 2; p < pages; p += 2) out.push({ label: `Trang ${p}–${p + 1}`, kind: "booklet_spread" });
  out.push({ label: `Trang ${pages}`, kind: "booklet_single", gutter: "right" });
  return out;
}
/** cấu trúc trang trống của booklet theo số trang */
export const blankBooklet = (pages: number): Template[] => bundleSlots(pages).map((s) => blankTemplate(s.kind, s.gutter));
