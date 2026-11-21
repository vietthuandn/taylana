import { redirect } from "next/navigation";

// Link cũ → mục Trang chủ mới
export default function OldSettingsPage() {
  redirect("/admin/giao-dien/mau-1");
}
