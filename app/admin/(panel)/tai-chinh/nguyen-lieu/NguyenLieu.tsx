"use client";
/* Tài chính → Nguyên liệu (chỉ admin): tab Nhập nguyên liệu · Mặt hàng · Phân loại · Đóng gói mỗi đơn.
   Giá đơn vị dùng của mặt hàng = bình quân gia quyền các lần mua 12 tháng gần nhất (hoặc lần mua gần nhất) — view SQL finance_item_cost. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/finance/reconcile";
import { KIND_LABEL, errText, money, qtyText, saveSetting, todayVN, type Catalog, type Item, type ItemKind, type Purchase } from "@/lib/finance/catalog";
import { Combo } from "@/components/admin/finance/Combo";
import { categoryOpts, itemOpts, useCatalog } from "@/components/admin/finance/useCatalog";
import { PackagingTab } from "./PackagingTab";
import { Badge, Button, Card, EmptyState, Field, Input, Message, Select, confirmDialog, cx } from "@/components/admin/ui";

type Tab = "nhap" | "mat-hang" | "phan-loai" | "dong-goi";
const TABS: [Tab, string][] = [["nhap", "Nhập nguyên liệu"], ["mat-hang", "Mặt hàng"], ["phan-loai", "Phân loại"], ["dong-goi", "Đóng gói mỗi đơn"]];

export function NguyenLieu() {
  const [tab, setTab] = useState<Tab>("nhap");
  const C = useCatalog();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const loadP = useCallback(async () => {
    try { const sb = createClient(); setPurchases(await fetchAll<Purchase>((a, b) => sb.from("finance_purchases").select("*").order("bought_on", { ascending: false }).order("created_at", { ascending: false }).range(a, b))); }
    catch (e) { C.setErr(errText(e instanceof Error ? e.message : String(e))); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadP(); }, [loadP]);
  const reloadAll = async () => { await Promise.all([C.reload(), loadP()]); };
  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-[#e5e5e7]">
        {TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={cx("-mb-px shrink-0 border-b-2 px-3 py-2 text-[14px] font-medium", tab === k ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-transparent text-[#52525b] hover:text-[#18181b]")}>{l}</button>)}
      </div>
      {C.err && <Message msg={{ type: "err", text: C.err }} />}
      {!C.cat ? (!C.err && <p className="text-[13px] text-[#71717a]">Đang tải...</p>) : (
        <>
          {tab === "nhap" && <PurchasesTab cat={C.cat} purchases={purchases} reload={reloadAll} newItem={C.newItem} newCategory={C.newCategory} setErr={C.setErr} />}
          {tab === "mat-hang" && <ItemsTab cat={C.cat} purchases={purchases} reload={reloadAll} newCategory={C.newCategory} setErr={C.setErr} />}
          {tab === "phan-loai" && <CategoriesTab cat={C.cat} reload={C.reload} setErr={C.setErr} />}
          {tab === "dong-goi" && <PackagingTab cat={C.cat} reload={C.reload} newItem={C.newItem} setErr={C.setErr} />}
        </>
      )}
    </div>
  );
}

// ---------- Nhập nguyên liệu ----------
type Form = { item_id: string | null; category_id: string | null; qty: string; buy_unit: string; conv: string; total: string; price: string; bought_on: string; note: string; sale_price: string };
const n = (s: string) => { const v = Number(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const nd = (s: string) => { const v = Number(String(s).replace(",", ".")); return Number.isFinite(v) ? v : 0; }; // số lẻ (số lượng, quy đổi)

function PurchasesTab({ cat, purchases, reload, newItem, newCategory, setErr }: { cat: Catalog; purchases: Purchase[]; reload: () => Promise<void>; newItem: (n: string, v?: Partial<Item>) => Promise<string | null>; newCategory: (n: string) => Promise<string | null>; setErr: (s: string) => void }) {
  const cd = cat.categories.find((c) => c.name === "CD")?.id ?? null;
  const blank = (): Form => ({ item_id: null, category_id: cd, qty: "1", buy_unit: "", conv: "1", total: "", price: "", bought_on: todayVN(), note: "", sale_price: "" });
  const [f, setF] = useState<Form>(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [adv, setAdv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flt, setFlt] = useState({ from: "", to: "", item: null as string | null, cat: null as string | null });
  const item = cat.items.find((i) => i.id === f.item_id);
  const usage = useMemo(() => { const u: Record<string, number> = {}, c: Record<string, number> = {}; for (const p of purchases) { u[p.item_id] = (u[p.item_id] ?? 0) + 1; if (p.category_id) c[p.category_id] = (c[p.category_id] ?? 0) + 1; } return { u, c }; }, [purchases]);
  // Tổng tiền ⇄ Đơn giá (theo đơn vị mua): sửa ô này thì tự tính ô kia
  const setTotal = (v: string) => setF((x) => ({ ...x, total: v, price: n(v) && nd(x.qty) ? String(Math.round(n(v) / nd(x.qty))) : x.price }));
  const setPrice = (v: string) => setF((x) => ({ ...x, price: v, total: n(v) && nd(x.qty) ? String(Math.round(n(v) * nd(x.qty))) : x.total }));
  const setQty = (v: string) => setF((x) => ({ ...x, qty: v, total: n(x.price) && nd(v) ? String(Math.round(n(x.price) * nd(v))) : x.total }));
  const units = nd(f.qty) * (nd(f.conv) || 1);
  async function save() {
    if (!f.item_id) return setErr("Chọn mặt hàng.");
    if (!(nd(f.qty) > 0)) return setErr("Số lượng mua phải lớn hơn 0.");
    setBusy(true); setErr("");
    const sb = createClient();
    const row = { item_id: f.item_id, category_id: f.category_id, qty: nd(f.qty), buy_unit: f.buy_unit.trim() || null, conv: nd(f.conv) || 1, total: n(f.total), bought_on: f.bought_on || todayVN(), note: f.note.trim() || null };
    const r = editId ? await sb.from("finance_purchases").update(row).eq("id", editId) : await sb.from("finance_purchases").insert(row);
    if (r.error) setErr(errText(r.error.message));
    else {
      if (item?.kind === "resale" && f.sale_price) await sb.from("finance_items").update({ sale_price: n(f.sale_price) }).eq("id", item.id);
      setF((x) => ({ ...blank(), category_id: x.category_id, bought_on: x.bought_on })); setEditId(null);
      await reload();
    }
    setBusy(false);
  }
  function edit(p: Purchase) {
    setEditId(p.id);
    setF({ item_id: p.item_id, category_id: p.category_id, qty: String(p.qty), buy_unit: p.buy_unit ?? "", conv: String(p.conv), total: String(p.total), price: p.qty ? String(Math.round(p.total / p.qty)) : "", bought_on: p.bought_on, note: p.note ?? "", sale_price: String(cat.items.find((i) => i.id === p.item_id)?.sale_price ?? "") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function remove(p: Purchase) {
    if (!await confirmDialog("Xoá lần nhập này?", { danger: true, ok: "Xoá" })) return;
    const { error } = await createClient().from("finance_purchases").delete().eq("id", p.id);
    if (error) setErr(errText(error.message)); else await reload();
  }
  const shown = purchases.filter((p) => (!flt.from || p.bought_on >= flt.from) && (!flt.to || p.bought_on <= flt.to) && (!flt.item || p.item_id === flt.item) && (!flt.cat || p.category_id === flt.cat));
  const sum = shown.reduce((a, p) => a + Number(p.total), 0);
  const nameOf = (id: string | null, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? "—";
  return (
    <div className="space-y-4">
      <Card title={editId ? "Sửa lần nhập" : "Thêm nhanh"} actions={editId ? <Button size="sm" variant="secondary" icon={<X size={14} />} onClick={() => { setEditId(null); setF(blank()); }}>Huỷ sửa</Button> : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mặt hàng"><Combo value={f.item_id} options={itemOpts(cat, usage.u)} placeholder="Gõ để tìm / thêm" onChange={(id) => setF((x) => ({ ...x, item_id: id, category_id: cat.items.find((i) => i.id === id)?.category_id ?? x.category_id }))}
            onCreate={(t) => newItem(t, { category_id: f.category_id })} /></Field>
          <Field label="Phân loại"><Combo value={f.category_id} options={categoryOpts(cat, usage.c)} onChange={(id) => setF((x) => ({ ...x, category_id: id }))} onCreate={newCategory} /></Field>
          <Field label="Số lượng mua"><Input inputMode="decimal" value={f.qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Đơn vị mua" hint="xấp, hộp, bình…"><Input value={f.buy_unit} onChange={(e) => setF((x) => ({ ...x, buy_unit: e.target.value }))} placeholder={item?.unit ?? "cái"} /></Field>
          <Field label={`Quy đổi: 1 ${f.buy_unit || "đơn vị mua"} = ? ${item?.unit ?? "đơn vị dùng"}`}><Input inputMode="decimal" value={f.conv} onChange={(e) => setF((x) => ({ ...x, conv: e.target.value }))} /></Field>
          <Field label="Tổng tiền (đ)"><Input inputMode="numeric" value={f.total} onChange={(e) => setTotal(e.target.value)} /></Field>
          <Field label={`Đơn giá / ${f.buy_unit || "đơn vị mua"} (đ)`}><Input inputMode="numeric" value={f.price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Field label="Ngày mua"><Input type="date" value={f.bought_on} onChange={(e) => setF((x) => ({ ...x, bought_on: e.target.value }))} /></Field>
          <Field label="Ghi chú" className="sm:col-span-2 lg:col-span-3"><Input value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></Field>
          <div className="flex items-end"><Button className="w-full" icon={editId ? undefined : <Plus size={16} />} loading={busy} onClick={save}>{editId ? "Lưu" : "Thêm"}</Button></div>
        </div>
        <p className="mt-2 text-[12px] text-[#71717a]">{units > 0 && n(f.total) > 0 ? `= ${qtyText(units)} ${item?.unit ?? "đơn vị dùng"} · ${money(n(f.total) / units)} / ${item?.unit ?? "đơn vị dùng"}` : "Nhập tổng tiền hoặc đơn giá — ô còn lại tự tính."}</p>
        <button type="button" onClick={() => setAdv((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#52525b]">Nâng cao <ChevronDown size={14} className={cx("transition-transform", adv && "rotate-180")} /></button>
        {adv && (
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Field label="Giá bán dự kiến (hàng bán lại)" hint={item && item.kind !== "resale" ? "Mặt hàng này không phải kiểu Hàng bán lại — đổi kiểu ở tab Mặt hàng." : undefined}>
              <Input inputMode="numeric" value={f.sale_price} disabled={item?.kind !== "resale"} onChange={(e) => setF((x) => ({ ...x, sale_price: e.target.value }))} /></Field>
          </div>
        )}
      </Card>

      <Card title="Lịch sử nhập" description={`${shown.length} lần nhập · Tổng tiền ${money(sum)}`} padded={false}>
        <div className="flex flex-wrap items-end gap-2 border-b border-[#efeff1] px-4 py-3">
          <label className="text-[12px] text-[#71717a]">Từ ngày<Input type="date" value={flt.from} onChange={(e) => setFlt((x) => ({ ...x, from: e.target.value }))} className="w-auto" /></label>
          <label className="text-[12px] text-[#71717a]">Đến ngày<Input type="date" value={flt.to} onChange={(e) => setFlt((x) => ({ ...x, to: e.target.value }))} className="w-auto" /></label>
          <label className="min-w-[180px] flex-1 text-[12px] text-[#71717a]">Mặt hàng<Combo value={flt.item} options={itemOpts(cat, usage.u)} onChange={(id) => setFlt((x) => ({ ...x, item: id }))} placeholder="Tất cả" allowClear /></label>
          <label className="min-w-[160px] text-[12px] text-[#71717a]">Phân loại<Combo value={flt.cat} options={categoryOpts(cat, usage.c)} onChange={(id) => setFlt((x) => ({ ...x, cat: id }))} placeholder="Tất cả" allowClear /></label>
        </div>
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-[#71717a]"><tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium"><th>Ngày</th><th>Mặt hàng</th><th className="max-md:hidden">Phân loại</th><th className="text-right max-md:hidden">Số lượng</th><th className="text-right max-md:hidden">Đơn giá dùng</th><th className="text-right">Tổng tiền</th><th className="max-md:hidden">Ghi chú</th><th /></tr></thead>
              <tbody className="divide-y divide-[#efeff1]">
                {shown.map((p) => {
                  const it = cat.items.find((i) => i.id === p.item_id), u = Number(p.qty) * Number(p.conv);
                  return (
                    <tr key={p.id} className={cx("[&>td]:px-3 [&>td]:py-2", editId === p.id && "bg-[#fff5f9]")}>
                      <td className="whitespace-nowrap">{new Date(p.bought_on).toLocaleDateString("vi-VN")}</td>
                      <td className="font-medium">{it?.name ?? "—"}</td>
                      <td className="max-md:hidden">{nameOf(p.category_id, cat.categories)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{qtyText(p.qty)} {p.buy_unit ?? ""}{Number(p.conv) !== 1 && <span className="block text-[11px] text-[#a1a1aa]">= {qtyText(u)} {it?.unit}</span>}</td>
                      <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{u ? money(Number(p.total) / u) : "—"}</td>
                      <td className="whitespace-nowrap text-right font-medium tabular-nums">{money(Number(p.total))}</td>
                      <td className="max-w-[200px] truncate text-[#71717a] max-md:hidden">{p.note ?? ""}</td>
                      <td className="whitespace-nowrap text-right">
                        <button type="button" onClick={() => edit(p)} aria-label="Sửa" className="p-1 text-[#71717a] hover:text-[#ff5fa2]"><Pencil size={14} /></button>
                        <button type="button" onClick={() => remove(p)} aria-label="Xoá" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="p-5"><EmptyState>Chưa có lần nhập nào.</EmptyState></div>}
      </Card>
    </div>
  );
}

// ---------- Mặt hàng ----------
function ItemsTab({ cat, purchases, reload, newCategory, setErr }: { cat: Catalog; purchases: Purchase[]; reload: () => Promise<void>; newCategory: (n: string) => Promise<string | null>; setErr: (s: string) => void }) {
  const sb = createClient();
  const patch = async (id: string, v: Partial<Item>) => { const { error } = await sb.from("finance_items").update(v).eq("id", id); if (error) setErr(errText(error.message)); else await reload(); };
  const numOrNull = (s: string) => (s.trim() === "" ? null : nd(s));
  async function setMode(mode: "12m" | "last") { try { await saveSetting(sb, "avg_mode", { mode }); await reload(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } }
  async function remove(i: Item) {
    const k = purchases.filter((p) => p.item_id === i.id).length;
    if (!await confirmDialog(`Xoá mặt hàng "${i.name}"${k ? ` và ${k} lần nhập của nó` : ""}? Công thức đang dùng mặt hàng này cũng mất thành phần đó.`, { danger: true, ok: "Xoá" })) return;
    const { error } = await sb.from("finance_items").delete().eq("id", i.id);
    if (error) setErr(errText(error.message)); else await reload();
  }
  return (
    <Card title="Mặt hàng" padded={false}
      description="Giá đơn vị dùng = bình quân gia quyền các lần mua (tổng tiền ÷ tổng đơn vị dùng). Vật tư theo lần dùng: chi phí mỗi lần = đơn giá ÷ số lần (hoặc nhập thẳng)."
      actions={<span className="inline-flex overflow-hidden rounded-full border border-[#e5e5e7] text-[12px]">
        {([["12m", "Bình quân 12 tháng"], ["last", "Lần mua gần nhất"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={cx("px-2.5 py-1", cat.avgMode === k ? "bg-[#ff5fa2] text-white" : "text-[#52525b]")}>{l}</button>)}
      </span>}>
      {cat.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[12px] text-[#71717a]"><tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium"><th>Tên</th><th className="max-md:hidden">Phân loại</th><th className="max-md:hidden">Đơn vị dùng</th><th className="max-md:hidden">Kiểu</th><th className="max-md:hidden">Lần dùng / chi phí mỗi lần</th><th className="text-right">Giá đơn vị</th><th className="text-right max-md:hidden">Chi phí trong công thức</th><th /></tr></thead>
            <tbody className="divide-y divide-[#efeff1]">
              {cat.items.map((i) => {
                const c = cat.costs.get(i.id);
                return (
                  <tr key={i.id} className="align-top [&>td]:px-3 [&>td]:py-2">
                    <td><Input defaultValue={i.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== i.name && patch(i.id, { name: e.target.value.trim() })} className="h-8 min-w-[140px]" /></td>
                    <td className="min-w-[150px] max-md:hidden"><Combo value={i.category_id} options={categoryOpts(cat)} onChange={(id) => patch(i.id, { category_id: id })} onCreate={newCategory} allowClear /></td>
                    <td className="max-md:hidden"><Input defaultValue={i.unit} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== i.unit && patch(i.id, { unit: e.target.value.trim() })} className="h-8 w-[90px]" /></td>
                    <td className="max-md:hidden"><Select value={i.kind} onChange={(e) => patch(i.id, { kind: e.target.value as ItemKind })} className="h-8 w-auto">{(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select></td>
                    <td className="max-md:hidden">
                      {i.kind === "consumable" ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#52525b]">
                          <Input placeholder="số lần" defaultValue={i.uses_per_unit ?? ""} inputMode="decimal" onBlur={(e) => patch(i.id, { uses_per_unit: numOrNull(e.target.value) })} className="h-8 w-[80px]" /> lần / {i.unit}
                          <span className="text-[#a1a1aa]">hoặc</span>
                          <Input placeholder="đ / lần" defaultValue={i.cost_per_use ?? ""} inputMode="numeric" onBlur={(e) => patch(i.id, { cost_per_use: numOrNull(e.target.value) })} className="h-8 w-[90px]" />
                        </div>
                      ) : i.kind === "resale" ? (
                        <span className="flex items-center gap-1.5 text-[12px] text-[#52525b]">Giá bán<Input defaultValue={i.sale_price ?? ""} inputMode="numeric" onBlur={(e) => patch(i.id, { sale_price: numOrNull(e.target.value) })} className="h-8 w-[100px]" /></span>
                      ) : <span className="text-[#a1a1aa]">—</span>}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">{money(c?.unit_price)}<span className="block text-[11px] text-[#a1a1aa]">/ {i.unit}{c?.last_on ? ` · mua ${new Date(c.last_on).toLocaleDateString("vi-VN")}` : " · chưa nhập"}</span></td>
                    <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{money(c?.cost)}{i.kind === "consumable" && <span className="block text-[11px] text-[#a1a1aa]">/ lần</span>}</td>
                    <td className="text-right"><button type="button" onClick={() => remove(i)} aria-label="Xoá" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="p-5"><EmptyState>Chưa có mặt hàng — thêm ngay ở ô Mặt hàng khi nhập nguyên liệu.</EmptyState></div>}
    </Card>
  );
}

// ---------- Phân loại ----------
function CategoriesTab({ cat, reload, setErr }: { cat: Catalog; reload: () => Promise<void>; setErr: (s: string) => void }) {
  const [name, setName] = useState("");
  const sb = createClient();
  async function add() {
    if (!name.trim()) return;
    const { error } = await sb.from("finance_categories").insert({ name: name.trim(), sort_order: (cat.categories.at(-1)?.sort_order ?? 0) + 1 });
    if (error) setErr(errText(error.message)); else { setName(""); await reload(); }
  }
  async function rename(id: string, v: string) { const { error } = await sb.from("finance_categories").update({ name: v }).eq("id", id); if (error) setErr(errText(error.message)); else await reload(); }
  async function remove(id: string, nm: string) {
    if (!await confirmDialog(`Xoá phân loại "${nm}"? Mặt hàng, công thức thuộc phân loại này sẽ thành "chưa phân loại".`, { danger: true, ok: "Xoá" })) return;
    const { error } = await sb.from("finance_categories").delete().eq("id", id);
    if (error) setErr(errText(error.message)); else await reload();
  }
  const count = (id: string) => cat.items.filter((i) => i.category_id === id).length;
  return (
    <Card title="Phân loại" description="Dùng chung cho nguyên liệu, công thức, đơn ngoài sàn và báo cáo.">
      <div className="mb-3 flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Tên phân loại mới" /><Button icon={<Plus size={16} />} onClick={add}>Thêm</Button></div>
      <ul className="divide-y divide-[#efeff1] rounded-[10px] border border-[#e5e5e7]">
        {cat.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <Input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && rename(c.id, e.target.value.trim())} className="h-8 flex-1" />
            <Badge>{count(c.id)} mặt hàng</Badge>
            <button type="button" onClick={() => remove(c.id, c.name)} aria-label="Xoá" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
