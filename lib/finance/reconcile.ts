/* Tài chính · đối chiếu từng đơn Shopee giữa Báo cáo Income và My Balance.
   Trạng thái: Đã về ví (có ở cả 2, khớp tiền) · Chờ về ví (chỉ Income) · Chỉ có ở ví (chỉ My Balance) · Lệch tiền (2 số khác nhau).
   THU NHẬP = tiền vào ví (nếu có), không thì "Tổng tiền đã thanh toán" của Income (ước tính).
   DOANH THU = Giá sản phẩm (trước phí, chỉ để đối chiếu). PHÍ SÀN = tổng phí + phí Service Fee Details (không trùng tên) + ship người bán chịu. */
import { fold } from "./shopee";

export type OrderRow = {
  order_sn: string; order_date: string | null; paid_at: string | null; buyer: string | null; total_paid: number | null; product_price: number | null; refund: number | null;
  carrier: string | null; fees: Record<string, number> | null; service_fees: Record<string, number> | null;
};
export type TxRow = { id: number; tx_at: string; tx_type: string; detail: string | null; order_sn: string; direction: string | null; amount: number; status: string | null; balance_after: number | null; is_withdrawal: boolean };
export type RecStatus = "paid" | "pending" | "wallet_only" | "mismatch";
export const REC_LABEL: Record<RecStatus, string> = { paid: "Đã về ví", pending: "Chờ về ví", wallet_only: "Chỉ có ở ví", mismatch: "Lệch tiền" };
export const REC_TONE: Record<RecStatus, "green" | "amber" | "blue" | "red"> = { paid: "green", pending: "amber", wallet_only: "blue", mismatch: "red" };

export type Rec = {
  order_sn: string; order: OrderRow | null; tx: TxRow[]; status: RecStatus;
  walletIn: number | null; incomeAmount: number | null; income: number; estimated: boolean;
  revenue: number | null; fee: number; feePct: number | null; feeItems: [string, number][];
};

/** các khoản phí sàn của 1 đơn (tên → số tiền dương) */
export function feeItems(o: OrderRow): [string, number][] {
  const a = Object.entries(o.fees ?? {}).map(([k, v]) => [k, Math.abs(Number(v) || 0)] as [string, number]);
  const have = new Set(a.map(([k]) => fold(k)));
  for (const [k, v] of Object.entries(o.service_fees ?? {})) if (!have.has(fold(k))) a.push([k, Math.abs(Number(v) || 0)]);
  return a.filter(([, v]) => v > 0);
}

export function reconcile(orders: OrderRow[], tx: TxRow[]): Rec[] {
  const bySn = new Map<string, TxRow[]>();
  for (const t of tx) if (t.order_sn && !t.is_withdrawal) bySn.set(t.order_sn, [...(bySn.get(t.order_sn) ?? []), t]);
  const sns = new Set([...orders.map((o) => o.order_sn), ...bySn.keys()]);
  const om = new Map(orders.map((o) => [o.order_sn, o]));
  return [...sns].map((sn) => {
    const o = om.get(sn) ?? null, ts = bySn.get(sn) ?? [];
    const ins = ts.filter((t) => Number(t.amount) > 0);
    const walletIn = ins.length ? ts.reduce((a, t) => a + Number(t.amount), 0) : null; // tiền vào trừ tiền ra (hoàn) của đơn
    const incomeAmount = o?.total_paid ?? null;
    const status: RecStatus = !o ? "wallet_only" : walletIn === null ? "pending" : incomeAmount !== null && Math.abs(walletIn - incomeAmount) > 1 ? "mismatch" : "paid";
    const items = o ? feeItems(o) : [], fee = items.reduce((a, [, v]) => a + v, 0), revenue = o?.product_price ?? null;
    return {
      order_sn: sn, order: o, tx: ts, status, walletIn, incomeAmount,
      income: walletIn ?? incomeAmount ?? 0, estimated: walletIn === null,
      revenue, fee, feePct: revenue ? fee / revenue : null, feeItems: items,
    };
  });
}

/** tải hết bảng (vượt giới hạn 1000 dòng / lần của Supabase) */
export async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
