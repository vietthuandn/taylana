import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { discountState, valueText, type Discount } from "@/lib/discountAdmin";
import { AdminPage, Badge, Button, EmptyState, PageHeader, Table } from "@/components/admin/ui";
import { btnClass } from "@/components/admin/styles";

export default async function DiscountsAdmin() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("discounts").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as Discount[];
  const time = (d: Discount) => (!d.starts_at && !d.ends_at ? "Không giới hạn"
    : `${d.starts_at ? formatDate(d.starts_at) : "…"} → ${d.ends_at ? formatDate(d.ends_at) : "…"}`);

  return (
    <AdminPage>
      <PageHeader title="Giảm giá" description="Mã riêng tư (khách tự nhập) và chương trình toàn shop (tự áp dụng). Mỗi đơn dùng tối đa 1 giảm giá."
        actions={<Button href="/admin/giam-gia/moi" icon={<Plus size={16} />}>Tạo giảm giá</Button>} />
      {error && <p className="mb-3 text-[13px] text-[#dc2626]">{error.message.includes("discounts") ? "Chưa có bảng giảm giá — cần chạy supabase/migration_discounts.sql." : error.message}</p>}
      <Table head={["Tên", "Mã", "Loại", "Phạm vi", "Giá trị", "Thời gian", "Đã dùng", "Trạng thái", ""]}
        empty={!rows.length && <EmptyState>Chưa có chương trình giảm giá nào.</EmptyState>}>
        {rows.map((d) => {
          const s = discountState(d);
          return (
            <tr key={d.id}>
              <td><Link href={`/admin/giam-gia/${d.id}`} className="font-medium text-[#18181b] hover:text-[#ff5fa2]">{d.name}</Link>
                {d.label && <span className="block text-[12px] text-[#a1a1aa]">{d.label}</span>}</td>
              <td className="font-mono text-[13px]">{d.kind === "private" ? d.code : <span className="text-[#a1a1aa]">—</span>}</td>
              <td>{d.kind === "private" ? <Badge>Mã riêng tư</Badge> : <Badge tone="pink">Toàn shop</Badge>}</td>
              <td className="text-[13px] text-[#71717a]">{d.target === "shipping" ? "Phí vận chuyển" : "Tiền hàng"}</td>
              <td className="text-[13px]">{valueText(d)}{d.target !== "shipping" && d.scope === "items" && <span className="block text-[12px] text-[#a1a1aa]">Một số lựa chọn</span>}</td>
              <td className="text-[12px] text-[#71717a]">{time(d)}</td>
              <td className="text-[13px]">{d.used_count}{d.usage_limit ? ` / ${d.usage_limit}` : ""}</td>
              <td><Badge tone={s.tone}>{s.label}</Badge></td>
              <td className="text-right"><Link href={`/admin/giam-gia/${d.id}`} className={btnClass("ghost", "sm")}>Sửa</Link></td>
            </tr>
          );
        })}
      </Table>
    </AdminPage>
  );
}
