import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatVND } from "@/lib/format";
import { blankDiscount, type Discount } from "@/lib/discountAdmin";
import { AdminPage, Card, EmptyState, PageHeader, Table } from "@/components/admin/ui";
import { DiscountForm } from "./DiscountForm";

type Usage = { id: string; amount: number; phone: string; created_at: string; orders: { id: string; code: string; customer_name: string; total: number } | null };

export default async function DiscountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const isNew = id === "moi";
  const [d, pk, ad, us] = await Promise.all([
    isNew ? Promise.resolve({ data: blankDiscount }) : supabase.from("discounts").select("*").eq("id", id).maybeSingle(),
    supabase.from("packages").select("id, name").order("sort_order"),
    supabase.from("addons").select("id, name").order("sort_order"),
    isNew ? Promise.resolve({ data: [] }) : supabase.from("discount_usages").select("id, amount, phone, created_at, orders(id, code, customer_name, total)").eq("discount_id", id).order("created_at", { ascending: false }).limit(200),
  ]);
  if (!d.data) notFound();
  const usages = (us.data ?? []) as unknown as Usage[];

  return (
    <AdminPage>
      <Link href="/admin/giam-gia" className="mb-3 inline-flex items-center gap-1 text-[13px] text-[#71717a] hover:text-[#18181b]">← Danh sách giảm giá</Link>
      <PageHeader title={isNew ? "Tạo giảm giá" : (d.data as Discount).name} description={isNew ? "Mã riêng tư hoặc chương trình toàn shop." : undefined} />
      <DiscountForm initial={d.data as Discount} packages={pk.data ?? []} addons={ad.data ?? []} />
      {!isNew && (
        <div className="mt-6">
          <Card title="Đơn đã dùng" description={`${usages.length} đơn`} padded={false}>
            <div className="[&>div]:rounded-none [&>div]:border-0">
              <Table head={["Mã đơn", "Khách hàng", "SĐT", "Số tiền giảm", "Tổng đơn", "Thời gian"]}
                empty={!usages.length && <EmptyState>Chưa có đơn nào dùng.</EmptyState>}>
                {usages.map((u) => (
                  <tr key={u.id}>
                    <td>{u.orders ? <Link href={`/admin/don-hang/${u.orders.id}`} className="font-medium hover:text-[#ff5fa2]">{u.orders.code}</Link> : "—"}</td>
                    <td className="text-[#3f3f46]">{u.orders?.customer_name ?? ""}</td>
                    <td className="text-[13px] text-[#71717a]">{u.phone}</td>
                    <td className="text-[#ff5fa2]">−{formatVND(u.amount)}</td>
                    <td>{u.orders ? formatVND(u.orders.total) : ""}</td>
                    <td className="text-right text-[13px] text-[#71717a]">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </Card>
        </div>
      )}
    </AdminPage>
  );
}
