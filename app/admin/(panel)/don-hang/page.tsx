import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatVND, orderTypeLabels, statusLabels } from "@/lib/format";
import type { Order } from "@/lib/types";
import { AdminPage, Badge, EmptyState, PageHeader, Table } from "@/components/admin/ui";
import { btnClass, inputClass } from "@/components/admin/styles";
import { statusTone } from "@/components/admin/tones";

const PAGE = 30;

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
    <AdminPage>
      <PageHeader title="Đơn hàng" description={`${count ?? 0} đơn${status ? ` · ${statusLabels[status]}` : ""}`} />

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
          <input name="q" defaultValue={q} placeholder="Tìm mã đơn, SĐT, tên..." className={`${inputClass} sm:w-72`} />
          <button className={btnClass("secondary")}>Tìm</button>
        </form>
      </div>

      {error && <p className="mb-3 text-[13px] text-[#dc2626]">{error.message}</p>}

      <Table head={["Mã đơn", "Khách hàng", "Loại", "Trạng thái", "Ngày đặt", "Tổng tiền", ""]}
        empty={!orders.length && <EmptyState>Không có đơn nào.</EmptyState>}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td><Link href={`/admin/don-hang/${o.id}`} className="font-medium text-[#18181b] hover:text-[#ff5fa2]">{o.code}</Link></td>
            <td className="max-w-[260px] truncate text-[#3f3f46]">{o.customer_name} <span className="text-[#a1a1aa]">· {o.phone}</span></td>
            <td className="text-[13px] text-[#71717a]">{orderTypeLabels[o.order_type]}</td>
            <td><Badge tone={statusTone[o.status]}>{statusLabels[o.status]}</Badge></td>
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
