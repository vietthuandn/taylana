/* Tài chính · danh mục dùng chung (phân loại, mặt hàng, nhập nguyên liệu, công thức, quy tắc ghép, cài đặt).
   Đọc / ghi thẳng Supabase từ trình duyệt (RLS chỉ admin). Giá đơn vị + giá vốn công thức lấy từ view SQL (cùng công thức với Tổng quan). */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Category = { id: string; name: string; sort_order: number };
export type ItemKind = "material" | "consumable" | "resale";
export const KIND_LABEL: Record<ItemKind, string> = { material: "Nguyên liệu", consumable: "Vật tư theo lần dùng", resale: "Hàng bán lại" };
export type Item = { id: string; name: string; category_id: string | null; unit: string; kind: ItemKind; uses_per_unit: number | null; cost_per_use: number | null; sale_price: number | null };
export type ItemCost = { item_id: string; unit_price: number | null; last_price: number | null; last_on: string | null; purchases_12m: number; cost: number | null };
export type Purchase = { id: string; item_id: string; category_id: string | null; qty: number; buy_unit: string | null; conv: number; total: number; bought_on: string; note: string | null; created_at: string };
export type Recipe = { id: string; name: string; source: "cd" | "print" | "custom"; category_id: string | null; sort_order?: number | null; sale_price?: number | null; fee_pct?: number | null };
export type RecipeItem = { id: string; recipe_id: string; item_id: string; qty: number; sort_order: number };
export type RecipeCost = { recipe_id: string; cost: number; missing: boolean; parts: number };
export type MapRule = { id: string; match_name: string | null; match_variation: string | null; match_product_id: string | null; match_sku: string | null; recipe_id: string | null; category_id: string | null; priority: number };
export type Packaging = { mode: "fixed" | "recipe"; fixed: number; items: { item_id: string; qty: number }[] };

export const money = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${Math.round(n).toLocaleString("vi-VN")}đ`);
export const qtyText = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("vi-VN", { maximumFractionDigits: 3 }));
/** hôm nay theo giờ Việt Nam (YYYY-MM-DD) */
export const todayVN = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export const MISSING = "Chưa có bảng Tài chính — cần chạy supabase/migration_finance_costs.sql.";
export const errText = (m: string) => (/finance_|relation|schema cache|does not exist/.test(m) ? MISSING : m);

export async function loadCatalog(sb: SupabaseClient) {
  const q = async <T,>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(errText(r.error.message)); return (r.data ?? []) as T; };
  const [categories, items, costs, recipes, recipeItems, recipeCosts, rules, settings] = await Promise.all([
    q<Category[]>(sb.from("finance_categories").select("*").order("sort_order").order("name")),
    q<Item[]>(sb.from("finance_items").select("*").order("name")),
    q<ItemCost[]>(sb.from("finance_item_cost").select("*")),
    q<Recipe[]>(sb.from("finance_recipes").select("*").order("name")),
    q<RecipeItem[]>(sb.from("finance_recipe_items").select("*").order("sort_order")),
    q<RecipeCost[]>(sb.from("finance_recipe_cost").select("*")),
    q<MapRule[]>(sb.from("finance_product_map").select("*").order("priority", { ascending: false })),
    q<{ key: string; value: Record<string, unknown> }[]>(sb.from("finance_settings").select("key,value")),
  ]);
  recipes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "vi")); // thứ tự admin xếp
  const set = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const pk = (set.packaging ?? {}) as Partial<Packaging>;
  return {
    categories, items, costs: new Map(costs.map((c) => [c.item_id, c])), recipes, recipeItems, recipeCosts: new Map(recipeCosts.map((c) => [c.recipe_id, c])), rules,
    packaging: { mode: pk.mode === "recipe" ? "recipe" : "fixed", fixed: Number(pk.fixed ?? 0) || 0, items: Array.isArray(pk.items) ? pk.items : [] } as Packaging,
    avgMode: ((set.avg_mode as { mode?: string } | undefined)?.mode === "last" ? "last" : "12m") as "12m" | "last",
    settings: set,
  };
}
export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

/** chi phí đóng gói mỗi đơn theo cài đặt (giống hàm SQL finance_packaging_cost) */
export const packagingCost = (c: Catalog) => (c.packaging.mode === "fixed" ? c.packaging.fixed : c.packaging.items.reduce((a, x) => a + (Number(x.qty) || 0) * (c.costs.get(x.item_id)?.cost ?? 0), 0));

export async function saveSetting(sb: SupabaseClient, key: string, value: unknown) {
  const { error } = await sb.from("finance_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(errText(error.message));
}
export async function addCategory(sb: SupabaseClient, name: string, order = 100) {
  const { data, error } = await sb.from("finance_categories").insert({ name: name.trim(), sort_order: order }).select("*").single();
  if (error) throw new Error(errText(error.message));
  return data as Category;
}
export async function addItem(sb: SupabaseClient, v: Partial<Item> & { name: string }) {
  const { data, error } = await sb.from("finance_items").insert({ unit: "cái", kind: "material", ...v, name: v.name.trim() }).select("*").single();
  if (error) throw new Error(errText(error.message));
  return data as Item;
}

/** các "Loại" của sản phẩm CD trên web + món in lẻ (bàn in) → gợi ý tên công thức */
export async function productTypeNames(sb: SupabaseClient): Promise<{ cd: string[]; print: string[] }> {
  const cd: string[] = [], print: string[] = [];
  try {
    const { data } = await sb.from("products").select("slug,kind,option_groups(name,select_type,required,sort_order,options(name,is_active,sort_order))");
    for (const p of (data ?? []) as { slug: string; kind: string | null; option_groups: { select_type: string; required: boolean; sort_order: number; options: { name: string; is_active: boolean; sort_order: number }[] }[] }[]) {
      if ((p.kind ?? (p.slug === "in-cd-theo-yeu-cau" ? "cd" : "other")) !== "cd") continue;
      const g = [...(p.option_groups ?? [])].filter((x) => x.select_type === "single").sort((a, b) => Number(b.required) - Number(a.required) || a.sort_order - b.sort_order)[0];
      for (const o of [...(g?.options ?? [])].sort((a, b) => a.sort_order - b.sort_order)) if (o.is_active && !cd.includes(o.name)) cd.push(o.name);
    }
  } catch { /* chưa có bảng sản phẩm */ }
  try {
    const { data } = await sb.from("print_addons").select("name,is_active,sort_order").order("sort_order");
    for (const a of (data ?? []) as { name: string; is_active: boolean }[]) if (a.is_active && !print.includes(a.name)) print.push(a.name);
  } catch { /* chưa có bàn in */ }
  return { cd, print };
}

/** ghép 1 dòng sản phẩm với quy tắc (giống view SQL finance_shopee_line_match) */
export function matchRule(rules: MapRule[], l: { product_name: string | null; variation: string | null; product_id: string | null; sku: string | null }) {
  const has = (s: string | null) => !!s && s.trim() !== "";
  const inc = (a: string | null, b: string | null) => !!a && a.toLowerCase().includes((b ?? "").toLowerCase());
  const ok = rules.filter((r) => (has(r.match_name) || has(r.match_variation) || has(r.match_product_id) || has(r.match_sku))
    && (!has(r.match_name) || inc(l.product_name, r.match_name)) && (!has(r.match_variation) || inc(l.variation, r.match_variation))
    && (!has(r.match_product_id) || l.product_id === r.match_product_id) && (!has(r.match_sku) || l.sku === r.match_sku));
  const len = (r: MapRule) => (r.match_name ?? "").length + (r.match_variation ?? "").length + (r.match_product_id ?? "").length + (r.match_sku ?? "").length;
  return ok.sort((a, b) => b.priority - a.priority || len(b) - len(a))[0] ?? null;
}
