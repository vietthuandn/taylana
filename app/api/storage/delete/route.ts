/* POST /api/storage/delete { keys?: string[]; urls?: string[]; prefixes?: string[] } → { deleted }
   Xoá qua R2 (hoặc Supabase Storage API) — có kiểm tra quyền từng file. Tiền tố chỉ cho thư mục 1 link chia sẻ / 1 người dùng. */
import { deleteObjects, deletePrefix } from "@/lib/storage";
import { canDelete, whoAmI } from "@/lib/storage/access";
import { isValidKey, keyFromUrl } from "@/lib/storage/keys";

export async function POST(req: Request) {
  let b: { keys?: string[]; urls?: string[]; prefixes?: string[] };
  try { b = await req.json(); } catch { return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  const keys = [...(b.keys ?? []).map(String), ...(b.urls ?? []).map((u) => keyFromUrl(String(u)) ?? "")].filter(isValidKey).slice(0, 5000);
  const prefixes = (b.prefixes ?? []).map(String).filter((p) => /^(mockup-shares|design-assets)\/[A-Za-z0-9-]{8,64}\/$/.test(p));
  const w = await whoAmI();
  for (const k of [...keys, ...prefixes]) if (!(await canDelete(w, k))) return Response.json({ error: "Bạn không có quyền xoá file này" }, { status: 403 });
  try {
    let deleted = await deleteObjects(keys);
    for (const p of prefixes) deleted += await deletePrefix(p);
    return Response.json({ deleted });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Xoá file thất bại" }, { status: 500 }); }
}
