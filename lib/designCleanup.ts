import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { deleteObjects } from "@/lib/storage";

/** đường dẫn ảnh (design-assets/<user_id>/…) mà 1 thiết kế dùng (giống lib/designs.ts → assetPaths) */
function assetPaths(data: unknown): Set<string> {
  const out = new Set<string>();
  const re = /^(?:sb:)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|gif))$/i;
  const walk = (v: unknown) => {
    if (typeof v === "string") { const m = re.exec(v); if (m) out.add(m[1]); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(data);
  return out;
}

/** Xoá thiết kế của khách đã quá 24 giờ kể từ lần sửa gần nhất: ảnh / file in trên kho lưu trữ (trừ ảnh thiết kế khác còn dùng) rồi dòng dữ liệu. */
export async function cleanupExpiredDesigns() {
  const sb = serviceClient();
  if (!sb) return { designs: 0, files: 0 };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: old } = await sb.from("designs").select("id, user_id, data").lt("updated_at", since).limit(200);
  if (!old?.length) return { designs: 0, files: 0 };
  const users = [...new Set(old.map((d) => d.user_id as string))];
  const { data: keep } = await sb.from("designs").select("data").in("user_id", users).gte("updated_at", since);
  const used = new Set((keep ?? []).flatMap((d) => [...assetPaths(d.data)]));
  const keys = [...new Set(old.flatMap((d) => [...assetPaths(d.data)]))].filter((p) => !used.has(p)).map((p) => `design-assets/${p}`);
  let files = 0;
  if (keys.length) {
    try { files = await deleteObjects(keys); } catch { return { designs: 0, files: 0 }; } // xoá file lỗi → giữ dòng để lần sau thử lại
    await sb.from("user_files").delete().in("key", keys).then(() => undefined, () => undefined);
  }
  const d = await sb.from("designs").delete().in("id", old.map((x) => x.id));
  return { designs: d.error ? 0 : old.length, files };
}
