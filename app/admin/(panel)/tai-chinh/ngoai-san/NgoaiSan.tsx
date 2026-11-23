"use client";
/* Tài chính → Thu nhập ngoài sàn (chỉ admin): đơn Facebook, Zalo, khách quen…
   "+ Thêm đơn": Nhập nhanh (ngày, số tiền, phân loại, kênh) · Nhập chi tiết (nhiều dòng: sản phẩm / công thức, SL, thành tiền).
   Mỗi đơn cộng chi phí đóng gói theo cài đặt (tắt được). Lãi ước tính: chi tiết = thu nhập − Σ giá vốn công thức × SL − đóng gói;
   nhanh = thu nhập × (1 − tỉ lệ giá vốn bình quân của phân loại, từ đơn chi tiết 90 ngày gần nhất) − đóng gói. Số liệu từ view finance_offline_facts. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/finance/reconcile";
import { errText, money, packagingCost, productTypeNames, todayVN, type Catalog } from "@/lib/finance/catalog";
import { Combo, type ComboOpt } from "@/components/admin/finance/Combo";
import { categoryOpts, useCatalog } from "@/components/admin/finance/useCatalog";
import { Badge, Button, Card, EmptyState, Field, Input, Message, Select, Textarea, confirmDialog, cx } from "@/components/admin/ui";

type Fact = { id: string; order_date: string; channel: string; customer: string | null; mode: "quick" | "detail"; amount: number; category_id: string | null; packaging: boolean; note: string | null; created_at: string;
  cogs: number; cogs_estimated: boolean; no_ratio: boolean; packaging_cost: number; profit: number };
type LineRow = { id?: string; order_id?: string; recipe_id: string | null; label: string | null; category_id: string | null; qty: number; amount: number; sort_order?: number };
const CHANNELS = ["Facebook", "Zalo", "Instagram", "Trực tiếp", "Khác"];
const numIn = (s: string) => { const v = Number(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const day = (s: string) => new Date(s).toLocaleDateString("vi-VN");

export function NgoaiSan() {
  const C = useCatalog();
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [form, setForm] = useState<{ fact: Fact | null; lines: LineRow[]; copy?: boolean } | null>(null);
  const [view, setView] = useState<Fact | null>(null);
  const [flt, setFlt] = useState({ from: "", to: "", channel: "", cat: null as string | null });
  const load = useCallback(async () => {
    const sb = createClient();
    try {
      const [f, l] = await Promise.all([
        fetchAll<Fact>((a, b) => sb.from("finance_offline_facts").select("*").order("order_date", { ascending: false }).order("created_at", { ascending: false }).range(a, b)),
        fetchAll<LineRow>((a, b) => sb.from("offline_order_lines").select("*").order("sort_order").range(a, b)),
      ]);
      setFacts(f); setLines(l);
    } catch (e) { C.setErr(errText(e instanceof Error ? e.message : String(e)).replace("migration_finance_costs", "migration_finance_offline")); setFacts([]); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); productTypeNames(createClient()).then((t) => setTypes(t.cd)); }, [load]);
  const cat = C.cat;
  const linesOf = useMemo(() => { const m = new Map<string, LineRow[]>(); for (const l of lines) if (l.order_id) m.set(l.order_id, [...(m.get(l.order_id) ?? []), l]); return m; }, [lines]);
  const channels = useMemo(() => [...new Set([...CHANNELS, ...(facts ?? []).map((f) => f.channel)])], [facts]);
  const catName = (id: string | null) => cat?.categories.find((c) => c.id === id)?.name ?? "—";
  const lineName = (l: LineRow) => (l.recipe_id ? cat?.recipes.find((r) => r.id === l.recipe_id)?.name : null) ?? l.label ?? "—";
  const what = (f: Fact) => (f.mode === "detail" ? (linesOf.get(f.id) ?? []).map((l) => `${lineName(l)}${l.qty !== 1 ? ` ×${l.qty}` : ""}`).join(" · ") : catName(f.category_id));
  const shown = (facts ?? []).filter((f) => (!flt.from || f.order_date >= flt.from) && (!flt.to || f.order_date <= flt.to) && (!flt.channel || f.channel === flt.channel) && (!flt.cat || f.category_id === flt.cat || (linesOf.get(f.id) ?? []).some((l) => l.category_id === flt.cat)));
  const sum = shown.reduce((a, f) => ({ amount: a.amount + Number(f.amount), cogs: a.cogs + Number(f.cogs) + Number(f.packaging_cost), profit: a.profit + Number(f.profit) }), { amount: 0, cogs: 0, profit: 0 });
  // tỉ lệ giá vốn bình quân theo phân loại (đơn chi tiết 90 ngày gần nhất) — xem trước lãi cho Nhập nhanh
  const ratio = useMemo(() => {
    const lim = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), m = new Map<string, { c: number; a: number }>();
    for (const f of facts ?? []) if (f.mode === "detail" && f.order_date >= lim) { const k = f.category_id ?? ""; const v = m.get(k) ?? { c: 0, a: 0 }; v.c += Number(f.cogs); v.a += Number(f.amount); m.set(k, v); }
    return (id: string | null) => { const v = m.get(id ?? ""); return v && v.a ? v.c / v.a : null; };
  }, [facts]);

  async function remove(f: Fact) {
    if (!await confirmDialog(`Xoá đơn ngày ${day(f.order_date)} · ${money(Number(f.amount))}?`, { danger: true, ok: "Xoá" })) return;
    const { error } = await createClient().from("offline_orders").delete().eq("id", f.id);
    if (error) C.setErr(errText(error.message)); else { setView(null); await load(); }
  }
  return (
    <div className="space-y-4">
      {C.err && <Message msg={{ type: "err", text: C.err }} />}
      <div className="flex flex-wrap items-end gap-2">
        <Button icon={<Plus size={16} />} onClick={() => setForm({ fact: null, lines: [] })} disabled={!cat}>Thêm đơn</Button>
        <span className="flex-1" />
        <label className="text-[12px] text-[#71717a]">Từ ngày<Input type="date" value={flt.from} onChange={(e) => setFlt((x) => ({ ...x, from: e.target.value }))} className="w-auto" /></label>
        <label className="text-[12px] text-[#71717a]">Đến ngày<Input type="date" value={flt.to} onChange={(e) => setFlt((x) => ({ ...x, to: e.target.value }))} className="w-auto" /></label>
        <label className="text-[12px] text-[#71717a]">Kênh<Select value={flt.channel} onChange={(e) => setFlt((x) => ({ ...x, channel: e.target.value }))} className="w-auto"><option value="">Tất cả</option>{channels.map((c) => <option key={c}>{c}</option>)}</Select></label>
        {cat && <label className="min-w-[150px] text-[12px] text-[#71717a]">Phân loại<Combo value={flt.cat} options={categoryOpts(cat)} onChange={(id) => setFlt((x) => ({ ...x, cat: id }))} placeholder="Tất cả" allowClear /></label>}
      </div>
      <p className="text-[13px] text-[#52525b]">{shown.length} đơn · Thu nhập <b className="text-[#18181b]">{money(sum.amount)}</b> · Giá vốn + đóng gói {money(sum.cogs)} · Lãi ước tính <b className={sum.profit < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}>{money(sum.profit)}</b></p>
      <Card padded={false}>
        {facts === null ? <p className="p-4 text-[13px] text-[#71717a]">Đang tải...</p> : shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-[#71717a]"><tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium"><th>Ngày</th><th className="max-md:hidden">Kênh</th><th className="max-md:hidden">Khách</th><th className="max-md:hidden">Sản phẩm / phân loại</th><th className="text-right">Thu nhập</th><th className="text-right max-md:hidden">Giá vốn</th><th className="text-right max-md:hidden">Lãi ước tính</th><th /></tr></thead>
              <tbody className="divide-y divide-[#efeff1]">
                {shown.map((f) => (
                  <tr key={f.id} className="align-top [&>td]:px-3 [&>td]:py-2">
                    <td className="whitespace-nowrap">{day(f.order_date)}</td>
                    <td className="max-md:hidden">{f.channel}</td>
                    <td className="max-w-[140px] truncate max-md:hidden">{f.customer ?? "—"}</td>
                    <td className="max-w-[280px] max-md:hidden"><span className="line-clamp-2">{what(f)}</span>{f.mode === "quick" && <Badge>Nhập nhanh</Badge>}</td>
                    <td className="whitespace-nowrap text-right font-medium tabular-nums">{money(Number(f.amount))}</td>
                    <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{money(Number(f.cogs))}{Number(f.packaging_cost) > 0 && <span className="block text-[11px] text-[#a1a1aa]">+ đóng gói {money(Number(f.packaging_cost))}</span>}</td>
                    <td className={cx("whitespace-nowrap text-right tabular-nums max-md:hidden", Number(f.profit) < 0 && "text-[#dc2626]")}>{money(Number(f.profit))}{f.cogs_estimated && <span className="block text-[11px] text-[#d97706]">{f.no_ratio ? "chưa có tỉ lệ" : "ước tính"}</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" onClick={() => setView(f)} aria-label="Xem chi tiết" className="p-1 text-[#71717a] hover:text-[#ff5fa2] md:hidden"><Eye size={15} /></button>
                      <span className="max-md:hidden">
                        <button type="button" onClick={() => setForm({ fact: f, lines: linesOf.get(f.id) ?? [] })} aria-label="Sửa" className="p-1 text-[#71717a] hover:text-[#ff5fa2]"><Pencil size={14} /></button>
                        <button type="button" onClick={() => setForm({ fact: f, lines: linesOf.get(f.id) ?? [], copy: true })} aria-label="Nhân bản" className="p-1 text-[#71717a] hover:text-[#ff5fa2]"><Copy size={14} /></button>
                        <button type="button" onClick={() => remove(f)} aria-label="Xoá" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-5"><EmptyState>{facts.length ? "Không có đơn khớp bộ lọc." : "Chưa có đơn ngoài sàn — bấm “Thêm đơn”."}</EmptyState></div>}
      </Card>

      {view && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-3" role="dialog" aria-modal onClick={() => setView(null)}>
          <div className="w-full max-w-[460px] rounded-[12px] bg-white p-5 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center"><p className="flex-1 text-[15px] font-semibold">{day(view.order_date)} · {view.channel}</p><button type="button" onClick={() => setView(null)} aria-label="Đóng" className="p-1"><X size={16} /></button></div>
            <p className="text-[#52525b]">{view.customer ?? "Khách"} · {what(view)}</p>
            <div className="my-3 space-y-1">
              <p className="flex justify-between"><span>Thu nhập</span><b>{money(Number(view.amount))}</b></p>
              <p className="flex justify-between"><span>Giá vốn{view.cogs_estimated ? " (ước tính)" : ""}</span><span>{money(Number(view.cogs))}</span></p>
              <p className="flex justify-between"><span>Đóng gói</span><span>{money(Number(view.packaging_cost))}</span></p>
              <p className="flex justify-between"><span>Lãi ước tính</span><b className={Number(view.profit) < 0 ? "text-[#dc2626]" : ""}>{money(Number(view.profit))}</b></p>
            </div>
            {view.note && <p className="mb-3 text-[#71717a]">{view.note}</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => { setForm({ fact: view, lines: linesOf.get(view.id) ?? [] }); setView(null); }}>Sửa</Button>
              <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => { setForm({ fact: view, lines: linesOf.get(view.id) ?? [], copy: true }); setView(null); }}>Nhân bản</Button>
              <Button size="sm" variant="secondary" icon={<Trash2 size={14} />} onClick={() => remove(view)}>Xoá</Button>
            </div>
          </div>
        </div>
      )}
      {form && cat && <OrderForm cat={cat} init={form} channels={channels} types={types} ratio={ratio} newCategory={C.newCategory} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await load(); }} setErr={C.setErr} />}
    </div>
  );
}

// ---------- form thêm / sửa / nhân bản ----------
function OrderForm({ cat, init, channels, types, ratio, newCategory, onClose, onSaved, setErr }: {
  cat: Catalog; init: { fact: Fact | null; lines: LineRow[]; copy?: boolean }; channels: string[]; types: string[]; ratio: (id: string | null) => number | null;
  newCategory: (n: string) => Promise<string | null>; onClose: () => void; onSaved: () => Promise<void>; setErr: (s: string) => void;
}) {
  const f0 = init.fact, cd = cat.categories.find((c) => c.name === "CD")?.id ?? null;
  const [mode, setMode] = useState<"quick" | "detail">(f0?.mode ?? "quick");
  const [date, setDate] = useState(f0 && !init.copy ? f0.order_date : todayVN());
  const [channel, setChannel] = useState(f0?.channel ?? "Facebook");
  const [extraCh, setExtraCh] = useState<string[]>([]);
  const [customer, setCustomer] = useState(f0?.customer ?? "");
  const [amount, setAmount] = useState(f0 ? String(f0.amount) : "");
  const [catId, setCatId] = useState<string | null>(f0?.category_id ?? cd);
  const [pack, setPack] = useState(f0?.packaging ?? true);
  const [note, setNote] = useState(f0?.note ?? "");
  const [ls, setLs] = useState<LineRow[]>(init.lines.length ? init.lines.map((l) => ({ recipe_id: l.recipe_id, label: l.label, category_id: l.category_id, qty: Number(l.qty), amount: Number(l.amount) })) : [{ recipe_id: null, label: null, category_id: cd, qty: 1, amount: 0 }]);
  const [autoTotal, setAutoTotal] = useState(!f0 || f0.mode === "quick");
  const [busy, setBusy] = useState(false);
  const lineSum = ls.reduce((a, l) => a + (Number(l.amount) || 0), 0);
  const total = mode === "detail" && autoTotal ? lineSum : numIn(amount);
  // combobox Sản phẩm / Công thức: công thức giá vốn + Loại sản phẩm CD (chưa có công thức) + tự gõ
  const prodOpts: ComboOpt[] = [...cat.recipes.map((r) => ({ id: `r:${r.id}`, label: r.name, hint: money(cat.recipeCosts.get(r.id)?.cost ?? 0) })),
    ...types.filter((t) => !cat.recipes.some((r) => r.name.toLowerCase() === t.toLowerCase())).map((t) => ({ id: `t:${t}`, label: t, hint: "chưa có công thức" })),
    ...ls.filter((l) => !l.recipe_id && l.label && !types.includes(l.label)).map((l) => ({ id: `t:${l.label}`, label: l.label! }))];
  const pk = pack ? packagingCost(cat) : 0;
  const cogs = mode === "detail" ? ls.reduce((a, l) => a + (l.recipe_id ? (cat.recipeCosts.get(l.recipe_id)?.cost ?? 0) * (Number(l.qty) || 0) : 0), 0) : total * (ratio(catId) ?? 0);
  const profit = total - cogs - pk;
  const setLine = (i: number, v: Partial<LineRow>) => setLs((x) => x.map((l, j) => (j === i ? { ...l, ...v } : l)));
  async function save() {
    if (!(total > 0)) return setErr("Nhập số tiền nhận được.");
    setBusy(true); setErr("");
    const sb = createClient();
    const lines = mode === "detail" ? ls.filter((l) => l.recipe_id || l.label || l.amount) : [];
    const row = { order_date: date, channel: channel.trim() || "Khác", customer: customer.trim() || null, mode, amount: total, category_id: mode === "detail" ? lines[0]?.category_id ?? catId : catId, packaging: pack, note: note.trim() || null, updated_at: new Date().toISOString() };
    const editing = f0 && !init.copy;
    const r = editing ? await sb.from("offline_orders").update(row).eq("id", f0.id).select("id").single() : await sb.from("offline_orders").insert(row).select("id").single();
    if (r.error) { setErr(errText(r.error.message)); setBusy(false); return; }
    const id = r.data.id as string;
    if (editing) await sb.from("offline_order_lines").delete().eq("order_id", id);
    if (lines.length) {
      const { error } = await sb.from("offline_order_lines").insert(lines.map((l, i) => ({ order_id: id, recipe_id: l.recipe_id, label: l.recipe_id ? null : l.label, category_id: l.category_id, qty: Number(l.qty) || 1, amount: Number(l.amount) || 0, sort_order: i })));
      if (error) { setErr(errText(error.message)); setBusy(false); return; }
    }
    setBusy(false); await onSaved();
  }
  const chOpts: ComboOpt[] = [...channels, ...extraCh].map((c) => ({ id: c, label: c }));
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-3" role="dialog" aria-modal onClick={onClose}>
      <div className="max-h-[94dvh] w-full max-w-[720px] overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center"><p className="flex-1 text-[16px] font-semibold">{f0 && !init.copy ? "Sửa đơn" : init.copy ? "Nhân bản đơn" : "Thêm đơn ngoài sàn"}</p><button type="button" onClick={onClose} aria-label="Đóng" className="p-1"><X size={18} /></button></div>
        <div className="mb-4 flex gap-1 border-b border-[#e5e5e7]">
          {([["quick", "Nhập nhanh"], ["detail", "Nhập chi tiết"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={cx("-mb-px border-b-2 px-3 py-2 text-[14px] font-medium", mode === k ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-transparent text-[#52525b]")}>{l}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Ngày"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Kênh"><Combo value={channel} options={chOpts} onChange={(id) => id && setChannel(id)} onCreate={(t) => { setExtraCh((x) => [...x, t]); return t; }} /></Field>
          {mode === "quick"
            ? <Field label="Phân loại"><Combo value={catId} options={categoryOpts(cat)} onChange={setCatId} onCreate={newCategory} /></Field>
            : <Field label="Tên khách (không bắt buộc)"><Input value={customer} onChange={(e) => setCustomer(e.target.value)} /></Field>}
        </div>
        {mode === "detail" && (
          <div className="mt-4 space-y-2">
            <p className="text-[13px] font-semibold">Sản phẩm</p>
            {ls.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-[10px] border border-[#efeff1] p-2 sm:grid-cols-[2fr_1.2fr_70px_120px_auto] sm:items-center sm:border-0 sm:p-0">
                <Combo className="col-span-2 sm:col-span-1" value={l.recipe_id ? `r:${l.recipe_id}` : l.label ? `t:${l.label}` : null} options={prodOpts} placeholder="Sản phẩm hoặc công thức"
                  onChange={(id) => { if (!id) return; if (id.startsWith("r:")) { const r = cat.recipes.find((x) => x.id === id.slice(2)); setLine(i, { recipe_id: id.slice(2), label: null, category_id: r?.category_id ?? l.category_id }); } else setLine(i, { recipe_id: null, label: id.slice(2) }); }}
                  onCreate={(t) => { setLine(i, { recipe_id: null, label: t }); return `t:${t}`; }} />
                <Combo value={l.category_id} options={categoryOpts(cat)} onChange={(id) => setLine(i, { category_id: id })} onCreate={newCategory} placeholder="Phân loại" />
                <Input inputMode="decimal" value={String(l.qty)} onChange={(e) => setLine(i, { qty: Number(e.target.value.replace(",", ".")) || 0 })} aria-label="Số lượng" />
                <Input inputMode="numeric" value={l.amount ? String(l.amount) : ""} placeholder="Thành tiền" onChange={(e) => setLine(i, { amount: numIn(e.target.value) })} />
                <button type="button" onClick={() => setLs((x) => x.filter((_, j) => j !== i))} aria-label="Bỏ dòng" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
              </div>
            ))}
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setLs((x) => [...x, { recipe_id: null, label: null, category_id: cd, qty: 1, amount: 0 }])}>Thêm dòng</Button>
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={mode === "quick" ? "Số tiền nhận được (đã trừ phí ship)" : "Tổng tiền (tự cộng, sửa được)"}>
            <Input inputMode="numeric" value={mode === "detail" && autoTotal ? String(lineSum || "") : amount} onChange={(e) => { setAutoTotal(false); setAmount(e.target.value); }} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-[#52525b]"><input type="checkbox" className="accent-[#ff5fa2]" checked={pack} onChange={(e) => setPack(e.target.checked)} /> Có đóng gói ({money(packagingCost(cat))})</label>
          <Field label="Ghi chú" className="sm:col-span-2"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="mt-4 rounded-[10px] bg-[#fafafa] p-3 text-[13px]">
          <p className="flex justify-between"><span>Thu nhập</span><b>{money(total)}</b></p>
          <p className="flex justify-between"><span>Giá vốn{mode === "quick" ? " (ước tính theo tỉ lệ phân loại)" : ""}</span><span>{money(cogs)}</span></p>
          <p className="flex justify-between"><span>Đóng gói</span><span>{money(pk)}</span></p>
          <p className="flex justify-between"><span>Lãi ước tính{mode === "quick" && <Badge tone="amber">ước tính</Badge>}</span><b className={profit < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}>{money(profit)}</b></p>
          {mode === "quick" && ratio(catId) === null && <p className="mt-1 text-[12px] text-[#d97706]">Chưa có đơn nhập chi tiết của phân loại này trong 90 ngày — giá vốn tạm tính 0.</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button loading={busy} onClick={save}>Lưu</Button></div>
      </div>
    </div>
  );
}
