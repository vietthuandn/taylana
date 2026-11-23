import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ImportShopee } from "./ImportShopee";

export const metadata = { title: "Nhập dữ liệu Shopee" };
// Tài chính → Nhập dữ liệu Shopee: đọc file Excel trên trình duyệt, ghi thẳng vào Supabase (RLS chỉ admin)
export default async function Page() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect("/admin?khong-quyen=1");
  return <AdminPage><PageHeader title="Nhập dữ liệu Shopee" /><ImportShopee /></AdminPage>;
}
