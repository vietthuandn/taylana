import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { hasSupabase } from "./supabase/env";

// Gọi ở đầu mọi trang/hành động admin.
// Chưa đăng nhập → về trang đăng nhập. Lỗi kết nối → về trang đăng nhập kèm lý do (thay vì sập trang).
export async function requireAdmin() {
  if (!hasSupabase) redirect("/admin/login?loi=env");
  let problem = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: isAdmin, error } = await supabase.rpc("is_admin");
      if (!error) return { supabase, user, isAdmin: Boolean(isAdmin) };
      problem = "is_admin: " + error.message;
    }
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e);
  }
  redirect(problem ? `/admin/login?loi=${encodeURIComponent(problem.slice(0, 300))}` : "/admin/login");
}
