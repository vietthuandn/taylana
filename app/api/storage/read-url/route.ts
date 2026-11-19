/* POST /api/storage/read-url { keys: string[] } → { urls: { key: signedUrl } } (hạn 1 giờ). Chỉ trả link cho file người gọi được xem. */
import { getSignedReadUrls } from "@/lib/storage";
import { canRead, whoAmI } from "@/lib/storage/access";
import { isPublicKey, isValidKey } from "@/lib/storage/keys";

export async function POST(req: Request) {
  let keys: string[] = [];
  try { keys = ((await req.json()).keys ?? []).map(String).slice(0, 500); } catch { return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  const w = await whoAmI();
  const ok: string[] = [];
  for (const k of new Set(keys)) if (isValidKey(k) && !isPublicKey(k) && (await canRead(w, k))) ok.push(k);
  try { return Response.json({ urls: await getSignedReadUrls(ok, 3600) }); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 }); }
}
