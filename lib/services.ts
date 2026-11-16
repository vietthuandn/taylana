// 6 dịch vụ hiển thị trên trang chủ, menu và footer. color = màu bông hoa nền icon.
export const services = [
  { href: "/dat-don", title: "Đặt đơn", short: "Đặt đơn", desc: "Chọn gói CD & phụ kiện", icon: "bag", color: "lime" },
  { href: "/huong-dan", title: "Hướng dẫn làm file", short: "Hướng dẫn", desc: "Kích thước bìa, đĩa, booklet", icon: "book", color: "violet" },
  { href: "/custom-cd", title: "Custom CD", short: "Custom CD", desc: "Tự thiết kế bìa & mặt đĩa", icon: "cd", color: "hot" },
  { href: "/photostrip", title: "Làm Photostrip", short: "Photostrip", desc: "Ghép dải ảnh 3–4 khung", icon: "film", color: "lime" },
  { href: "/gui-file-in", title: "Gửi file in", short: "Gửi file in", desc: "Gửi ảnh in và link nhạc", icon: "upload", color: "violet" },
  { href: "/san-pham", title: "Sản phẩm & Đánh giá", short: "Sản phẩm", desc: "Xem tiệm đã làm gì", icon: "gallery", color: "hot" },
] as const;
