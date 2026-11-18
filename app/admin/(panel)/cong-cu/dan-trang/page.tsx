import { AdminPage, PageHeader } from "@/components/admin/ui";
import { BookletImposer } from "@/components/admin/tools/BookletImposer";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Dàn trang booklet" />
      <BookletImposer />
    </AdminPage>
  );
}
