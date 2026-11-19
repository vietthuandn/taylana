import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { deletePrefix } from "@/lib/storage";

/** Xoá hẳn các link chia sẻ đã hết hạn: mọi file trong mockup-shares/<id>/ (R2 / Storage API — lib/storage) rồi dòng dữ liệu. */
export async function cleanupExpiredShares() {
  const sb = serviceClient();
  if (!sb) return { ok: false as const, error: "Thiếu SUPABASE_SERVICE_ROLE_KEY", shares: 0, files: 0 };
  const { data, error } = await sb.from("mockup_shares").select("id").lt("expires_at", new Date().toISOString()).limit(200);
  if (error) return { ok: false as const, error: error.message, shares: 0, files: 0 };
  let shares = 0, files = 0;
  for (const { id } of data ?? []) {
    try { files += await deletePrefix(`mockup-shares/${id}/`); }
    catch { continue; } // file chưa xoá được → giữ dòng để lần sau thử lại
    const d = await sb.from("mockup_shares").delete().eq("id", id);
    if (!d.error) shares++;
  }
  return { ok: true as const, shares, files };
}
