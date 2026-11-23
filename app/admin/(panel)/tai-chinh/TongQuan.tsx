"use client";
/* Tài chính → Tổng quan (chỉ admin): số liệu tính bằng hàm RPC trên Supabase (finance_summary, finance_by_type, finance_by_channel,
   finance_alerts, finance_facts), trình duyệt chỉ vẽ biểu đồ (SVG) + xuất Excel (SheetJS).
   Kỳ xem: Tuần · Tháng · Quý · Năm · Tuỳ chọn (‹ ›) · Kênh · Phân loại · ngày tính đơn Shopee (thanh toán / đặt hàng). */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, SlidersHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errText, money, saveSetting, todayVN, type Category } from "@/lib/finance/catalog";
import { Badge, Button, Card, Input, Message, cx } from "@/components/admin/ui";

type Unit = "week" | "month" | "quarter" | "year" | "custom";
type Group = "day" | "week" | "month";
type Sum = { bucket: string; income: number; shopee_revenue: number; shopee_fee: number; shopee_orders: number; offline_orders: number; material: number; cogs: number; packaging: number; profit: number; untracked: number };
type Agg = { label: string; orders: number; revenue: number; fee: number; income: number; cogs: number; packaging: number; profit: number; tracked_income: number };
type Alerts = { pending: number; mismatch: number; wallet_only: number; unknown_lines: number; profit_start: string | null };

// ---------- kỳ xem (ngày theo giờ VN, tuần bắt đầu thứ Hai) ----------
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function rangeOf(unit: Exclude<Unit, "custom">, anchor: Date): [Date, Date] {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  if (unit === "week") { const s = addDays(anchor, -((anchor.getDay() + 6) % 7)); return [s, addDays(s, 6)]; }
  if (unit === "month") return [new Date(y, m, 1), new Date(y, m + 1, 0)];
  if (unit === "quarter") { const q = Math.floor(m / 3) * 3; return [new Date(y, q, 1), new Date(y, q + 3, 0)]; }
  return [new Date(y, 0, 1), new Date(y, 11, 31)];
}
const shift = (unit: Exclude<Unit, "custom">, a: Date, k: number) => (unit === "week" ? addDays(a, 7 * k) : unit === "month" ? new Date(a.getFullYear(), a.getMonth() + k, 1) : unit === "quarter" ? new Date(a.getFullYear(), a.getMonth() + 3 * k, 1) : new Date(a.getFullYear() + k, 0, 1));
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
function labelOf(unit: Unit, f: Date, t: Date) {
  if (unit === "week") return `Tuần ${ddmm(f)} – ${ddmm(t)}/${t.getFullYear()}`;
  if (unit === "month") return `Tháng ${f.getMonth() + 1}/${f.getFullYear()}`;
  if (unit === "quarter") return `Quý ${Math.floor(f.getMonth() / 3) + 1}/${f.getFullYear()}`;
  if (unit === "year") return `Năm ${f.getFullYear()}`;
  return `${ddmm(f)}/${f.getFullYear()} – ${ddmm(t)}/${t.getFullYear()}`;
}
const groupOf = (unit: Unit, f: Date, t: Date): Group => (unit === "year" || unit === "quarter" ? "month" : unit === "month" ? "week" : unit === "week" ? "day"
  : (t.getTime() - f.getTime()) / 86400000 <= 31 ? "day" : (t.getTime() - f.getTime()) / 86400000 <= 120 ? "week" : "month");
const bucketLabel = (g: Group, s: string) => { const d = parse(s); return g === "month" ? `T${d.getMonth() + 1}` : g === "week" ? `Tuần ${ddmm(d)}` : ddmm(d); };
const pctTxt = (v: number | null) => (v === null || !Number.isFinite(v) ? "—" : `${(v * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`);
const change = (cur: number, prev: number) => (prev ? (cur - prev) / Math.abs(prev) : null);
const N = (v: unknown) => Number(v) || 0;

export function TongQuan() {
  const sb = createClient();
  const [unit, setUnit] = useState<Unit>("month");
  const [anchor, setAnchor] = useState(() => parse(todayVN()));
  const [custom, setCustom] = useState({ from: iso(addDays(parse(todayVN()), -29)), to: todayVN() });
  const [channel, setChannel] = useState<"all" | "shopee" | "offline">("all");
  const [cat, setCat] = useState<string>("");
  const [dateField, setDateField] = useState<"paid" | "order_date">("paid");
  const [cats, setCats] = useState<Category[]>([]);
  const [data, setData] = useState<{ cur: Sum[]; prev: Sum[]; types: Agg[]; chans: Agg[] } | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [startSet, setStartSet] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fOpen, setFOpen] = useState(false);

  const [from, to] = useMemo<[Date, Date]>(() => (unit === "custom" ? [parse(custom.from), parse(custom.to)] : rangeOf(unit, anchor)), [unit, anchor, custom]);
  const [pf, pt] = useMemo<[Date, Date]>(() => { if (unit !== "custom") return rangeOf(unit, shift(unit, anchor, -1)); const n = Math.round((to.getTime() - from.getTime()) / 86400000) + 1; return [addDays(from, -n), addDays(from, -1)]; }, [unit, anchor, from, to]);
  const group = groupOf(unit, from, to);
  const args = (f: Date, t: Date) => ({ p_from: iso(f), p_to: iso(t), p_channel: channel, p_category: cat || null, p_date_field: dateField });

  useEffect(() => {
    sb.from("finance_categories").select("*").order("sort_order").then(({ data }) => setCats((data ?? []) as Category[]));
    sb.from("finance_settings").select("value").eq("key", "profit_start").maybeSingle().then(({ data }) => setStartSet(((data?.value as { date?: string | null } | undefined)?.date) ?? null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const loadAlerts = () => sb.rpc("finance_alerts").then(({ data, error }) => { if (error) setErr(errText(error.message).replace("migration_finance_costs", "migration_finance_overview")); else setAlerts(((data ?? []) as Alerts[])[0] ?? null); });
  useEffect(() => { loadAlerts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let off = false;
    (async () => {
      const [c, p, t, ch] = await Promise.all([
        sb.rpc("finance_summary", { ...args(from, to), p_group: group }), sb.rpc("finance_summary", { ...args(pf, pt), p_group: group }),
        sb.rpc("finance_by_type", args(from, to)), sb.rpc("finance_by_channel", args(from, to)),
      ]);
      const e = c.error ?? p.error ?? t.error ?? ch.error;
      if (off) return;
      if (e) { setErr(errText(e.message).replace("migration_finance_costs", "migration_finance_overview")); return; }
      setErr(""); setData({ cur: (c.data ?? []) as Sum[], prev: (p.data ?? []) as Sum[], types: (t.data ?? []) as Agg[], chans: (ch.data ?? []) as Agg[] });
    })();
    return () => { off = true; };
  }, [from, to, pf, pt, group, channel, cat, dateField]); // eslint-disable-line react-hooks/exhaustive-deps

  const tot = (rows: Sum[]) => rows.reduce((a, r) => { for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] += N(r[k]); return a; },
    { income: 0, shopee_revenue: 0, shopee_fee: 0, shopee_orders: 0, offline_orders: 0, material: 0, cogs: 0, packaging: 0, profit: 0, untracked: 0 });
  const T = tot(data?.cur ?? []), P = tot(data?.prev ?? []);
  const cash = T.income - T.material, cashP = P.income - P.material;

  async function setStart(v: string | null) {
    try { await saveSetting(sb, "profit_start", { date: v }); setStartSet(v); await loadAlerts(); setAnchor((a) => new Date(a)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function exportXlsx() {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const { data: rows, error } = await sb.rpc("finance_facts", args(from, to));
      if (error) throw new Error(error.message);
      const wb = XLSX.utils.book_new();
      const add = (name: string, a: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(a.length ? a : [{ "": "Không có dữ liệu" }]), name);
      add("Tổng hợp", [
        { "Chỉ số": "Kỳ", "Giá trị": labelOf(unit, from, to) }, { "Chỉ số": "Thu nhập", "Giá trị": T.income }, { "Chỉ số": "Doanh thu Shopee", "Giá trị": T.shopee_revenue },
        { "Chỉ số": "Phí sàn Shopee", "Giá trị": T.shopee_fee }, { "Chỉ số": "Số đơn Shopee", "Giá trị": T.shopee_orders }, { "Chỉ số": "Số đơn ngoài sàn", "Giá trị": T.offline_orders },
        { "Chỉ số": "Chi nguyên liệu thực tế", "Giá trị": T.material }, { "Chỉ số": "Giá vốn ước tính", "Giá trị": T.cogs }, { "Chỉ số": "Đóng gói ước tính", "Giá trị": T.packaging },
        { "Chỉ số": "Lãi ước tính", "Giá trị": T.profit }, { "Chỉ số": "Dòng tiền thực", "Giá trị": cash },
      ]);
      add("Theo kỳ", (data?.cur ?? []).map((r) => ({ "Kỳ": bucketLabel(group, r.bucket), "Thu nhập": N(r.income), "Doanh thu Shopee": N(r.shopee_revenue), "Phí sàn": N(r.shopee_fee), "Đơn Shopee": N(r.shopee_orders), "Đơn ngoài sàn": N(r.offline_orders), "Chi nguyên liệu": N(r.material), "Giá vốn": N(r.cogs), "Đóng gói": N(r.packaging), "Lãi ước tính": N(r.profit) })));
      const agg = (a: Agg[]) => a.map((r) => ({ "Loại / kênh": r.label, "Số đơn": N(r.orders), "Doanh thu": N(r.revenue), "Phí sàn": N(r.fee), "Thu nhập": N(r.income), "Giá vốn": N(r.cogs), "Đóng gói": N(r.packaging), "Lãi ước tính": N(r.profit), "Biên lãi %": N(r.tracked_income) ? Math.round((N(r.profit) / N(r.tracked_income)) * 1000) / 10 : null }));
      add("Theo loại", agg(data?.types ?? [])); add("Theo kênh", agg(data?.chans ?? []));
      add("Chi tiết đơn", ((rows ?? []) as Record<string, unknown>[]).map((r) => ({ "Kênh": r.sub_channel, "Mã đơn": r.channel === "shopee" ? r.ref : "", "Ngày": r.day, "Khách": r.customer, "Loại": r.recipe_name ?? r.category_name ?? "Chưa rõ loại",
        "Thu nhập": N(r.income), "Ước tính": r.income_estimated ? "có" : "", "Doanh thu": N(r.revenue), "Phí sàn": N(r.fee), "Giá vốn": N(r.cogs), "Đóng gói": N(r.packaging), "Lãi ước tính": r.tracked ? N(r.profit) : "trước kỳ theo dõi chi phí", "Đối chiếu": r.status })));
      XLSX.writeFile(wb, `tai-chinh-${iso(from)}_${iso(to)}.xlsx`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  const nF = Number(channel !== "all") + Number(!!cat) + Number(dateField !== "paid");
  const chip = (on: boolean) => cx("h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  const nextYear = `${new Date().getFullYear() + 1}-01-01`;
  return (
    <div className="space-y-4">
      {/* ---------- bộ lọc ---------- */}
      <div className="space-y-2">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {([["week", "Tuần"], ["month", "Tháng"], ["quarter", "Quý"], ["year", "Năm"], ["custom", "Tuỳ chọn khoảng ngày"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setUnit(k)} className={chip(unit === k)}>{l}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unit === "custom" ? (
            <><Input type="date" value={custom.from} onChange={(e) => setCustom((x) => ({ ...x, from: e.target.value }))} className="w-auto" /><span>–</span><Input type="date" value={custom.to} onChange={(e) => setCustom((x) => ({ ...x, to: e.target.value }))} className="w-auto" /></>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[#e5e5e7] bg-white">
              <button type="button" onClick={() => setAnchor((a) => shift(unit, a, -1))} aria-label="Kỳ trước" className="grid h-8 w-8 place-items-center"><ChevronLeft size={16} /></button>
              <span className="min-w-[150px] text-center text-[13px] font-semibold">{labelOf(unit, from, to)}</span>
              <button type="button" onClick={() => setAnchor((a) => shift(unit, a, 1))} aria-label="Kỳ sau" className="grid h-8 w-8 place-items-center"><ChevronRight size={16} /></button>
            </span>
          )}
          <button type="button" onClick={() => setFOpen(true)} aria-label="Bộ lọc" title="Bộ lọc"
            className={cx("relative grid h-8 w-8 place-items-center rounded-full border bg-white", nF ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]")}>
            <SlidersHorizontal size={15} />
            {nF > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff5fa2] px-1 text-[10px] font-bold text-white">{nF}</span>}
          </button>
          <span className="flex-1" />
          <Button variant="secondary" size="sm" icon={<Download size={14} />} loading={busy} onClick={exportXlsx}>Xuất Excel</Button>
        </div>
      </div>
      {err && <Message msg={{ type: "err", text: err }} />}
      {fOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-3" role="dialog" aria-modal onClick={() => setFOpen(false)}>
          <div className="w-full max-w-[380px] space-y-4 rounded-[12px] bg-white p-5 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center"><p className="flex-1 text-[16px] font-semibold">Bộ lọc</p><button type="button" onClick={() => setFOpen(false)} aria-label="Đóng" className="p-1"><X size={18} /></button></div>
            <div><p className="mb-1.5 font-medium">Kênh</p><div className="flex flex-wrap gap-1.5">
              {([["all", "Tất cả"], ["shopee", "Shopee"], ["offline", "Ngoài sàn"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setChannel(k)} className={chip(channel === k)}>{l}</button>)}</div></div>
            <div><p className="mb-1.5 font-medium">Phân loại</p><div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCat("")} className={chip(!cat)}>Tất cả</button>
              {cats.map((c) => <button key={c.id} type="button" onClick={() => setCat(c.id)} className={chip(cat === c.id)}>{c.name}</button>)}</div></div>
            <div><p className="mb-1.5 font-medium">Tính đơn Shopee theo</p><div className="flex flex-wrap gap-1.5">
              {([["paid", "Ngày hoàn thành thanh toán"], ["order_date", "Ngày đặt hàng"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setDateField(k)} className={chip(dateField === k)}>{l}</button>)}</div></div>
            <div className="flex justify-between gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => { setChannel("all"); setCat(""); setDateField("paid"); }}>Đặt lại</Button>
              <Button size="sm" onClick={() => setFOpen(false)}>Xong</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- cảnh báo dữ liệu ---------- */}
      {alerts && (N(alerts.pending) > 0 || N(alerts.mismatch) > 0 || N(alerts.unknown_lines) > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[13px] text-[#92400e]">
          <AlertTriangle size={15} />
          {N(alerts.pending) > 0 && <Link href="/admin/tai-chinh/don-shopee" className="hover:underline">{N(alerts.pending)} đơn Chờ về ví</Link>}
          {N(alerts.mismatch) > 0 && <Link href="/admin/tai-chinh/don-shopee" className="hover:underline">{N(alerts.mismatch)} đơn Lệch tiền</Link>}
          {N(alerts.unknown_lines) > 0 && <Link href="/admin/tai-chinh/cong-thuc" className="hover:underline">{N(alerts.unknown_lines)} dòng sản phẩm Chưa rõ loại → ghép công thức</Link>}
        </div>
      )}

      {/* ---------- thẻ số liệu ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat big label="Thu nhập (thực nhận)" value={T.income} prev={P.income} className="col-span-2" />
        <Stat label="Lãi ước tính" value={T.profit} prev={P.profit} tone={T.profit < 0 ? "red" : "green"} />
        <Stat label="Dòng tiền thực" value={cash} prev={cashP} tone={cash < 0 ? "red" : undefined} hint="Thu nhập − Chi nguyên liệu" />
        <Stat label="Doanh thu Shopee" value={T.shopee_revenue} prev={P.shopee_revenue} hint="giá sản phẩm" />
        <Stat label="Phí sàn Shopee" value={T.shopee_fee} prev={P.shopee_fee} hint={T.shopee_revenue ? `${pctTxt(T.shopee_fee / T.shopee_revenue)} doanh thu` : undefined} invert />
        <Stat label="Số đơn" value={T.shopee_orders + T.offline_orders} prev={P.shopee_orders + P.offline_orders} count hint={`Shopee ${T.shopee_orders} · Ngoài sàn ${T.offline_orders}`} />
        <Stat label="Chi nguyên liệu thực tế" value={T.material} prev={P.material} invert />
        <Stat label="Giá vốn ước tính" value={T.cogs} prev={P.cogs} invert />
        <Stat label="Đóng gói ước tính" value={T.packaging} prev={P.packaging} invert />
      </div>
      <p className="text-[12px] text-[#71717a]">Theo tuần thì lãi là ước tính. Theo tháng, quý, năm thì xem cả Dòng tiền thực để sát hơn.
        {T.untracked > 0 && <> · <b>{T.untracked}</b> đơn trước kỳ theo dõi chi phí (có ở thu nhập, không tính giá vốn / lãi).</>}</p>

      {/* ---------- ngày bắt đầu tính lãi ---------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2 text-[13px]">
        <span className="font-medium">Ngày bắt đầu tính lãi lỗ:</span>
        <span>{alerts?.profit_start ? parse(alerts.profit_start).toLocaleDateString("vi-VN") : "chưa có (chưa nhập nguyên liệu)"}</span>
        {!startSet && <Badge>Lần nhập nguyên liệu đầu tiên</Badge>}
        <Input type="date" value={startSet ?? ""} onChange={(e) => setStart(e.target.value || null)} className="h-8 w-auto" />
        <button type="button" onClick={() => setStart(nextYear)} className="text-[12px] font-medium text-[#ff5fa2]">Từ 01/01/{new Date().getFullYear() + 1}</button>
        {startSet && <button type="button" onClick={() => setStart(null)} className="text-[12px] text-[#52525b]">Về mặc định</button>}
      </div>

      {/* ---------- biểu đồ ---------- */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Thu nhập · Chi nguyên liệu · Lãi ước tính">
          <Bars rows={(data?.cur ?? []).map((r) => ({ label: bucketLabel(group, r.bucket), v: [N(r.income), N(r.material), N(r.profit)] }))} />
        </Card>
        <Card title="% phí sàn Shopee">
          <Line rows={(data?.cur ?? []).map((r) => ({ label: bucketLabel(group, r.bucket), v: N(r.shopee_revenue) ? N(r.shopee_fee) / N(r.shopee_revenue) : null }))} />
        </Card>
      </div>

      {/* ---------- bảng ---------- */}
      <AggTable title="Theo loại sản phẩm" rows={data?.types ?? []} warn />
      <AggTable title="Theo kênh" rows={data?.chans ?? []} />
    </div>
  );
}

function Stat({ label, value, prev, big, hint, tone, count, invert, className }: { label: string; value: number; prev: number; big?: boolean; hint?: string; tone?: "red" | "green"; count?: boolean; invert?: boolean; className?: string }) {
  const c = change(value, prev), good = c === null ? null : invert ? c <= 0 : c >= 0;
  return (
    <div className={cx("rounded-[12px] border border-[#e5e5e7] bg-white p-3", className)}>
      <p className="text-[12px] text-[#71717a]">{label}</p>
      <p className={cx("font-semibold tabular-nums", big ? "text-[28px] leading-tight" : "text-[18px]", tone === "red" && "text-[#dc2626]", tone === "green" && "text-[#16a34a]")}>{count ? value.toLocaleString("vi-VN") : money(value)}</p>
      <p className="text-[11px] text-[#a1a1aa]">
        {c !== null && <span className={good ? "text-[#16a34a]" : "text-[#dc2626]"}>{c >= 0 ? "▲" : "▼"} {pctTxt(Math.abs(c))} </span>}
        {c === null ? "kỳ trước: —" : "so với kỳ trước"}{hint ? ` · ${hint}` : ""}
      </p>
    </div>
  );
}

const COLORS = ["#ff5fa2", "#a1a1aa", "#16a34a"];
/** biểu đồ cột nhóm (SVG) — cuộn ngang trên điện thoại */
function Bars({ rows }: { rows: { label: string; v: number[] }[] }) {
  if (!rows.length) return <p className="py-8 text-center text-[13px] text-[#a1a1aa]">Chưa có dữ liệu trong kỳ.</p>;
  const H = 200, gw = 54, W = Math.max(320, rows.length * gw + 40);
  const max = Math.max(1, ...rows.flatMap((r) => r.v)), min = Math.min(0, ...rows.flatMap((r) => r.v));
  const y = (v: number) => 10 + ((max - v) / (max - min)) * (H - 30);
  return (
    <div>
      <div className="mb-2 flex gap-3 text-[12px] text-[#52525b]">{["Thu nhập", "Chi nguyên liệu", "Lãi ước tính"].map((l, i) => <span key={l} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />{l}</span>)}</div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          <line x1={30} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e5e7" />
          {rows.map((r, i) => (
            <g key={i} transform={`translate(${36 + i * gw},0)`}>
              {r.v.map((v, j) => <rect key={j} x={j * 14} y={Math.min(y(v), y(0))} width={12} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={2} fill={COLORS[j]}><title>{money(v)}</title></rect>)}
              <text x={20} y={H - 4} textAnchor="middle" fontSize={10} fill="#71717a">{r.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
/** biểu đồ đường % (SVG) */
function Line({ rows }: { rows: { label: string; v: number | null }[] }) {
  const pts = rows.filter((r) => r.v !== null);
  if (!pts.length) return <p className="py-8 text-center text-[13px] text-[#a1a1aa]">Chưa có đơn Shopee trong kỳ.</p>;
  const H = 200, gw = 54, W = Math.max(280, rows.length * gw + 40), max = Math.max(0.05, ...pts.map((r) => r.v!)) * 1.15;
  const x = (i: number) => 40 + i * gw, y = (v: number) => 10 + (1 - v / max) * (H - 30);
  const path = rows.map((r, i) => (r.v === null ? null : `${x(i)},${y(r.v)}`)).filter(Boolean).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        <line x1={30} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e5e7" />
        <polyline points={path} fill="none" stroke="#ff5fa2" strokeWidth={2} />
        {rows.map((r, i) => (
          <g key={i}>
            {r.v !== null && <><circle cx={x(i)} cy={y(r.v)} r={3.5} fill="#ff5fa2" /><text x={x(i)} y={y(r.v) - 8} textAnchor="middle" fontSize={10} fill="#3f3f46">{pctTxt(r.v)}</text></>}
            <text x={x(i)} y={H - 4} textAnchor="middle" fontSize={10} fill="#71717a">{r.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AggTable({ title, rows, warn }: { title: string; rows: Agg[]; warn?: boolean }) {
  return (
    <Card title={title} padded={false}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[12px] text-[#71717a]"><tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>{warn ? "Loại / công thức" : "Kênh"}</th><th className="text-right max-md:hidden">Số đơn</th><th className="text-right max-md:hidden">Doanh thu</th><th className="text-right max-md:hidden">Phí sàn %</th>
              <th className="text-right">Thu nhập</th><th className="text-right max-md:hidden">Giá vốn</th><th className="text-right">Lãi ước tính</th><th className="text-right max-md:hidden">Biên lãi</th></tr></thead>
            <tbody className="divide-y divide-[#efeff1]">
              {rows.map((r) => {
                const m = N(r.tracked_income) ? N(r.profit) / N(r.tracked_income) : null;
                const bad = warn && m !== null && m < 0, low = warn && m !== null && m >= 0 && m < 0.15;
                return (
                  <tr key={r.label} className={cx("[&>td]:px-3 [&>td]:py-2", bad && "bg-[#fef2f2] text-[#b91c1c]", low && "bg-[#fff7ed] text-[#c2410c]")}>
                    <td className="font-medium">{r.label}{bad && <span className="ml-1 text-[11px]">· nguy cơ lỗ</span>}</td>
                    <td className="text-right tabular-nums max-md:hidden">{N(r.orders)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{money(N(r.revenue))}</td>
                    <td className="text-right tabular-nums max-md:hidden">{N(r.fee) && N(r.revenue) ? pctTxt(N(r.fee) / N(r.revenue)) : "—"}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{money(N(r.income))}</td>
                    <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{money(N(r.cogs) + N(r.packaging))}</td>
                    <td className="whitespace-nowrap text-right font-medium tabular-nums">{money(N(r.profit))}</td>
                    <td className="text-right tabular-nums max-md:hidden">{pctTxt(m)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="p-5 text-center text-[13px] text-[#a1a1aa]">Chưa có dữ liệu trong kỳ.</p>}
    </Card>
  );
}
