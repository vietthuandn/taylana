/* Vai trò tài khoản nội bộ (bảng staff_roles): "admin" toàn quyền · "designer" (Nhà thiết kế) chỉ quản lý chất liệu + template.
   Dùng chung server (layout, proxy, API) + trình duyệt (sidebar). Database tự kiểm tra lại bằng RLS (hàm is_staff). */
export type StaffRole = "admin" | "designer";
export const ROLE_LABEL: Record<StaffRole, string> = { admin: "Quản trị viên", designer: "Nhà thiết kế" };
/** đường dẫn Nhà thiết kế được vào (kèm trang Tổng quan rút gọn /admin): Quản lý chất liệu (mọi tab) + Quản lý template gồm
   CD Template, Booklet Template (Trang đơn · Trang đôi · Trình tạo template), Khung Photostrip và trình sửa mẫu.
   KHÔNG: Booklet Lyrics (cài đặt), Template Canva, Mockup, Link chia sẻ và mọi trang khác. */
export const DESIGNER_PATHS = ["/admin/thiet-ke/chat-lieu", "/admin/thiet-ke/template/cd-template", "/admin/thiet-ke/template/booklet-template", "/admin/thiet-ke/template/photostrip", "/admin/thiet-ke/template/sua"];
/** tab Quản lý template nhà thiết kế thấy */
export const DESIGNER_TEMPLATE_TABS = ["cd-template", "booklet-template", "photostrip"];
export const designerHome = "/admin";
export function canAccess(role: StaffRole | null, path: string) {
  if (!role) return false;
  if (role === "admin") return true;
  if (path === "/admin" || path === "/admin/" || path === "/admin/thiet-ke/template") return true;
  return DESIGNER_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
