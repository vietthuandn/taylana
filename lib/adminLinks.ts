// Menu trang quản trị (dùng được ở cả server và trình duyệt), gom theo nhóm.
export type AdminLink = { href: string; label: string; icon: string; group: string };

export const adminGroups: { title: string; links: AdminLink[] }[] = [
  { title: "Tổng quan", links: [
    { href: "/admin", label: "Tổng quan", icon: "dashboard", group: "Tổng quan" },
    { href: "/admin/don-hang", label: "Đơn hàng", icon: "orders", group: "Tổng quan" },
  ] },
  { title: "Sản phẩm", links: [
    { href: "/admin/goi-san-pham", label: "Gói & phụ kiện", icon: "package", group: "Sản phẩm" },
    { href: "/admin/san-pham", label: "Sản phẩm & đánh giá", icon: "star", group: "Sản phẩm" },
    { href: "/admin/giam-gia", label: "Giảm giá", icon: "tag", group: "Sản phẩm" },
  ] },
  { title: "Nội dung", links: [
    { href: "/admin/trang-chu", label: "Trang chủ", icon: "home", group: "Nội dung" },
    { href: "/admin/huong-dan", label: "Hướng dẫn", icon: "book", group: "Nội dung" },
    { href: "/admin/lien-he", label: "Liên hệ", icon: "phone", group: "Nội dung" },
  ] },
  { title: "Thiết kế", links: [
    { href: "/admin/mau-cd", label: "Mẫu Custom CD", icon: "disc", group: "Thiết kế" },
    { href: "/admin/photostrip", label: "Khung Photostrip", icon: "strip", group: "Thiết kế" },
  ] },
  { title: "Hệ thống", links: [
    { href: "/admin/thanh-toan", label: "Thanh toán", icon: "card", group: "Hệ thống" },
    { href: "/admin/don-file", label: "Dọn file", icon: "trash", group: "Hệ thống" },
  ] },
];

export const adminLinks = adminGroups.flatMap((g) => g.links);

export const activeAdminLink = (path: string) =>
  adminLinks.filter((l) => (l.href === "/admin" ? path === "/admin" : path.startsWith(l.href))).at(-1);

// Trang cần workspace lớn (full màn hình, không padding)
export const isWorkspacePath = (path: string) => path.startsWith("/admin/mau-cd") || path.startsWith("/admin/photostrip");
