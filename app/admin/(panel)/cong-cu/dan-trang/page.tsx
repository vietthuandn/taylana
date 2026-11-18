import { AdminPage, PageHeader } from "@/components/admin/ui";
import { BookletImposer } from "@/components/admin/tools/BookletImposer";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Dàn trang booklet" description="Ghép trang booklet thành tờ in đóng gáy giữa (24 × 12 cm, 300 DPI). Ảnh chỉ xử lý trên máy bạn — tải lại trang là mất." />
      <BookletImposer />
    </AdminPage>
  );
}
