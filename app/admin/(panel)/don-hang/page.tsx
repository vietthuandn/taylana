import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatVND, orderTypeLabels, statusLabels } from "@/lib/format";
import type { Order } from "@/lib/types";
import { paymentLabels, paymentTone, type PaymentStatus } from "@/lib/payment/settings";
import { AdminPage, Badge, EmptyState, PageHeader, Table } from "@/components/admin/ui";
import { btnClass, inputClass } from "@/components/admin/styles";
import { statusTone } from "@/components/admin/tones";

const PAGE = 30;

type Row = Order;

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ status?: string; pay?: string; q?: string; page?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const status = sp.status ?? "";
  const pay = sp.pay ?? "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters = <T extends { eq: any; or: any }>(query: T): T => {
    let x = query;
    if (status) x = x.eq("status", status);
    if (pay) x = x.eq("payment_status", pay);
    if (q) {
      const safe = q.replace(/[%,()]/g, "");
      x = x.or(`code.ilike.%${safe}%,phone.ilike.%${safe}%,customer_name.ilike.%${safe}%,payment_code.ilike.%${safe}%`);
    }
    return x;
  };

  // Đơn "Chờ xác nhận" thanh toán luôn đưa lên đầu (trang 1)
  const pendingRes = !pay
    ? await filters(supabase.from("orders").select("*").eq("payment_status", "pending").order("payment_claimed_at", { ascending: true }).limit(50))
    : null;
  const payReady = !pendingRes?.error; // false = chưa chạy migration_payment.sql
  const pending = (payReady && page === 1 ? pendingRes?.data ?? [] : []) as Row[];

  let main = supabase.from("orders").select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  main = filters(main);
  if (!pay && payReady) main = main.neq("payment_status", "pending");
  const { data, count, error } = await main;
  const orders = [...pending, ...((data ?? []) as Row[])];
  const total = (count ?? 0) + (payReady && !pay ? pendingRes?.data?.length ?? 0 : 0);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  const link = (o: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const merged = { status, pay, q, page: 1, ...o };
    Object.entries(merged).forEach(([k, v]) => v && v !== 1 && p.set(k, String(v)));
    if (merged.page !== 1) p.set("page", String(merged.page));
    const s = p.toString();
    return `/admin/don-hang${s ? `?${s}` : ""}`;
  };

  return (
    <AdminPage>
      <PageHeader title="Đơn hàng" description={`${total} đơn${status ? ` · ${statusLabels[status]}` : ""}${pay ? ` · ${paymentLabels[pay as PaymentStatus]}` : ""}`} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
          {["", "new", "in_progress", "delivered"].map((s) => (
            <Link key={s || "all"} href={link({ status: s })}
              className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${status === s ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:text-[#18181b]"}`}>
              {s ? statusLabels[s] : "Tất cả"}
            </Link>
          ))}
        </div>
        <form className="flex w-full gap-2 sm:w-auto" action="/admin/don-hang">
          {status && <input type="hidden" name="status" value={status} />}
          {pay && <input type="hidden" name="pay" value={pay} />}
          <input name="q" defaultValue={q} placeholder="Tìm mã đơn, SĐT, tên..." className={`${inputClass} sm:w-72`} />
          <button className={btnClass("secondary")}>Tìm</button>
        </form>
      </div>

      {payReady && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] text-[#71717a]">Thanh toán:</span>
          {(["", "pending", "unpaid", "deposited", "paid", "expired", "cancelled"] as const).map((k) => (
            <Link key={k || "all"} href={link({ pay: k })}
              className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium ${pay === k ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:text-[#18181b]"}`}>
              {k ? paymentLabels[k] : "Tất cả"}
            </Link>
          ))}
        </div>
      )}

      {error && <p className="mb-3 text-[13px] text-[#dc2626]">{error.message}</p>}

      <Table head={["Mã đơn", "Khách hàng", "Trạng thái", "Thanh toán", "Cần thu", "Ngày đặt", "Tổng tiền", ""]}
        empty={!orders.length && <EmptyState>Không có đơn nào.</EmptyState>}>
        {orders.map((o) => (
          <tr key={o.id} className={o.payment_status === "pending" ? "bg-[#fff7fb]" : ""}>
            <td>
              <Link href={`/admin/don-hang/${o.id}`} className="font-medium text-[#18181b] hover:text-[#ff5fa2]">{o.code}</Link>
              <span className="block text-[12px] text-[#a1a1aa]">{o.payment_code ?? orderTypeLabels[o.order_type]}</span>
            </td>
            <td className="max-w-[260px] truncate text-[#3f3f46]">{o.customer_name} <span className="text-[#a1a1aa]">· {o.phone}</span></td>
            <td><Badge tone={statusTone[o.status]}>{statusLabels[o.status]}</Badge></td>
            <td>{o.payment_status ? <Badge tone={paymentTone[o.payment_status]}>{paymentLabels[o.payment_status]}</Badge> : <span className="text-[#a1a1aa]">—</span>}</td>
            <td className="text-[13px]">{o.amount_due ? formatVND(o.amount_due) : "—"}</td>
            <td className="text-[13px] text-[#71717a]">{formatDate(o.created_at)}</td>
            <td className="font-medium">{formatVND(o.total)}</td>
            <td className="text-right"><Link href={`/admin/don-hang/${o.id}`} className={btnClass("ghost", "sm")}>Xem</Link></td>
          </tr>
        ))}
      </Table>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[13px] text-[#71717a]">Trang {page}/{pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className={btnClass("secondary", "sm")} href={link({ page: page - 1 })}>← Trước</Link>}
            {page < pages && <Link className={btnClass("secondary", "sm")} href={link({ page: page + 1 })}>Sau →</Link>}
          </div>
        </div>
      )}
    </AdminPage>
  );
}
