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
