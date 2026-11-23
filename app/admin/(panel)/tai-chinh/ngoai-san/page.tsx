import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { NgoaiSan } from "./NgoaiSan";

export const metadata = { title: "Thu nhập ngoài sàn" };
// Tài chính (chỉ admin): đọc / ghi thẳng Supabase từ trình duyệt (RLS chỉ admin)
export default async function Page() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect("/admin?khong-quyen=1");
  return <AdminPage wide><PageHeader title="Thu nhập ngoài sàn" /><NgoaiSan /></AdminPage>;
}
