// Menu trang quản trị (dùng được ở cả server và trình duyệt). soon = giai đoạn sau.
export const adminLinks = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/don-hang", label: "Đơn hàng" },
  { href: "/admin/goi-san-pham", label: "Gói & phụ kiện" },
  { href: "/admin/san-pham", label: "Sản phẩm & đánh giá" },
  { href: "/admin/huong-dan", label: "Hướng dẫn" },
  { href: "/admin/mau-cd", label: "Mẫu Custom CD", soon: true },
  { href: "/admin/photostrip", label: "Khung Photostrip", soon: true },
  { href: "/admin/don-file", label: "Dọn file" },
  { href: "/admin/cai-dat", label: "Trang chủ & liên hệ" },
] as { href: string; label: string; soon?: boolean }[];
