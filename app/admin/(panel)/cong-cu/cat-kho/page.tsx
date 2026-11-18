import { AdminPage, PageHeader } from "@/components/admin/ui";
import { CropTool } from "@/components/admin/tools/CropTool";

export default function Page() {
  return (
    <AdminPage wide>
      <PageHeader title="Cắt đúng khổ" />
      <CropTool />
    </AdminPage>
  );
}
