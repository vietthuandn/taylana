import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { hasSupabase } from "./supabase/env";
import type { StaffRole } from "./roles";

/** vai trò của người đang đăng nhập (staff_roles; chưa chạy migration → dùng is_admin như cũ) */
async function roleOf(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ role: StaffRole | null; error?: string }> {
  const r = await supabase.rpc("my_staff_role");
  if (!r.error) return { role: r.data === "admin" || r.data === "designer" ? r.data : null };
  const a = await supabase.rpc("is_admin");
  if (a.error) return { role: null, error: "is_admin: " + a.error.message };
  return { role: a.data ? "admin" : null };
}
// Gọi ở đầu mọi trang / hành động trong /admin: trả về người dùng + vai trò (admin / designer / null).
export async function requireStaff() {
  if (!hasSupabase) redirect("/admin/login?loi=env");
  let problem = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const r = await roleOf(supabase);
      if (!r.error) return { supabase, user, role: r.role, isAdmin: r.role === "admin" };
      problem = r.error;
    }
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e);
  }
  redirect(problem ? `/admin/login?loi=${encodeURIComponent(problem.slice(0, 300))}` : "/admin/login");
}
// Gọi ở đầu mọi trang/hành động admin.
// Chưa đăng nhập → về trang đăng nhập. Lỗi kết nối → về trang đăng nhập kèm lý do (thay vì sập trang).
export async function requireAdmin() {
  return requireStaff();
}
