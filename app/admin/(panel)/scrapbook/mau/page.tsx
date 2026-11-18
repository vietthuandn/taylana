import Link from "next/link";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { btnClass } from "@/components/admin/styles";
import { TemplatePreview } from "./TemplatePreview";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Xem mẫu Scrapbook" description="Mỗi số ảnh có 5 mẫu (dựng bằng ảnh thử). Đổi seed để ra bố cục khác, ẩn mẫu không muốn khách thấy."
        actions={<Link href="/admin/scrapbook" className={btnClass("secondary", "sm")}>← Chất liệu</Link>} />
      <TemplatePreview />
    </AdminPage>
  );
}
