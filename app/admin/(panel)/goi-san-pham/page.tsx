import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { formatVND } from "@/lib/format";
import { fromPrice } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalogLoad";
import { AdminPage, Badge, Button, EmptyState, PageHeader, Table } from "@/components/admin/ui";
import { btnClass } from "@/components/admin/styles";

export default async function ProductsAdmin() {
  const { supabase } = await requireAdmin();
  const products = (await getCatalog(supabase, true)).filter((p) => p.id !== "legacy");
  return (
    <AdminPage>
      <PageHeader title="Sản phẩm của tôi" description="Mỗi sản phẩm có các nhóm tuỳ chọn (Loại, Mua kèm...). Khách chọn trên trang Đặt đơn."
        actions={<Button href="/admin/goi-san-pham/moi" icon={<Plus size={16} />}>Tạo sản phẩm</Button>} />
      <Table head={["", "Tên", "Giá từ", "Nhóm tuỳ chọn", "Trạng thái", ""]}
        empty={!products.length && <EmptyState>Chưa có sản phẩm. Nếu bạn vừa cập nhật web, hãy chạy supabase/migration_products.sql để chuyển gói & phụ kiện cũ sang.</EmptyState>}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="w-14">
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0]} alt="" className="h-9 w-9 rounded-[6px] object-cover" />
              ) : <div className="h-9 w-9 rounded-[6px] bg-[#f4f4f5]" />}
            </td>
            <td><Link href={`/admin/goi-san-pham/${p.id}`} className="font-medium text-[#18181b] hover:text-[#ff5fa2]">{p.name}</Link></td>
            <td className="tabular-nums">{formatVND(fromPrice(p))}</td>
            <td className="text-[13px] text-[#71717a]">{p.groups.map((g) => `${g.name} (${g.options.length})`).join(" · ") || "—"}</td>
            <td>{p.is_active ? <Badge tone="green">Đang bán</Badge> : <Badge>Đang ẩn</Badge>}</td>
            <td className="text-right"><Link href={`/admin/goi-san-pham/${p.id}`} className={btnClass("ghost", "sm")}>Sửa</Link></td>
          </tr>
        ))}
      </Table>
    </AdminPage>
  );
}
