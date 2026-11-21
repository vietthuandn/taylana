"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { findHomeVariant } from "@/lib/homeVariants";

// Đặt mẫu trang chủ chính thức (chỉ admin)
export async function setActiveHomeVariant(id: string): Promise<{ error?: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Chỉ admin được đổi trang chủ." };
  if (!findHomeVariant(id)) return { error: "Mẫu không tồn tại." };
  const { error } = await supabase.from("site_settings").upsert({ key: "active_home_variant", value: id, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin/giao-dien");
  return {};
}

// Xoá mẫu trang chủ (chỉ admin): xoá sạch ghi chú + dữ liệu riêng của mẫu, ẩn mẫu vĩnh viễn (site_settings.deleted_home_variants).
// Không xoá được mẫu đang dùng làm trang chủ.
export async function deleteHomeVariant(id: string): Promise<{ error?: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Chỉ admin được xoá mẫu." };
  if (!findHomeVariant(id)) return { error: "Mẫu không tồn tại." };
  const keys = ["active_home_variant", "variant_settings", "deleted_home_variants"];
  const { data } = await supabase.from("site_settings").select("key, value").in("key", keys);
  const val = (k: string) => data?.find((r) => r.key === k)?.value;
  if ((val("active_home_variant") ?? "v1-hien-tai") === id) return { error: "Đây là mẫu đang dùng làm trang chủ — đặt mẫu khác làm trang chủ trước khi xoá." };
  const now = new Date().toISOString();
  const vs = val("variant_settings");
  const rows: { key: string; value: unknown; updated_at: string }[] = [];
  if (vs && typeof vs === "object" && id in (vs as object)) {
    const rest = { ...(vs as Record<string, unknown>) }; delete rest[id];
    rows.push({ key: "variant_settings", value: rest, updated_at: now });
  }
  const del = Array.isArray(val("deleted_home_variants")) ? (val("deleted_home_variants") as string[]) : [];
  rows.push({ key: "deleted_home_variants", value: [...new Set([...del, id])], updated_at: now });
  const up = await supabase.from("site_settings").upsert(rows);
  if (up.error) return { error: up.error.message };
  await supabase.from("home_variant_notes").delete().eq("variant_id", id);
  revalidatePath("/");
  revalidatePath("/admin/giao-dien");
  return {};
}
