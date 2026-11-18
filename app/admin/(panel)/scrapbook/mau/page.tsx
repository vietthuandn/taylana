import { redirect } from "next/navigation";

// "Xem mẫu" đã chuyển vào tab "Mẫu" của trang Chất liệu Scrapbook
export default function Page() { redirect("/admin/scrapbook?tab=mau"); }
