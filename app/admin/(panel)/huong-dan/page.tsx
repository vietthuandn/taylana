import { GuideAdmin } from "./GuideAdmin";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Hướng dẫn làm file" />
      <GuideAdmin />
    </AdminPage>
  );
}
