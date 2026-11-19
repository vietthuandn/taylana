/* Vai trò tài khoản nội bộ (bảng staff_roles): "admin" toàn quyền · "designer" (Nhà thiết kế) chỉ quản lý chất liệu + template.
   Dùng chung server (layout, proxy, API) + trình duyệt (sidebar). Database tự kiểm tra lại bằng RLS (hàm is_staff). */
export type StaffRole = "admin" | "designer";
export const ROLE_LABEL: Record<StaffRole, string> = { admin: "Quản trị viên", designer: "Nhà thiết kế" };
/** đường dẫn Nhà thiết kế được vào (kèm trang Tổng quan rút gọn /admin) */
export const DESIGNER_PATHS = ["/admin/thiet-ke/chat-lieu", "/admin/thiet-ke/template"];
export const designerHome = "/admin";
export function canAccess(role: StaffRole | null, path: string) {
  if (!role) return false;
  if (role === "admin") return true;
  if (path === "/admin" || path === "/admin/") return true;
  return DESIGNER_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
