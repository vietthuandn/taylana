import { STORAGE_QUOTA, storageUsageRows } from "@/lib/storage";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatBytes, formatDate, formatVND, orderTypeLabels, statusLabels } from "@/lib/format";
import type { Order } from "@/lib/types";
import { AdminPage, Badge, Button, Card, EmptyState, PageHeader, Table } from "@/components/admin/ui";
import { statusTone } from "@/components/admin/tones";

const QUOTA = STORAGE_QUOTA; // gói miễn phí: R2 10GB (Supabase Free 1GB khi STORAGE_PROVIDER=supabase)

// Tổng quan rút gọn cho Nhà thiết kế: chỉ lối tắt tới 2 mục được phép
function DesignerHome() {
  const card = (href: string, title: string, desc: string) => (
    <Link href={href} className="block rounded-[12px] border border-[#e5e5e7] bg-white p-5 transition-colors hover:border-[#ff5fa2]">
      <p className="text-[16px] font-semibold text-[#18181b]">{title}</p>
      <p className="mt-1 text-[13px] text-[#71717a]">{desc}</p>
    </Link>
  );
  return (
    <AdminPage>
      <PageHeader title="Tổng quan" />
      <div className="grid gap-4 sm:grid-cols-2">
        {card("/admin/thiet-ke/chat-lieu", "Quản lý chất liệu", "Sticker & trang trí, khung ảnh, font chữ cut-out, lời chúc.")}
        {card("/admin/thiet-ke/template", "Quản lý template", "Mẫu CD Template, Booklet Template, Khung Photostrip.")}
      </div>
    </AdminPage>
  );
}

export default async function AdminHome() {
  const { supabase, role } = await requireAdmin();
  if (role === "designer") return <DesignerHome />;
  const [{ count: newOrders }, { count: doing }, { data: usage }, { data: recent }, { count: payPending }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    storageUsageRows(),
    supabase.from("orders").select("id, code, order_type, customer_name, phone, total, status, created_at")
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
  ]);
  const used = ((usage ?? []) as { total_bytes: number }[]).reduce((t, r) => t + Number(r.total_bytes), 0);
  const pct = Math.min(100, (used / QUOTA) * 100);
  const orders = (recent ?? []) as Pick<Order, "id" | "code" | "order_type" | "customer_name" | "phone" | "total" | "status" | "created_at">[];

  const stat = (label: string, value: React.ReactNode, sub: React.ReactNode, href: string) => (
    <Link href={href} className="block rounded-[12px] border border-[#e5e5e7] bg-white p-5 transition-colors hover:border-[#d4d4d8]">
      <p className="text-[13px] text-[#71717a]">{label}</p>
      <p className="mt-1 text-[28px] font-semibold tracking-[-0.02em] text-[#18181b]">{value}</p>
      <div className="mt-1 text-[12px] text-[#71717a]">{sub}</div>
    </Link>
  );

  return (
    <AdminPage>
      <PageHeader title="Tổng quan"
        actions={<Button href="/admin/don-hang" variant="secondary">Xem tất cả đơn</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Đơn mới", newOrders ?? 0, "Đang chờ xác nhận", "/admin/don-hang?status=new")}
        {stat("Chờ xác nhận thanh toán", <span className={payPending ? "text-[#ff5fa2]" : ""}>{payPending ?? 0}</span>, "Khách báo đã chuyển khoản", "/admin/don-hang?pay=pending")}
        {stat("Đơn đang làm", doing ?? 0, "Đang thiết kế / in", "/admin/don-hang?status=in_progress")}
        {stat("Storage đã dùng", formatBytes(used), (
          <div>
            <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]">
              <div className={`h-full rounded-full ${pct > 80 ? "bg-[#dc2626]" : "bg-[#ff5fa2]"}`} style={{ width: `${pct}%` }} />
            </div>
            {pct.toFixed(1)}% của {formatBytes(QUOTA)}
          </div>
        ), "/admin/don-file")}
      </div>

      <div className="mt-8">
        <Card title="Đơn hàng gần đây" description="8 đơn mới nhất" padded={false}
          actions={<Button href="/admin/don-hang" variant="ghost" size="sm">Xem tất cả →</Button>}>
          <div className="[&>div]:rounded-none [&>div]:border-0">
            <Table head={["Mã đơn", "Khách hàng", "Trạng thái", "Ngày đặt", "Tổng tiền"]}
              empty={!orders.length && <EmptyState>Chưa có đơn nào.</EmptyState>}>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/don-hang/${o.id}`} className="font-medium text-[#18181b] hover:text-[#ff5fa2]">{o.code}</Link>
                    {o.order_type !== "cd" && <span className="ml-2 text-[12px] text-[#71717a]">{orderTypeLabels[o.order_type]}</span>}</td>
                  <td className="text-[#3f3f46]">{o.customer_name} <span className="text-[#a1a1aa]">· {o.phone}</span></td>
                  <td><Badge tone={statusTone[o.status]}>{statusLabels[o.status]}</Badge></td>
                  <td className="text-[13px] text-[#71717a]">{formatDate(o.created_at)}</td>
                  <td className="text-right font-medium">{formatVND(o.total)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      </div>
    </AdminPage>
  );
}
