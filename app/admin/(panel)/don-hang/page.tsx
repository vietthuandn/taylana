import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatVND, orderTypeLabels, statusLabels } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Badge } from "@/components/admin/ui";

const PAGE = 30;
const tones = { new: "pink", in_progress: "butter", delivered: "matcha" } as const;

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const status = sp.status ?? "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase
    .from("orders")
    .select("id, code, order_type, customer_name, phone, total, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) query = query.eq("status", status);
  if (q) {
    const safe = q.replace(/[%,()]/g, "");
    query = query.or(`code.ilike.%${safe}%,phone.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
  }
  const { data, count, error } = await query;
  const orders = (data ?? []) as Pick<Order, "id" | "code" | "order_type" | "customer_name" | "phone" | "total" | "status" | "created_at">[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  const link = (o: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const merged = { status, q, page: 1, ...o };
    Object.entries(merged).forEach(([k, v]) => v && v !== 1 && p.set(k, String(v)));
    if (merged.page !== 1) p.set("page", String(merged.page));
    const s = p.toString();
    return `/admin/don-hang${s ? `?${s}` : ""}`;
  };

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-3xl">Đơn hàng</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {["", "new", "in_progress", "delivered"].map((s) => (
          <Link key={s || "all"} href={link({ status: s })}
            className={`pop-sm rounded-full px-4 py-1.5 text-sm font-medium ${status === s ? "bg-lime-500" : "bg-cream-50"}`}>
            {s ? statusLabels[s] : "Tất cả"}
          </Link>
        ))}
      </div>

      <form className="mb-5 flex gap-2" action="/admin/don-hang">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Tìm mã đơn, SĐT, tên..." className="field" />
        <button className="btn !min-h-12 shrink-0">Tìm</button>
      </form>

      {error && <p className="text-hot-500">{error.message}</p>}
      <p className="mb-2 text-sm text-ink-500">{count ?? 0} đơn</p>

      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/don-hang/${o.id}`} className="pop-sm flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-cream-50 px-4 py-3 hover:bg-hot-100">
              <span className="font-display text-lg">{o.code}</span>
              <Badge tone={tones[o.status]}>{statusLabels[o.status]}</Badge>
              {o.order_type !== "cd" && <Badge>{orderTypeLabels[o.order_type]}</Badge>}
              <span className="min-w-0 flex-1 truncate text-sm">{o.customer_name} · {o.phone}</span>
              <span className="text-sm font-bold text-hot-500">{formatVND(o.total)}</span>
              <span className="w-full text-xs text-ink-500 sm:w-auto">{formatDate(o.created_at)}</span>
            </Link>
          </li>
        ))}
        {!orders.length && <li className="text-ink-500">Không có đơn nào.</li>}
      </ul>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {page > 1 && <Link className="btn btn-ghost btn-sm" href={link({ page: page - 1 })}>← Trước</Link>}
          <span className="text-sm">Trang {page}/{pages}</span>
          {page < pages && <Link className="btn btn-ghost btn-sm" href={link({ page: page + 1 })}>Sau →</Link>}
        </div>
      )}
    </div>
  );
}
