"use server";
/* Dự phòng dọn link hết hạn: gọi sau khi admin tạo link mới — chạy nền (after), không chặn. Chỉ admin gọi được. */
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanupExpiredShares } from "./cleanup";

export async function triggerShareCleanup() {
  const sb = await createClient();
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) return false;
  after(async () => { await cleanupExpiredShares().catch(() => null); });
  return true;
}
