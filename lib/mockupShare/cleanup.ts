import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { SHARE_BUCKET } from "./types";

/** Xoá hẳn các link chia sẻ đã hết hạn: mọi file trong mockup-shares/<id>/ (qua Storage API) rồi dòng dữ liệu. */
export async function cleanupExpiredShares() {
  const sb = serviceClient();
  if (!sb) return { ok: false as const, error: "Thiếu SUPABASE_SERVICE_ROLE_KEY", shares: 0, files: 0 };
  const { data, error } = await sb.from("mockup_shares").select("id").lt("expires_at", new Date().toISOString()).limit(200);
  if (error) return { ok: false as const, error: error.message, shares: 0, files: 0 };
  let shares = 0, files = 0;
  for (const { id } of data ?? []) {
    const { data: list } = await sb.storage.from(SHARE_BUCKET).list(id, { limit: 1000 });
    const paths = (list ?? []).map((f) => `${id}/${f.name}`);
    if (paths.length) {
      const r = await sb.storage.from(SHARE_BUCKET).remove(paths);
      if (r.error) continue; // file chưa xoá được → giữ dòng để lần sau thử lại
      files += paths.length;
    }
    const d = await sb.from("mockup_shares").delete().eq("id", id);
    if (!d.error) shares++;
  }
  return { ok: true as const, shares, files };
}
