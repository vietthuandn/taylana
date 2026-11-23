"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addCategory, addItem, errText, loadCatalog, money, type Catalog, type Item } from "@/lib/finance/catalog";
import type { ComboOpt } from "./Combo";

/** tải danh mục tài chính (phân loại, mặt hàng, giá, công thức, quy tắc, cài đặt) + các hàm thêm nhanh cho combobox */
export function useCatalog() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState("");
  const reload = useCallback(async () => {
    try { setCat(await loadCatalog(createClient())); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const sb = createClient();
  const newCategory = async (name: string) => { try { const c = await addCategory(sb, name); await reload(); return c.id; } catch (e) { setErr(errText(e instanceof Error ? e.message : String(e))); return null; } };
  const newItem = async (name: string, v: Partial<Item> = {}) => { try { const i = await addItem(sb, { ...v, name }); await reload(); return i.id; } catch (e) { setErr(errText(e instanceof Error ? e.message : String(e))); return null; } };
  return { cat, err, setErr, reload, newCategory, newItem };
}

/** gợi ý combobox: phân loại / mặt hàng, đếm số lần dùng (dùng nhiều lên đầu) */
export function categoryOpts(c: Catalog, usage: Record<string, number> = {}): ComboOpt[] {
  const n: Record<string, number> = { ...usage };
  for (const i of c.items) if (i.category_id) n[i.category_id] = (n[i.category_id] ?? 0) + 1;
  for (const r of c.recipes) if (r.category_id) n[r.category_id] = (n[r.category_id] ?? 0) + 1;
  return c.categories.map((x) => ({ id: x.id, label: x.name, count: n[x.id] ?? 0 }));
}
export function itemOpts(c: Catalog, usage: Record<string, number> = {}): ComboOpt[] {
  const n: Record<string, number> = { ...usage };
  for (const r of c.recipeItems) n[r.item_id] = (n[r.item_id] ?? 0) + 1;
  return c.items.map((x) => ({ id: x.id, label: x.name, hint: x.unit, count: n[x.id] ?? 0 }));
}
/** gợi ý công thức: tên + giá vốn ước tính */
export const recipeOpts = (c: Catalog): ComboOpt[] => c.recipes.map((r) => ({ id: r.id, label: r.name, hint: money(c.recipeCosts.get(r.id)?.cost ?? 0) }));
