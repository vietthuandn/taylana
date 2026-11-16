// 6 dịch vụ hiển thị trên trang chủ và menu.
export const services = [
  { href: "/dat-don", title: "Đặt đơn", desc: "Chọn gói CD, phụ kiện & gửi đơn", icon: "bag", color: "bg-pink-200" },
  { href: "/huong-dan", title: "Hướng dẫn làm file", desc: "Kích thước bìa, đĩa, booklet", icon: "book", color: "bg-matcha-200" },
  { href: "/custom-cd", title: "Custom CD", desc: "Tự thiết kế bìa & mặt đĩa", icon: "cd", color: "bg-butter-100" },
  { href: "/photostrip", title: "Làm Photostrip", desc: "Ghép dải ảnh 3–4 khung", icon: "film", color: "bg-pink-100" },
  { href: "/nop-file", title: "Nộp file", desc: "Gửi file in cho đơn của bạn", icon: "upload", color: "bg-matcha-100" },
  { href: "/san-pham", title: "Sản phẩm & Đánh giá", desc: "Xem tiệm đã làm gì", icon: "gallery", color: "bg-cream-200" },
] as const;
