import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ShopeeOrders } from "./ShopeeOrders";

export const metadata = { title: "Đơn Shopee" };
// Tài chính → Đơn Shopee: dữ liệu đọc thẳng từ Supabase trên trình duyệt (RLS chỉ admin), đối chiếu Income ⇄ My Balance
export default async function Page() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect("/admin?khong-quyen=1");
  return <AdminPage wide><PageHeader title="Đơn Shopee" /><ShopeeOrders /></AdminPage>;
}
