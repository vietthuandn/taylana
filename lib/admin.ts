import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { hasSupabase } from "./supabase/env";

// Gọi ở đầu mọi trang/hành động admin. Không phải admin → chuyển về trang đăng nhập.
export async function requireAdmin() {
  if (!hasSupabase) redirect("/admin/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, user, isAdmin: Boolean(isAdmin) };
}
