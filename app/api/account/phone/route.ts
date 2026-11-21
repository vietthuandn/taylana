/* Khách tự đổi số điện thoại đăng nhập: chuẩn hoá SĐT → đổi email ảo của tài khoản (service role — chỉ ở server).
   Chỉ áp dụng cho tài khoản khách (email ảo), báo lỗi nếu số mới đã có người dùng. */
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { isCustomerEmail, normalizePhone, phoneToEmail, PHONE_ERROR } from "@/lib/phoneAuth";

export const dynamic = "force-dynamic";
const json = (v: unknown, status = 200) => Response.json(v, { status });

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Chưa đăng nhập" }, 401);
  if (!isCustomerEmail(user.email)) return json({ error: "Tài khoản nội bộ không đổi số điện thoại ở đây" }, 400);
  const b = (await req.json().catch(() => ({}))) as { phone?: string };
  const phone = normalizePhone(b.phone ?? "");
  if (!phone) return json({ error: PHONE_ERROR }, 400);
  const email = phoneToEmail(phone);
  if (email === user.email) return json({ ok: true, phone });
  const svc = serviceClient();
  if (!svc) return json({ error: "Máy chủ thiếu SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const u = await svc.auth.admin.updateUserById(user.id, { email, email_confirm: true, user_metadata: { ...user.user_metadata, phone } });
  if (u.error) {
    const taken = /already|registered|exists|duplicate/i.test(u.error.message);
    return json({ error: taken ? "Số điện thoại này đã có người dùng" : u.error.message }, 400);
  }
  return json({ ok: true, phone });
}
