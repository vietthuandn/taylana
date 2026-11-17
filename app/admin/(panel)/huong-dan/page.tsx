import { GuideAdmin } from "./GuideAdmin";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Hướng dẫn làm file" description="Mỗi mục gồm tiêu đề, đoạn chữ, ảnh minh hoạ (kèm chú thích) và các link. Link trong đoạn chữ cũng tự bấm được." />
      <GuideAdmin />
    </AdminPage>
  );
}
