/* Quản lý tài khoản → tab Khách hàng (chỉ admin).
   GET  → danh sách khách (tên, SĐT, lần cuối sử dụng, dung lượng ảnh từ bảng user_files, số đơn).
   POST { action: "clean" | "delete" | "recount", user_id?, phone? }
     clean   — xoá mọi thiết kế đã lưu + file của khách trên R2 (design-assets/<user_id>/).
     delete  — như clean, bỏ liên kết đơn cũ (giữ đơn), rồi xoá tài khoản đăng nhập. Phải gửi đúng SĐT khách để xác nhận.
     recount — tính lại dung lượng từ R2 (1 lần, khi admin bấm) cho file tải lên trước khi có bảng user_files. */
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { deletePrefix, listObjects } from "@/lib/storage";
import { isCustomerEmail, normalizePhone } from "@/lib/phoneAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const json = (v: unknown, status = 200) => Response.json(v, { status });
type Svc = NonNullable<ReturnType<typeof serviceClient>>;

async function guard() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { err: json({ error: "Chưa đăng nhập" }, 401) };
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) return { err: json({ error: "Chỉ quản trị viên được quản lý tài khoản" }, 403) };
  const svc = serviceClient();
  if (!svc) return { err: json({ error: "Máy chủ thiếu SUPABASE_SERVICE_ROLE_KEY" }, 500) };
  return { svc };
}
async function allUsers(svc: Svc) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const r = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    const us = r.data?.users ?? [];
    out.push(...us);
    if (us.length < 1000) break;
  }
  return out;
}
async function selectAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
async function clean(svc: Svc, uid: string) {
  const n = await deletePrefix(`design-assets/${uid}/`);
  const d = await svc.from("designs").delete().eq("user_id", uid);
  if (d.error) throw new Error(d.error.message);
  await svc.from("user_files").delete().eq("user_id", uid);
  return n;
}

export async function GET() {
  const g = await guard();
  if (g.err) return g.err;
  try {
    const [users, files, orders, staff] = await Promise.all([
      allUsers(g.svc),
      selectAll<{ user_id: string; size: number }>((a, b) => g.svc.from("user_files").select("user_id, size").range(a, b)).catch(() => null),
      selectAll<{ user_id: string }>((a, b) => g.svc.from("orders").select("user_id").not("user_id", "is", null).range(a, b)),
      g.svc.from("staff_roles").select("user_id").then((r) => new Set((r.data ?? []).map((x) => x.user_id as string))),
    ]);
    const bytes = new Map<string, number>(), cnt = new Map<string, number>();
    for (const f of files ?? []) bytes.set(f.user_id, (bytes.get(f.user_id) ?? 0) + Number(f.size));
    for (const o of orders) cnt.set(o.user_id, (cnt.get(o.user_id) ?? 0) + 1);
    const rows = users.filter((u) => isCustomerEmail(u.email) && !staff.has(u.id)).map((u) => ({
      id: u.id,
      name: (u.user_metadata?.display_name as string) || "",
      phone: (u.user_metadata?.phone as string) || u.email!.split("@")[0],
      last_sign_in_at: u.last_sign_in_at ?? null,
      created_at: u.created_at,
      bytes: bytes.get(u.id) ?? 0,
      orders: cnt.get(u.id) ?? 0,
    }));
    return json({ rows, noTable: files === null });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "Lỗi tải danh sách" }, 500); }
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.err) return g.err;
  const b = (await req.json().catch(() => ({}))) as { action?: string; user_id?: string; phone?: string };
  try {
    if (b.action === "recount") {
      const files = await listObjects("design-assets/");
      const rows = files.map((f) => ({ key: f.key, user_id: f.key.split("/")[1], size: f.size })).filter((r) => /^[0-9a-f-]{36}$/.test(r.user_id));
      const ids = new Set((await allUsers(g.svc)).map((u) => u.id));
      const ok = rows.filter((r) => ids.has(r.user_id));
      for (let i = 0; i < ok.length; i += 500) {
        const r = await g.svc.from("user_files").upsert(ok.slice(i, i + 500), { onConflict: "key" });
        if (r.error) throw new Error(r.error.message);
      }
      return json({ ok: true, files: ok.length });
    }
    if (!b.user_id || !/^[0-9a-f-]{36}$/.test(b.user_id)) return json({ error: "Thiếu tài khoản" }, 400);
    const u = await g.svc.auth.admin.getUserById(b.user_id);
    const user = u.data?.user;
    if (!user || !isCustomerEmail(user.email)) return json({ error: "Không tìm thấy tài khoản khách" }, 404);
    const { data: st } = await g.svc.from("staff_roles").select("user_id").eq("user_id", user.id).maybeSingle();
    if (st) return json({ error: "Đây là tài khoản nội bộ" }, 400);
    if (b.action === "clean") return json({ ok: true, deleted: await clean(g.svc, user.id) });
    if (b.action === "delete") {
      const phone = (user.user_metadata?.phone as string) || user.email!.split("@")[0];
      if (normalizePhone(b.phone ?? "") !== normalizePhone(phone)) return json({ error: "Số điện thoại xác nhận không khớp" }, 400);
      await clean(g.svc, user.id);
      const o = await g.svc.from("orders").update({ user_id: null }).eq("user_id", user.id);
      if (o.error) throw new Error(o.error.message);
      const d = await g.svc.auth.admin.deleteUser(user.id);
      if (d.error) throw new Error(d.error.message);
      return json({ ok: true });
    }
    return json({ error: "Thao tác không hợp lệ" }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : "Có lỗi" }, 500); }
}
