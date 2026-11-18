import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { btnClass } from "@/components/admin/styles";
import { ScrapbookAdmin } from "./ScrapbookAdmin";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Chất liệu Scrapbook" description="Băng dính, sticker, khung ảnh, doodle, texture, mảnh giấy cho trang CD Scrapbook. Chưa có chất liệu thì web dùng bộ mặc định vẽ bằng code."
        actions={<Link href="/admin/scrapbook/mau" className={btnClass("secondary", "sm")}><LayoutGrid size={16} /> Xem mẫu</Link>} />
      <ScrapbookAdmin />
    </AdminPage>
  );
}
