import { AdminPage, PageHeader } from "@/components/admin/ui";
import { CropTool } from "@/components/admin/tools/CropTool";

export default function Page() {
  return (
    <AdminPage wide>
      <PageHeader title="Cắt đúng khổ" description="Cắt ảnh đúng khổ in (300 DPI, RGB). Ảnh chỉ xử lý trên máy bạn — tải lại trang là mất." />
      <CropTool />
    </AdminPage>
  );
}
