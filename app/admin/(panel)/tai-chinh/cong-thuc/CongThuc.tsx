"use client";
/* Tài chính → Công thức giá vốn (chỉ admin):
   · tab Công thức: mỗi công thức gắn 1 loại sản phẩm (Loại của sản phẩm CD trên web · món in lẻ · tự đặt tên), thành phần = mặt hàng + lượng dùng (số lẻ),
     giá vốn ước tính = Σ lượng × giá bình quân (view finance_recipe_cost — tự cập nhật khi giá nguyên liệu đổi).
   · tab Ghép sản phẩm Shopee: quy tắc (cụm chữ trong tên sản phẩm / tên phân loại, mã sản phẩm, SKU) → công thức + phân loại;
     danh sách dòng sản phẩm Shopee CHƯA ghép được → chọn công thức (kèm "Lưu thành quy tắc"). */
import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/finance/reconcile";
import { errText, money, productTypeNames, qtyText, type Catalog, type MapRule, type Recipe } from "@/lib/finance/catalog";
import { Combo, type ComboOpt } from "@/components/admin/finance/Combo";
import { categoryOpts, itemOpts, recipeOpts, useCatalog } from "@/components/admin/finance/useCatalog";
import { Badge, Button, Card, EmptyState, Input, Message, confirmDialog, cx } from "@/components/admin/ui";

const SRC: Record<Recipe["source"], string> = { cd: "Loại CD", print: "Món in lẻ", custom: "Tự đặt" };

export function CongThuc() {
  const [tab, setTab] = useState<"recipes" | "map">("recipes");
  const C = useCatalog();
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[#e5e5e7]">
        {([["recipes", "Công thức"], ["map", "Ghép sản phẩm Shopee"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={cx("-mb-px border-b-2 px-3 py-2 text-[14px] font-medium", tab === k ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-transparent text-[#52525b] hover:text-[#18181b]")}>{l}</button>)}
      </div>
      {C.err && <Message msg={{ type: "err", text: C.err }} />}
      {!C.cat ? (!C.err && <p className="text-[13px] text-[#71717a]">Đang tải...</p>)
        : tab === "recipes" ? <Recipes cat={C.cat} reload={C.reload} newItem={C.newItem} newCategory={C.newCategory} setErr={C.setErr} />
        : <MapTab cat={C.cat} reload={C.reload} newCategory={C.newCategory} setErr={C.setErr} />}
    </div>
  );
}


// ---------- Công thức ----------
type Part = { item_id: string; qty: number };
function Recipes({ cat, reload, newItem, newCategory, setErr }: { cat: Catalog; reload: () => Promise<void>; newItem: (n: string) => Promise<string | null>; newCategory: (n: string) => Promise<string | null>; setErr: (s: string) => void }) {
  const [sel, setSel] = useState<string | null>(cat.recipes[0]?.id ?? null);
  const [types, setTypes] = useState<{ cd: string[]; print: string[] }>({ cd: [], print: [] });
  const [parts, setParts] = useState<Part[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const sb = createClient();
  useEffect(() => { productTypeNames(sb).then(setTypes); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const r = cat.recipes.find((x) => x.id === sel) ?? null;
  useEffect(() => { setParts(cat.recipeItems.filter((x) => x.recipe_id === sel).map((x) => ({ item_id: x.item_id, qty: Number(x.qty) }))); setDirty(false); }, [sel, cat.recipeItems]);
  const cost = parts.reduce((a, p) => a + p.qty * (cat.costs.get(p.item_id)?.cost ?? 0), 0);
  const missing = parts.some((p) => p.item_id && cat.costs.get(p.item_id)?.cost == null);
  // gợi ý tên công thức mới: Loại CD + món in lẻ chưa có công thức
  const have = new Set(cat.recipes.map((x) => x.name.toLowerCase()));
  const sugg: ComboOpt[] = [...types.cd.map((n) => ({ id: `cd:${n}`, label: n, hint: "Loại CD" })), ...types.print.map((n) => ({ id: `print:${n}`, label: n, hint: "Món in lẻ" }))].filter((o) => !have.has(o.label.toLowerCase()));
  async function create(source: Recipe["source"], name: string) {
    const { data, error } = await sb.from("finance_recipes").insert({ name: name.trim(), source, category_id: cat.categories.find((c) => c.name === (source === "print" ? "Vật tư in" : "CD"))?.id ?? null }).select("id").single();
    if (error) { setErr(errText(error.message)); return null; }
    await reload(); setSel(data.id); return data.id as string;
  }
  async function patch(v: Partial<Recipe>) { if (!r) return; const { error } = await sb.from("finance_recipes").update(v).eq("id", r.id); if (error) setErr(errText(error.message)); else await reload(); }
  async function saveParts() {
    if (!r) return;
    setBusy(true);
    const del = await sb.from("finance_recipe_items").delete().eq("recipe_id", r.id);
    const rows = parts.filter((p) => p.item_id && p.qty > 0).map((p, i) => ({ recipe_id: r.id, item_id: p.item_id, qty: p.qty, sort_order: i }));
    const ins = rows.length && !del.error ? await sb.from("finance_recipe_items").insert(rows) : { error: del.error };
    if (ins.error) setErr(errText(ins.error.message)); else { setErr(""); await reload(); }
    setBusy(false);
  }
  async function remove() {
    if (!r || !await confirmDialog(`Xoá công thức "${r.name}"? Quy tắc ghép đang trỏ tới công thức này sẽ chỉ còn phân loại.`, { danger: true, ok: "Xoá" })) return;
    const { error } = await sb.from("finance_recipes").delete().eq("id", r.id);
    if (error) setErr(errText(error.message)); else { setSel(null); await reload(); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card title="Công thức" padded={false}>
        <div className="border-b border-[#efeff1] p-3">
          <Combo value={null} options={sugg} placeholder="+ Thêm: chọn Loại CD / món in lẻ hoặc gõ tên" onChange={(id) => { if (id) { const [s, ...n] = id.split(":"); create(s as Recipe["source"], n.join(":")); } }} onCreate={(t) => create("custom", t)} />
        </div>
        {cat.recipes.length ? (
          <ul className="max-h-[60vh] divide-y divide-[#efeff1] overflow-y-auto">
            {cat.recipes.map((x) => {
              const c = cat.recipeCosts.get(x.id);
              return (
                <li key={x.id}><button type="button" onClick={() => setSel(x.id)} className={cx("flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]", sel === x.id ? "bg-[#fff5f9]" : "hover:bg-[#fafafa]")}>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{x.name}</span><span className="text-[11px] text-[#a1a1aa]">{SRC[x.source]} · {c?.parts ?? 0} thành phần</span></span>
                  <span className={cx("shrink-0 tabular-nums", c?.missing && "text-[#d97706]")}>{money(c?.cost ?? 0)}</span>
                </button></li>
              );
            })}
          </ul>
        ) : <div className="p-4"><EmptyState>Chưa có công thức.</EmptyState></div>}
      </Card>
      {r ? (
        <Card title={r.name} description={`${SRC[r.source]} · giá vốn ước tính theo giá bình quân nguyên liệu, tự cập nhật khi giá đổi.`}
          actions={<><Button size="sm" variant="secondary" icon={<Trash2 size={14} />} onClick={remove}>Xoá</Button><Button size="sm" icon={<Save size={14} />} loading={busy} disabled={!dirty} onClick={saveParts}>Lưu thành phần</Button></>}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] text-[#71717a]">Tên<Input key={r.id} defaultValue={r.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.name && patch({ name: e.target.value.trim() })} /></label>
            <label className="text-[12px] text-[#71717a]">Phân loại<Combo value={r.category_id} options={categoryOpts(cat)} onChange={(id) => patch({ category_id: id })} onCreate={newCategory} allowClear /></label>
          </div>
          <p className="mb-2 text-[13px] font-semibold">Thành phần</p>
          <div className="space-y-2">
            {parts.map((p, i) => {
              const it = cat.items.find((x) => x.id === p.item_id), c = p.item_id ? cat.costs.get(p.item_id)?.cost ?? null : null;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Combo className="min-w-[200px] flex-1" value={p.item_id || null} options={itemOpts(cat)} placeholder="Mặt hàng" onCreate={newItem}
                    onChange={(id) => { setParts((x) => x.map((y, j) => (j === i ? { ...y, item_id: id ?? "" } : y))); setDirty(true); }} />
                  <Input inputMode="decimal" value={String(p.qty)} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")); setParts((x) => x.map((y, j) => (j === i ? { ...y, qty: Number.isFinite(v) ? v : 0 } : y))); setDirty(true); }} className="w-[90px]" />
                  <span className="w-[70px] text-[#71717a]">{it?.kind === "consumable" ? "lần" : it?.unit ?? ""}</span>
                  <span className={cx("w-[110px] text-right tabular-nums", c === null && p.item_id && "text-[#d97706]")}>{c === null ? (p.item_id ? "chưa có giá" : "") : money(c * p.qty)}</span>
                  <button type="button" onClick={() => { setParts((x) => x.filter((_, j) => j !== i)); setDirty(true); }} aria-label="Bỏ" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                </div>
              );
            })}
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => { setParts((x) => [...x, { item_id: "", qty: 1 }]); setDirty(true); }}>Thêm thành phần</Button>
          </div>
          <p className="mt-4 text-[15px]">Giá vốn ước tính: <b>{money(cost)}</b>{missing && <span className="ml-2 text-[12px] text-[#d97706]">(có thành phần chưa nhập giá)</span>}</p>
          {dirty && <p className="text-[12px] text-[#d97706]">Chưa lưu thành phần.</p>}
        </Card>
      ) : <Card><EmptyState>Chọn hoặc thêm 1 công thức.</EmptyState></Card>}
    </div>
  );
}

// ---------- Ghép sản phẩm Shopee ----------
type Line = { order_sn: string; product_name: string | null; variation: string | null; product_id: string | null; sku: string | null };
type Group = { key: string; product_name: string | null; variation: string | null; product_id: string | null; sku: string | null; n: number };
function MapTab({ cat, reload, newCategory, setErr }: { cat: Catalog; reload: () => Promise<void>; newCategory: (n: string) => Promise<string | null>; setErr: (s: string) => void }) {
  const sb = createClient();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [asRule, setAsRule] = useState(true);
  const load = async () => {
    try { setLines(await fetchAll<Line>((a, b) => sb.from("finance_shopee_line_match").select("order_sn,product_name,variation,product_id,sku").is("recipe_id", null).is("category_id", null).range(a, b))); }
    catch (e) { setErr(errText(e instanceof Error ? e.message : String(e))); setLines([]); }
  };
  useEffect(() => { load(); }, [cat.rules]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const l of lines ?? []) { const k = `${l.product_name}|${l.variation}|${l.product_id}`; const g = m.get(k); if (g) g.n++; else m.set(k, { key: k, ...l, n: 1 }); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [lines]);
  async function addRule(v: Partial<MapRule>) { const { error } = await sb.from("finance_product_map").insert(v); if (error) setErr(errText(error.message)); else await reload(); }
  async function patchRule(id: string, v: Partial<MapRule>) { const { error } = await sb.from("finance_product_map").update(v).eq("id", id); if (error) setErr(errText(error.message)); else await reload(); }
  async function delRule(id: string) { const { error } = await sb.from("finance_product_map").delete().eq("id", id); if (error) setErr(errText(error.message)); else await reload(); }
  /** chọn công thức cho 1 nhóm dòng chưa ghép: "Lưu thành quy tắc" = quy tắc chung theo phân loại hàng (hoặc mã sản phẩm / tên);
      không chọn = quy tắc riêng đúng tên sản phẩm + tên phân loại này (ưu tiên cao) */
  async function assign(g: Group, recipe: string) {
    const rc = cat.recipes.find((x) => x.id === recipe);
    const base = { recipe_id: recipe, category_id: rc?.category_id ?? null };
    if (asRule) await addRule(g.variation ? { ...base, match_variation: g.variation } : g.product_id ? { ...base, match_product_id: g.product_id } : { ...base, match_name: g.product_name });
    else await addRule({ ...base, match_name: g.product_name, match_variation: g.variation, match_product_id: g.variation ? null : g.product_id, priority: 10 });
  }
  const inp = "h-8 min-w-[110px]";
  return (
    <div className="space-y-4">
      <Card title={`Dòng sản phẩm chưa ghép (${groups.length})`} description="Từ các đơn Shopee đã nhập. Dòng chưa có tên phân loại (chưa nhập file xuất đơn) ghép theo mã sản phẩm nếu có quy tắc, không thì “Chưa rõ loại”."
        actions={<label className="flex items-center gap-1.5 text-[12px] text-[#52525b]"><input type="checkbox" className="accent-[#ff5fa2]" checked={asRule} onChange={(e) => setAsRule(e.target.checked)} /> Lưu thành quy tắc</label>} padded={false}>
        {lines === null ? <p className="p-4 text-[13px] text-[#71717a]">Đang tải...</p> : groups.length ? (
          <ul className="max-h-[50vh] divide-y divide-[#efeff1] overflow-y-auto">
            {groups.map((g) => (
              <li key={g.key} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
                <span className="min-w-[200px] flex-1"><span className="block">{g.product_name ?? "—"}</span>
                  <span className="text-[12px] text-[#71717a]">{g.variation ? `Phân loại: ${g.variation}` : <Badge tone="amber">Chưa rõ loại</Badge>}{g.product_id ? ` · Mã SP ${g.product_id}` : ""}</span></span>
                <Badge>{g.n} lần</Badge>
                <Combo className="w-[240px]" value={null} options={recipeOpts(cat)} placeholder="Chọn công thức" onChange={(id) => id && assign(g, id)} />
              </li>
            ))}
          </ul>
        ) : <div className="p-4"><EmptyState>Mọi dòng sản phẩm đã ghép được.</EmptyState></div>}
      </Card>

      <Card title={`Quy tắc ghép (${cat.rules.length})`} description="Ô trống = không xét. Khớp khi tên sản phẩm / tên phân loại CHỨA cụm chữ (không phân biệt hoa thường), mã sản phẩm / SKU trùng khớp. Ưu tiên cao xét trước."
        actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => addRule({ match_variation: "Phân loại mới" })}>Thêm quy tắc</Button>} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[12px] text-[#71717a]"><tr className="[&>th]:whitespace-nowrap [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium"><th>Tên phân loại chứa</th><th>Tên sản phẩm chứa</th><th className="max-md:hidden">Mã SP</th><th className="max-md:hidden">SKU</th><th>Công thức</th><th className="max-md:hidden">Phân loại</th><th className="max-md:hidden">Ưu tiên</th><th /></tr></thead>
            <tbody className="divide-y divide-[#efeff1]">
              {cat.rules.map((r) => {
                const txt = (k: "match_variation" | "match_name" | "match_product_id" | "match_sku") => <Input key={`${r.id}${k}${r[k]}`} defaultValue={r[k] ?? ""} onBlur={(e) => (e.target.value.trim() || null) !== r[k] && patchRule(r.id, { [k]: e.target.value.trim() || null })} className={inp} />;
                return (
                  <tr key={r.id} className="[&>td]:px-2 [&>td]:py-1.5">
                    <td>{txt("match_variation")}</td><td>{txt("match_name")}</td><td className="max-md:hidden">{txt("match_product_id")}</td><td className="max-md:hidden">{txt("match_sku")}</td>
                    <td className="min-w-[180px]"><Combo value={r.recipe_id} options={recipeOpts(cat)} onChange={(id) => patchRule(r.id, { recipe_id: id, category_id: r.category_id ?? cat.recipes.find((x) => x.id === id)?.category_id ?? null })} allowClear /></td>
                    <td className="min-w-[130px] max-md:hidden"><Combo value={r.category_id} options={categoryOpts(cat)} onChange={(id) => patchRule(r.id, { category_id: id })} onCreate={newCategory} allowClear /></td>
                    <td className="max-md:hidden"><Input key={`${r.id}p${r.priority}`} defaultValue={String(r.priority)} inputMode="numeric" onBlur={(e) => Number(e.target.value) !== r.priority && patchRule(r.id, { priority: Number(e.target.value) || 0 })} className="h-8 w-[60px]" /></td>
                    <td><button type="button" onClick={() => delRule(r.id)} aria-label="Xoá" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!cat.rules.length && <div className="p-4"><EmptyState>Chưa có quy tắc.</EmptyState></div>}
        <p className="border-t border-[#efeff1] px-4 py-2 text-[12px] text-[#71717a]">{qtyText(cat.rules.length)} quy tắc · giá vốn mỗi công thức xem ở tab Công thức.</p>
      </Card>
    </div>
  );
}
