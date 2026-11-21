import { getStatusPage } from "@/lib/statusPagesLoad";
import { StatusView } from "@/components/site/StatusView";

export const metadata = { title: "Không tìm thấy trang" };

// 404 (trang hệ thống — không có header). Nội dung chỉnh ở Admin → Giao diện → Khác.
export default async function NotFound() {
  return <StatusView page={await getStatusPage("notfound")} full />;
}
