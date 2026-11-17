import { redirect } from "next/navigation";

// Giờ chỉ còn Custom CD → chuyển thẳng sang trình thiết kế
export default function DesignHubPage() {
  redirect("/custom-cd");
}
