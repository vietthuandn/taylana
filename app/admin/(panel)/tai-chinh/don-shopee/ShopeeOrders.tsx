"use client";
/* Tài chính → Đơn Shopee: bảng đơn đã đối chiếu (mã đơn, ngày đặt, ngày thanh toán, người mua, sản phẩm + phân loại, doanh thu, phí sàn, thu nhập, trạng thái).
   Lọc khoảng ngày + trạng thái, tìm mã đơn / người mua · bấm 1 đơn → chi tiết phí + dòng sản phẩm · tab "Rút tiền" (chỉ xem).
   Điện thoại: chỉ Mã đơn, Thu nhập, nút xem chi tiết. */
import { useEffect, useMemo, useState } from "react";
import { Eye, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { REC_LABEL, REC_TONE, fetchAll, reconcile, type OrderRow, type Rec, type RecStatus, type TxRow } from "@/lib/finance/reconcile";
import { Badge, Card, EmptyState, Input, Message, Select, cx } from "@/components/admin/ui";

type Line = { order_sn: string; seq: number; product_name: string | null; variation: string | null; variation_sku: string | null; qty: number | null; price: number | null };
type Item = { order_sn: string; product_id: string; seq: number; product_name: string | null; product_price: number | null; refund: number | null };
const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n).toLocaleString("vi-VN")}đ`);
const day = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");
const dt = (s: string) => new Date(s).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const pct = (n: number | null) => (n === null ? "" : `${(n * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`);
/** ngày (giờ VN) dạng YYYY-MM-DD để lọc */
const ymd = (s: string | null) => (s ? new Date(new Date(s).getTime() + 7 * 3600000).toISOString().slice(0, 10) : "");

export function ShopeeOrders() {
  const [tab, setTab] = useState<"orders" | "withdraw">("orders");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [st, setSt] = useState<RecStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<Rec | null>(null);

  useEffect(() => {
    const sb = createClient();
    (async () => {
      try {
        const [o, t, l] = await Promise.all([
          fetchAll<OrderRow>((a, b) => sb.from("shopee_orders").select("order_sn,order_date,paid_at,buyer,total_paid,product_price,refund,carrier,fees,service_fees").order("order_date", { ascending: false }).range(a, b)),
          fetchAll<TxRow>((a, b) => sb.from("shopee_wallet_tx").select("id,tx_at,tx_type,detail,order_sn,direction,amount,status,balance_after,is_withdrawal").order("tx_at", { ascending: false }).range(a, b)),
          fetchAll<Line>((a, b) => sb.from("shopee_order_lines").select("order_sn,seq,product_name,variation,variation_sku,qty,price").order("order_sn").order("seq").range(a, b)),
        ]);
        setOrders(o); setTx(t); setLines(l);
      } catch (e) { const m = e instanceof Error ? e.message : String(e); setErr(/shopee_|relation|schema cache/.test(m) ? "Chưa có bảng Tài chính — cần chạy supabase/migration_finance_shopee.sql." : m); }
      setReady(true);
    })();
  }, []);

  const recs = useMemo(() => reconcile(orders, tx).sort((a, b) => (b.order?.order_date ?? b.tx[0]?.tx_at ?? "").localeCompare(a.order?.order_date ?? a.tx[0]?.tx_at ?? "")), [orders, tx]);
  const linesBy = useMemo(() => { const m = new Map<string, Line[]>(); for (const l of lines) m.set(l.order_sn, [...(m.get(l.order_sn) ?? []), l]); return m; }, [lines]);
  const dateOf = (r: Rec) => ymd(r.order?.order_date ?? r.tx[0]?.tx_at ?? null);
  const shown = recs.filter((r) => {
    if (st && r.status !== st) return false;
    const d = dateOf(r);
    if (from && (!d || d < from)) return false;
    if (to && (!d || d > to)) return false;
    const k = q.trim().toLowerCase();
    return !k || r.order_sn.toLowerCase().includes(k) || (r.order?.buyer ?? "").toLowerCase().includes(k);
  });
  const sum = shown.reduce((a, r) => ({ revenue: a.revenue + (r.revenue ?? 0), fee: a.fee + r.fee, income: a.income + r.income }), { revenue: 0, fee: 0, income: 0 });
  const withdrawals = tx.filter((t) => t.is_withdrawal);
  const prod = (sn: string) => (linesBy.get(sn) ?? []).map((l) => `${l.product_name ?? ""}${l.variation ? ` · ${l.variation}` : ""}${l.qty && l.qty > 1 ? ` ×${l.qty}` : ""}`);

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[#e5e5e7]">
        {([["orders", `Đơn (${recs.length})`], ["withdraw", `Rút tiền (${withdrawals.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cx("-mb-px border-b-2 px-3 py-2 text-[14px] font-medium", tab === k ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-transparent text-[#52525b] hover:text-[#18181b]")}>{l}</button>
        ))}
      </div>
      {err && <Message msg={{ type: "err", text: err }} />}

      {tab === "orders" ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="relative min-w-[200px] flex-1"><Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã đơn hoặc người mua" className="pl-8" /></label>
            <Select value={st} onChange={(e) => setSt(e.target.value as RecStatus | "")} className="w-auto">
              <option value="">Mọi trạng thái</option>
              {(Object.keys(REC_LABEL) as RecStatus[]).map((s) => <option key={s} value={s}>{REC_LABEL[s]} ({recs.filter((r) => r.status === s).length})</option>)}
            </Select>
            <label className="text-[12px] text-[#71717a]">Từ ngày<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" /></label>
            <label className="text-[12px] text-[#71717a]">Đến ngày<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" /></label>
          </div>
          <p className="text-[13px] text-[#52525b]">{shown.length} đơn · Doanh thu {money(sum.revenue)} · Phí sàn {money(sum.fee)}{sum.revenue ? ` (${pct(sum.fee / sum.revenue)})` : ""} · Thu nhập <b className="text-[#18181b]">{money(sum.income)}</b></p>
          <Card padded={false}>
            {shown.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="text-left text-[12px] text-[#71717a]">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                      <th>Mã đơn</th><th className="max-md:hidden">Ngày đặt</th><th className="max-md:hidden">Ngày thanh toán</th><th className="max-md:hidden">Người mua</th><th className="max-md:hidden">Sản phẩm</th>
                      <th className="text-right max-md:hidden">Doanh thu</th><th className="text-right max-md:hidden">Phí sàn</th><th className="text-right">Thu nhập</th><th className="max-md:hidden">Đối chiếu</th><th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeff1]">
                    {shown.map((r) => {
                      const ps = prod(r.order_sn);
                      return (
                        <tr key={r.order_sn} onClick={() => setView(r)} className="cursor-pointer align-top hover:bg-[#fafafa] [&>td]:px-3 [&>td]:py-2">
                          <td className="whitespace-nowrap font-mono text-[12px] font-medium">{r.order_sn}</td>
                          <td className="whitespace-nowrap max-md:hidden">{day(r.order?.order_date)}</td>
                          <td className="whitespace-nowrap max-md:hidden">{day(r.order?.paid_at)}</td>
                          <td className="max-w-[140px] truncate max-md:hidden">{r.order?.buyer ?? "—"}</td>
                          <td className="max-w-[260px] max-md:hidden">{ps.length ? <span className="line-clamp-2 text-[12px] text-[#3f3f46]" title={ps.join("\n")}>{ps.join(" · ")}</span> : <span className="text-[#a1a1aa]">—</span>}</td>
                          <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{money(r.revenue)}</td>
                          <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{r.order ? <>{money(r.fee)}<span className="block text-[11px] text-[#a1a1aa]">{pct(r.feePct)}</span></> : "—"}</td>
                          <td className="whitespace-nowrap text-right font-medium tabular-nums">{money(r.income)}{r.estimated && <span className="block text-[11px] font-normal text-[#d97706]">ước tính</span>}</td>
                          <td className="whitespace-nowrap max-md:hidden"><Badge tone={REC_TONE[r.status]}>{REC_LABEL[r.status]}</Badge>
                            {r.status === "mismatch" && <span className="block text-[11px] text-[#dc2626]">Income {money(r.incomeAmount)} · Ví {money(r.walletIn)}</span>}</td>
                          <td className="text-right"><button type="button" aria-label="Xem chi tiết" className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]"><Eye size={15} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-5"><EmptyState>{recs.length ? "Không có đơn khớp bộ lọc." : "Chưa có dữ liệu — vào “Nhập dữ liệu Shopee” để tải file."}</EmptyState></div>}
          </Card>
        </>
      ) : (
        <Card padded={false}>
          {withdrawals.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[12px] text-[#71717a]"><tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium"><th>Ngày</th><th className="text-right">Số tiền</th><th className="max-md:hidden">Chi tiết</th><th className="max-md:hidden">Trạng thái</th><th className="text-right max-md:hidden">Số dư sau</th></tr></thead>
                <tbody className="divide-y divide-[#efeff1]">
                  {withdrawals.map((t) => (
                    <tr key={t.id} className="[&>td]:px-3 [&>td]:py-2">
                      <td className="whitespace-nowrap">{dt(t.tx_at)}</td>
                      <td className="whitespace-nowrap text-right font-medium tabular-nums">{money(Math.abs(Number(t.amount)))}</td>
                      <td className="max-w-[320px] truncate text-[#52525b] max-md:hidden">{t.detail ?? "—"}</td>
                      <td className="max-md:hidden">{t.status ?? "—"}</td>
                      <td className="whitespace-nowrap text-right tabular-nums max-md:hidden">{money(t.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-[#efeff1] px-3 py-2 text-[12px] text-[#71717a]">Tổng đã rút: <b>{money(withdrawals.reduce((a, t) => a + Math.abs(Number(t.amount)), 0))}</b> · không tính vào thu nhập.</p>
            </div>
          ) : <div className="p-5"><EmptyState>Chưa có lần rút tiền nào (nhập file My Balance).</EmptyState></div>}
        </Card>
      )}
      {view && <OrderDetail r={view} lines={linesBy.get(view.order_sn) ?? []} onClose={() => setView(null)} />}
    </div>
  );
}

function OrderDetail({ r, lines, onClose }: { r: Rec; lines: Line[]; onClose: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    createClient().from("shopee_order_items").select("order_sn,product_id,seq,product_name,product_price,refund").eq("order_sn", r.order_sn).order("seq").then(({ data }) => setItems((data ?? []) as Item[]));
  }, [r.order_sn]);
  const o = r.order;
  const Row = ({ k, v, b }: { k: string; v: React.ReactNode; b?: boolean }) => <div className={cx("flex justify-between gap-3 py-1", b && "font-semibold")}><span className="text-[#52525b]">{k}</span><span className="text-right tabular-nums">{v}</span></div>;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-3" role="dialog" aria-modal onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-[620px] overflow-y-auto rounded-[12px] bg-white p-5 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1"><p className="font-mono text-[15px] font-semibold">{r.order_sn}</p>
            <p className="text-[12px] text-[#71717a]">{o?.buyer ?? "—"} · đặt {day(o?.order_date)} · thanh toán {day(o?.paid_at)}{o?.carrier ? ` · ${o.carrier}` : ""}</p></div>
          <Badge tone={REC_TONE[r.status]}>{REC_LABEL[r.status]}</Badge>
          <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#f4f4f5]"><X size={16} /></button>
        </div>
        <section className="rounded-[10px] border border-[#e5e5e7] px-3 py-2">
          <Row k="Doanh thu (giá sản phẩm)" v={money(r.revenue)} />
          {r.feeItems.map(([k, v]) => <Row key={k} k={`− ${k}`} v={money(v)} />)}
          <Row k={`Phí sàn${r.feePct !== null ? ` (${pct(r.feePct)})` : ""}`} v={money(r.fee)} b />
          {o?.refund ? <Row k="Số tiền hoàn lại" v={money(o.refund)} /> : null}
          <div className="my-1 border-t border-[#efeff1]" />
          <Row k="Tổng tiền đã thanh toán (Income)" v={money(r.incomeAmount)} />
          <Row k="Tiền vào ví (My Balance)" v={money(r.walletIn)} />
          <Row k={`Thu nhập${r.estimated ? " (ước tính)" : ""}`} v={money(r.income)} b />
        </section>
        {r.tx.length > 0 && (
          <section className="mt-3">
            <p className="mb-1 font-semibold">Giao dịch ví</p>
            {r.tx.map((t) => <Row key={t.id} k={`${dt(t.tx_at)} · ${t.tx_type}`} v={money(Number(t.amount))} />)}
          </section>
        )}
        <section className="mt-3">
          <p className="mb-1 font-semibold">Sản phẩm (file xuất đơn)</p>
          {lines.length ? lines.map((l) => (
            <div key={l.seq} className="flex justify-between gap-3 border-b border-[#f4f4f5] py-1.5">
              <span className="min-w-0"><span className="block">{l.product_name ?? "—"}</span><span className="text-[12px] text-[#71717a]">{l.variation ?? ""}{l.variation_sku ? ` · SKU ${l.variation_sku}` : ""}</span></span>
              <span className="shrink-0 text-right tabular-nums">{l.qty ?? 1} × {money(l.price)}</span>
            </div>
          )) : <p className="text-[#a1a1aa]">Chưa có — nhập file xuất đơn hàng của Shopee.</p>}
        </section>
        <section className="mt-3">
          <p className="mb-1 font-semibold">Dòng sản phẩm (Income)</p>
          {items === null ? <p className="text-[#a1a1aa]">Đang tải...</p> : items.length ? items.map((i) => (
            <div key={`${i.product_id}${i.seq}`} className="flex justify-between gap-3 border-b border-[#f4f4f5] py-1.5">
              <span className="min-w-0"><span className="block">{i.product_name ?? "—"}</span><span className="text-[12px] text-[#71717a]">Mã SP {i.product_id || "—"}</span></span>
              <span className="shrink-0 text-right tabular-nums">{money(i.product_price)}{i.refund ? <span className="block text-[11px] text-[#dc2626]">hoàn {money(i.refund)}</span> : null}</span>
            </div>
          )) : <p className="text-[#a1a1aa]">Không có dòng sản phẩm.</p>}
        </section>
      </div>
    </div>
  );
}
