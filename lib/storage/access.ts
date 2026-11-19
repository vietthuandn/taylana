import "server-only";
/* Ai được ghi / đọc / xoá file nào (kiểm tra bằng phiên đăng nhập Supabase của người gọi). Database tự kiểm tra lại bằng RLS. */
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { rootOf } from "./keys";

export type Who = { userId: string | null; role: "admin" | "designer" | null; sb: Awaited<ReturnType<typeof createClient>> };
export async function whoAmI(): Promise<Who> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { userId: null, role: null, sb };
  let role: Who["role"] = null;
  const r = await sb.rpc("my_staff_role");
  if (!r.error) role = r.data === "admin" || r.data === "designer" ? r.data : null;
  else if ((await sb.rpc("is_admin")).data === true) role = "admin"; // chưa chạy migration_staff_templates.sql
  return { userId: user.id, role, sb };
}
const staff = (w: Who) => w.role === "admin" || w.role === "designer";
const seg = (key: string, i: number) => key.split("/")[i] ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** đơn còn nhận file + (chủ đơn | đơn khách vãng lai) — giống quy tắc upload cũ của bucket order-files */
async function orderWritable(w: Who, orderId: string) {
  if (!UUID.test(orderId)) return false;
  const { data: accepts } = await w.sb.rpc("order_accepts_files", { p_order_id: orderId });
  if (accepts !== true) return false;
  const svc = serviceClient();
  if (!svc) return true;
  const { data } = await svc.from("orders").select("user_id").eq("id", orderId).maybeSingle();
  return !!data && (!data.user_id || data.user_id === w.userId);
}
async function orderOwned(w: Who, orderId: string) {
  if (!w.userId || !UUID.test(orderId)) return false;
  const { data } = await w.sb.rpc("order_owned_by_me", { p_order_id: orderId });
  return data === true;
}

export async function canWrite(w: Who, key: string) {
  if (w.role === "admin") return true;
  switch (rootOf(key)) {
    case "scrapbook": return staff(w); // chất liệu, ảnh nền, ảnh thu nhỏ mẫu (nhà thiết kế được)
    case "mockups": return false; // ảnh mockup, Template Canva: chỉ admin
    case "public-assets": return seg(key, 1) === "reviews" || (staff(w) && ["templates", "photostrip"].includes(seg(key, 1)));
    case "order-files": return orderWritable(w, seg(key, 1));
    case "design-assets": return !!w.userId && seg(key, 1) === w.userId;
    default: return false;
  }
}
export async function canRead(w: Who, key: string) {
  if (w.role === "admin") return true;
  switch (rootOf(key)) {
    case "order-files": return orderOwned(w, seg(key, 1));
    case "design-assets": return !!w.userId && seg(key, 1) === w.userId;
    case "mockup-shares": return false;
    default: return true; // file công khai
  }
}
export async function canDelete(w: Who, key: string) {
  if (w.role === "admin") return true;
  switch (rootOf(key)) {
    case "scrapbook": return staff(w);
    case "mockups": return false;
    case "public-assets": return staff(w) && ["templates", "photostrip"].includes(seg(key, 1));
    case "design-assets": return !!w.userId && seg(key, 1) === w.userId;
    default: return false;
  }
}
