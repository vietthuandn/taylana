import { FEATURE_PHOTOSTRIP, FEATURE_UPLOAD_FILES } from "./features";

// Các dịch vụ hiển thị trên trang chủ, menu và footer. color = màu bông hoa nền icon.
const allServices = [
  { href: "/dat-don", title: "Đặt đơn", short: "Đặt đơn", desc: "Chọn gói CD & phụ kiện", icon: "bag", color: "lime" },
  { href: "/huong-dan", title: "Hướng dẫn làm file", short: "Hướng dẫn", desc: "Kích thước bìa, đĩa, booklet", icon: "book", color: "violet" },
  { href: "/thiet-ke", title: "Thiết Kế", short: "Thiết Kế", desc: "Tự thiết kế bìa & mặt đĩa", icon: "cd", color: "hot" },
  FEATURE_UPLOAD_FILES
    ? { href: "/gui-file", title: "Gửi file", short: "Gửi file", desc: "Gửi ảnh in và link nhạc", icon: "upload", color: "violet" }
    : { href: "/thiet-ke/mockup", title: "Lên mockup", short: "Lên mockup", desc: "Xem ảnh của bạn trên hộp CD", icon: "cd", color: "violet" },
  { href: "/photostrip", title: "Làm Photostrip", short: "Photostrip", desc: "Ghép dải ảnh 3–4 khung", icon: "film", color: "lime" },
  { href: "/ve-chung-toi", title: "Về chúng tôi", short: "Về chúng tôi", desc: "Những sản phẩm tiệm đã làm", icon: "gallery", color: "hot" },
] as const;

export const services = allServices.filter((s) => FEATURE_PHOTOSTRIP || s.href !== "/photostrip");

