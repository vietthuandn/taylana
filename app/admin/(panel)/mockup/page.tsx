import { AdminPage, PageHeader } from "@/components/admin/ui";
import { MockupAdmin } from "./MockupAdmin";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Mẫu mockup" />
      <MockupAdmin />
    </AdminPage>
  );
}
