// Menu trang quản trị (dùng được ở cả server và trình duyệt), gom theo nhóm.
export type AdminLink = { href: string; label: string; icon: string; group: string };

export const adminGroups: { title: string; links: AdminLink[] }[] = [
  { title: "Tổng quan", links: [
    { href: "/admin", label: "Tổng quan", icon: "dashboard", group: "Tổng quan" },
    { href: "/admin/don-hang", label: "Đơn hàng", icon: "orders", group: "Tổng quan" },
  ] },
  { title: "Sản phẩm", links: [
    { href: "/admin/goi-san-pham", label: "Sản phẩm của tôi", icon: "package", group: "Sản phẩm" },
    { href: "/admin/giam-gia", label: "Giảm giá", icon: "tag", group: "Sản phẩm" },
  ] },
  { title: "Nội dung", links: [
    { href: "/admin/giao-dien", label: "Giao diện", icon: "layout", group: "Nội dung" },
    { href: "/admin/noi-dung", label: "Nội dung", icon: "book", group: "Nội dung" }, // tab Gallery · Hướng dẫn · Liên hệ
  ] },
  { title: "Thiết kế", links: [
    { href: "/admin/thiet-ke/chat-lieu", label: "Quản lý chất liệu", icon: "sticker", group: "Thiết kế" },
    { href: "/admin/thiet-ke/template", label: "Quản lý template", icon: "layout", group: "Thiết kế" },
    { href: "/admin/link-chia-se", label: "Link chia sẻ", icon: "share", group: "Thiết kế" },
  ] },
  { title: "Công cụ", links: [
    { href: "/admin/ban-in", label: "Bàn in", icon: "printer", group: "Công cụ" },
    { href: "/admin/cong-cu/dan-trang", label: "Dàn trang booklet", icon: "book2", group: "Công cụ" },
    { href: "/admin/cong-cu/cat-kho", label: "Cắt đúng khổ", icon: "crop", group: "Công cụ" },
  ] },
  { title: "Tài chính", links: [
    { href: "/admin/tai-chinh", label: "Tổng quan tài chính", icon: "chart", group: "Tài chính" },
    { href: "/admin/tai-chinh/don-shopee", label: "Đơn Shopee", icon: "wallet", group: "Tài chính" },
    { href: "/admin/tai-chinh/ngoai-san", label: "Thu nhập ngoài sàn", icon: "cash", group: "Tài chính" },
    { href: "/admin/tai-chinh/nguyen-lieu", label: "Nguyên liệu", icon: "boxes", group: "Tài chính" },
    { href: "/admin/tai-chinh/cong-thuc", label: "Công thức giá vốn", icon: "recipe", group: "Tài chính" },
    { href: "/admin/tai-chinh/nhap", label: "Nhập dữ liệu Shopee", icon: "upload", group: "Tài chính" },
  ] },
  { title: "Hệ thống", links: [
    { href: "/admin/thanh-toan", label: "Thanh toán", icon: "card", group: "Hệ thống" },
    { href: "/admin/van-chuyen", label: "Vận chuyển", icon: "truck", group: "Hệ thống" },
    { href: "/admin/don-file", label: "Dọn file", icon: "trash", group: "Hệ thống" },
    { href: "/admin/tai-khoan", label: "Quản lý tài khoản", icon: "users", group: "Hệ thống" },
  ] },
];

export const adminLinks = adminGroups.flatMap((g) => g.links);

export const activeAdminLink = (path: string) =>
  adminLinks.filter((l) => (l.href === "/admin" ? path === "/admin" : path.startsWith(l.href))).at(-1);

// Trang cần workspace lớn (full màn hình, không padding)
// trình chỉnh (cao đúng màn hình, không cuộn cả trang — panel tự cuộn): sửa mẫu, Photostrip, công cụ
export const isWorkspacePath = (path: string) => /^\/admin\/thiet-ke\/template\/(photostrip|sua)/.test(path) || /^\/admin\/mockup\/.+/.test(path) || path.startsWith("/admin/cong-cu/");
