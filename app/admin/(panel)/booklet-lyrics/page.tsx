import { AdminPage, PageHeader } from "@/components/admin/ui";
import { LyricsAdmin } from "./LyricsAdmin";

export default function Page() {
  return (
    <AdminPage>
      <PageHeader title="Booklet Lyrics" description="Cài đặt trang Thiết kế → Booklet Lyrics: giới hạn lyrics, cỡ chữ, font, bảng màu, bật / tắt mẫu." />
      <LyricsAdmin />
    </AdminPage>
  );
}
