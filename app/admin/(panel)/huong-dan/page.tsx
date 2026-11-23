import { redirect } from "next/navigation";

// đã gộp vào Admin → Nội dung (tab)
export default function Page() { redirect("/admin/noi-dung?tab=huong-dan"); }
