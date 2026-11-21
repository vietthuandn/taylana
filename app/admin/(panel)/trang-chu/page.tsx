import { redirect } from "next/navigation";

// Đường dẫn cũ → trang chỉnh nội dung Mẫu 1 trong "Giao diện trang chủ"
export default function Page() {
  redirect("/admin/giao-dien/mau-1");
}
