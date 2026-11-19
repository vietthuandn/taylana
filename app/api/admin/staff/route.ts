/* Quản lý tài khoản nội bộ (chỉ admin): danh sách · tạo · đổi vai trò / đặt lại mật khẩu / khoá / mở khoá · xoá.
   Kiểm tra quyền ở server (rpc is_admin bằng phiên đăng nhập của người gọi) rồi mới dùng Supabase Auth Admin API
   (service role key — chỉ ở server). Không cho tự xoá / tự hạ quyền / tự khoá chính mình, không cho xoá hay hạ quyền admin cuối cùng. */
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import type { StaffRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
type Row = { user_id: string; role: StaffRole; display_name: string | null; created_at: string; disabled: boolean };
const json = (v: unknown, status = 200) => Response.json(v, { status });
const ROLES: StaffRole[] = ["admin", "designer"];

async function guard() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { err: json({ error: "Chưa đăng nhập" }, 401) };
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) return { err: json({ error: "Chỉ quản trị viên được quản lý tài khoản" }, 403) };
  const svc = serviceClient();
  if (!svc) return { err: json({ error: "Máy chủ thiếu SUPABASE_SERVICE_ROLE_KEY" }, 500) };
  return { me: user.id, svc };
}
async function activeAdmins(svc: NonNullable<ReturnType<typeof serviceClient>>) {
  const { data } = await svc.from("staff_roles").select("user_id").eq("role", "admin").eq("disabled", false);
  return (data ?? []).map((r) => r.user_id as string);
}

export async function GET() {
  const g = await guard();
  if (g.err) return g.err;
  const { data, error } = await g.svc.from("staff_roles").select("*").order("created_at");
  if (error) return json({ error: error.message }, 500);
  const users = await g.svc.auth.admin.listUsers({ perPage: 1000 });
  const byId = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
  return json({ me: g.me, rows: ((data ?? []) as Row[]).map((r) => ({ ...r, email: byId.get(r.user_id)?.email ?? "", last_sign_in_at: byId.get(r.user_id)?.last_sign_in_at ?? null })) });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.err) return g.err;
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string; role?: StaffRole; display_name?: string };
  const email = b.email?.trim().toLowerCase() ?? "", password = b.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email không hợp lệ" }, 400);
  if (password.length < 8) return json({ error: "Mật khẩu tối thiểu 8 ký tự" }, 400);
  if (!b.role || !ROLES.includes(b.role)) return json({ error: "Vai trò không hợp lệ" }, 400);
  const c = await g.svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: b.display_name?.trim() || null } });
  if (c.error || !c.data.user) return json({ error: c.error?.message ?? "Không tạo được tài khoản" }, 400);
  const ins = await g.svc.from("staff_roles").insert({ user_id: c.data.user.id, role: b.role, display_name: b.display_name?.trim() || email });
  if (ins.error) { await g.svc.auth.admin.deleteUser(c.data.user.id); return json({ error: ins.error.message }, 500); }
  return json({ ok: true });
}

export async function PATCH(req: Request) {
  const g = await guard();
  if (g.err) return g.err;
  const b = (await req.json().catch(() => ({}))) as { user_id?: string; action?: "role" | "password" | "disable" | "enable" | "name"; value?: string };
  if (!b.user_id) return json({ error: "Thiếu tài khoản" }, 400);
  const { data: row } = await g.svc.from("staff_roles").select("*").eq("user_id", b.user_id).maybeSingle();
  if (!row) return json({ error: "Không tìm thấy tài khoản" }, 404);
  const admins = await activeAdmins(g.svc);
  const lastAdmin = row.role === "admin" && !row.disabled && admins.length <= 1;
  if (b.action === "role") {
    const role = b.value as StaffRole;
    if (!ROLES.includes(role)) return json({ error: "Vai trò không hợp lệ" }, 400);
    if (b.user_id === g.me && role !== "admin") return json({ error: "Không thể tự hạ quyền của chính mình" }, 400);
    if (lastAdmin && role !== "admin") return json({ error: "Phải còn ít nhất 1 quản trị viên" }, 400);
    const u = await g.svc.from("staff_roles").update({ role }).eq("user_id", b.user_id);
    return u.error ? json({ error: u.error.message }, 500) : json({ ok: true });
  }
  if (b.action === "password") {
    if (!b.value || b.value.length < 8) return json({ error: "Mật khẩu tối thiểu 8 ký tự" }, 400);
    const u = await g.svc.auth.admin.updateUserById(b.user_id, { password: b.value });
    return u.error ? json({ error: u.error.message }, 400) : json({ ok: true });
  }
  if (b.action === "disable" || b.action === "enable") {
    const off = b.action === "disable";
    if (off && b.user_id === g.me) return json({ error: "Không thể tự khoá tài khoản của chính mình" }, 400);
    if (off && lastAdmin) return json({ error: "Phải còn ít nhất 1 quản trị viên đang hoạt động" }, 400);
    const a = await g.svc.auth.admin.updateUserById(b.user_id, { ban_duration: off ? "876000h" : "none" });
    if (a.error) return json({ error: a.error.message }, 400);
    const u = await g.svc.from("staff_roles").update({ disabled: off }).eq("user_id", b.user_id);
    return u.error ? json({ error: u.error.message }, 500) : json({ ok: true });
  }
  if (b.action === "name") {
    const u = await g.svc.from("staff_roles").update({ display_name: b.value?.trim() || null }).eq("user_id", b.user_id);
    return u.error ? json({ error: u.error.message }, 500) : json({ ok: true });
  }
  return json({ error: "Thao tác không hợp lệ" }, 400);
}

export async function DELETE(req: Request) {
  const g = await guard();
  if (g.err) return g.err;
  const b = (await req.json().catch(() => ({}))) as { user_id?: string };
  if (!b.user_id) return json({ error: "Thiếu tài khoản" }, 400);
  if (b.user_id === g.me) return json({ error: "Không thể tự xoá tài khoản của chính mình" }, 400);
  const { data: row } = await g.svc.from("staff_roles").select("*").eq("user_id", b.user_id).maybeSingle();
  if (row?.role === "admin" && (await activeAdmins(g.svc)).filter((id) => id !== b.user_id).length < 1) return json({ error: "Không thể xoá quản trị viên cuối cùng" }, 400);
  const d = await g.svc.auth.admin.deleteUser(b.user_id); // staff_roles tự xoá theo (on delete cascade)
  if (d.error) return json({ error: d.error.message }, 400);
  await g.svc.from("staff_roles").delete().eq("user_id", b.user_id);
  return json({ ok: true });
}
