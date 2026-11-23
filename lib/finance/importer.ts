/* Tài chính · so dữ liệu vừa đọc với Supabase (chống trùng) → bảng xem trước Mới / Cập nhật / Trùng / Lỗi → bấm "Nhập" mới ghi.
   Khoá: đơn = mã đơn · dòng sản phẩm = (mã đơn, mã sản phẩm, thứ tự) · dòng file xuất đơn = (mã đơn, thứ tự) · giao dịch ví = (ngày giờ, loại, mã đơn, số tiền).
   Đơn đã có: chỉ CẬP NHẬT trường mới / thay đổi (trường trống trong file mới giữ giá trị cũ). Chạy trên trình duyệt, RLS chỉ admin. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parsed } from "./shopee";

export type RowStatus = "new" | "update" | "dup";
export type PlanRow = { table: string; key: string; label: string; status: RowStatus; data: Record<string, unknown> };
export type Plan = { file: string; kind: Parsed["kind"]; rows: PlanRow[]; errors: string[]; counts: { new: number; update: number; dup: number; err: number } };

const TABLES = {
  orders: { name: "shopee_orders", conflict: "order_sn", fields: ["order_date", "paid_at", "buyer", "total_paid", "product_price", "refund", "amount_paid_by_buyer", "tx_fee_rate", "carrier", "fees", "service_fees", "raw", "service_raw"] },
  items: { name: "shopee_order_items", conflict: "order_sn,product_id,seq", fields: ["product_name", "product_price", "refund", "raw"] },
  lines: { name: "shopee_order_lines", conflict: "order_sn,seq", fields: ["product_name", "variation", "variation_sku", "qty", "price", "raw"] },
  tx: { name: "shopee_wallet_tx", conflict: "tx_at,tx_type,order_sn,amount", fields: ["detail", "direction", "status", "balance_after", "is_withdrawal", "raw"] },
} as const;
const DATE_FIELDS = new Set(["order_date", "paid_at", "tx_at"]);

/** chuẩn hoá để so: ngày → mốc thời gian · object → JSON sắp khoá · số → Number */
function norm(k: string, v: unknown): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (DATE_FIELDS.has(k)) return new Date(String(v)).getTime();
  if (typeof v === "object") return stable(v);
  if (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v))) return Number(v);
  return v;
}
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
}
const empty = (v: unknown) => v === null || v === undefined || v === "" || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length);
/** gộp: giá trị mới (không trống) đè lên cũ */
const merge = (old: Record<string, unknown>, nw: Record<string, unknown>, fields: readonly string[]) => {
  const out: Record<string, unknown> = { ...nw };
  // ô trống trong file mới giữ giá trị cũ — riêng các khoản phí (object) luôn lấy theo file mới (sửa được dữ liệu nhập sai trước đó)
  for (const f of fields) if ((nw[f] && typeof nw[f] === "object" ? false : empty(nw[f])) && !empty(old[f])) out[f] = old[f];
  return out;
};
const same = (a: Record<string, unknown>, b: Record<string, unknown>, fields: readonly string[]) => fields.every((f) => stable(norm(f, a[f])) === stable(norm(f, b[f])));
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function existing(sb: SupabaseClient, table: string, col: string, vals: string[], select = "*") {
  const out: Record<string, unknown>[] = [];
  for (const c of chunks([...new Set(vals)], 150)) {
    const { data, error } = await sb.from(table).select(select).in(col, c);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return out;
}
const txKey = (r: Record<string, unknown>) => `${new Date(String(r.tx_at)).getTime()}|${r.tx_type ?? ""}|${r.order_sn ?? ""}|${Number(r.amount)}`;

function diff(table: keyof typeof TABLES, rows: Record<string, unknown>[], old: Map<string, Record<string, unknown>>, keyOf: (r: Record<string, unknown>) => string, label: (r: Record<string, unknown>) => string): PlanRow[] {
  const T = TABLES[table], seen = new Map<string, Record<string, unknown>>();
  for (const r of rows) seen.set(keyOf(r), r); // trùng trong cùng file: lấy dòng sau
  return [...seen.entries()].map(([key, r]) => {
    const o = old.get(key);
    if (!o) return { table: T.name, key, label: label(r), status: "new" as const, data: r };
    const m = merge(o, r, T.fields);
    return { table: T.name, key, label: label(r), status: same(o, m, T.fields) ? "dup" as const : "update" as const, data: m };
  });
}

/** so file đã đọc với dữ liệu trong Supabase */
export async function planImport(sb: SupabaseClient, p: Parsed): Promise<Plan> {
  let rows: PlanRow[] = [];
  if (p.kind === "income") {
    const sns = p.orders.map((o) => o.order_sn);
    const [oo, oi] = await Promise.all([existing(sb, "shopee_orders", "order_sn", sns), existing(sb, "shopee_order_items", "order_sn", [...sns, ...p.items.map((i) => i.order_sn)])]);
    rows = [
      ...diff("orders", p.orders as unknown as Record<string, unknown>[], new Map(oo.map((r) => [String(r.order_sn), r])), (r) => String(r.order_sn), (r) => `Đơn ${r.order_sn}`),
      ...diff("items", p.items as unknown as Record<string, unknown>[], new Map(oi.map((r) => [`${r.order_sn}|${r.product_id}|${r.seq}`, r])), (r) => `${r.order_sn}|${r.product_id}|${r.seq}`, (r) => `SP ${r.order_sn} · ${r.product_name ?? r.product_id}`),
    ];
  } else if (p.kind === "orders") {
    const ol = await existing(sb, "shopee_order_lines", "order_sn", p.lines.map((l) => l.order_sn));
    rows = diff("lines", p.lines as unknown as Record<string, unknown>[], new Map(ol.map((r) => [`${r.order_sn}|${r.seq}`, r])), (r) => `${r.order_sn}|${r.seq}`, (r) => `${r.order_sn} · ${r.product_name ?? ""}${r.variation ? ` (${r.variation})` : ""}`);
  } else {
    const ts = p.tx.map((t) => new Date(t.tx_at).getTime());
    const old: Record<string, unknown>[] = [];
    if (ts.length) {
      const from = new Date(Math.min(...ts)).toISOString(), to = new Date(Math.max(...ts)).toISOString();
      for (let i = 0; ; i += 1000) {
        const { data, error } = await sb.from("shopee_wallet_tx").select("*").gte("tx_at", from).lte("tx_at", to).order("id").range(i, i + 999);
        if (error) throw new Error(`shopee_wallet_tx: ${error.message}`);
        old.push(...((data ?? []) as Record<string, unknown>[]));
        if (!data || data.length < 1000) break;
      }
    }
    rows = diff("tx", p.tx as unknown as Record<string, unknown>[], new Map(old.map((r) => [txKey(r), r])), txKey, (r) => `${String(r.tx_at).slice(0, 16).replace("T", " ")} · ${r.tx_type} · ${Number(r.amount).toLocaleString("vi-VN")}đ`);
  }
  const counts = { new: rows.filter((r) => r.status === "new").length, update: rows.filter((r) => r.status === "update").length, dup: rows.filter((r) => r.status === "dup").length, err: p.errors.length };
  return { file: p.file, kind: p.kind, rows, errors: p.errors, counts };
}

/** ghi các dòng Mới + Cập nhật (upsert theo khoá), rồi lưu lịch sử nhập */
export async function runImport(sb: SupabaseClient, plan: Plan): Promise<{ written: number; errors: string[] }> {
  const errors: string[] = [];
  let written = 0;
  const now = new Date().toISOString();
  for (const T of Object.values(TABLES)) {
    const rows = plan.rows.filter((r) => r.table === T.name && r.status !== "dup").map((r) => {
      const d = { ...r.data }; delete d.id; delete d.created_at;
      if (T.name !== "shopee_wallet_tx") d.updated_at = now;
      return d;
    });
    for (const c of chunks(rows, 400)) {
      const { error } = await sb.from(T.name).upsert(c, { onConflict: T.conflict });
      if (error) errors.push(`${T.name}: ${error.message}`); else written += c.length;
    }
  }
  const { error } = await sb.from("finance_imports").insert({ file_name: plan.file, kind: plan.kind, new_count: plan.counts.new, update_count: plan.counts.update, dup_count: plan.counts.dup, err_count: plan.counts.err + errors.length });
  if (error) errors.push(`finance_imports: ${error.message}`);
  return { written, errors };
}
