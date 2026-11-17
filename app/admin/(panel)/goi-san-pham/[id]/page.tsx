import Link from "next/link";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "./ProductEditor";

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminPage>
      <Link href="/admin/goi-san-pham" className="mb-3 inline-flex items-center gap-1 text-[13px] text-[#71717a] hover:text-[#18181b]">← Sản phẩm của tôi</Link>
      <PageHeader title={id === "moi" ? "Tạo sản phẩm" : "Chi tiết sản phẩm"} description="Thông tin sản phẩm, các nhóm tuỳ chọn và lựa chọn." />
      <ProductEditor id={id} />
    </AdminPage>
  );
}
