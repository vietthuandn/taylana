// Menu trang quản trị (dùng được ở cả server và trình duyệt). soon = giai đoạn sau.
export const adminLinks = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/don-hang", label: "Đơn hàng" },
  { href: "/admin/goi-san-pham", label: "Gói & phụ kiện" },
  { href: "/admin/san-pham", label: "Sản phẩm & đánh giá" },
  { href: "/admin/huong-dan", label: "Hướng dẫn" },
  { href: "/admin/mau-cd", label: "Mẫu Custom CD" },
  { href: "/admin/photostrip", label: "Khung Photostrip" },
  { href: "/admin/don-file", label: "Dọn file" },
  { href: "/admin/trang-chu", label: "Trang chủ" },
  { href: "/admin/lien-he", label: "Liên hệ" },
] as { href: string; label: string; soon?: boolean }[];
