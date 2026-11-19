/* GET /api/storage/usage?prefix=mockup-shares/ → { file_count, total_bytes } (chỉ admin) */
import { getBucketUsage } from "@/lib/storage";
import { whoAmI } from "@/lib/storage/access";
import { PRIVATE_ROOTS, PUBLIC_ROOTS } from "@/lib/storage/keys";

export async function GET(req: Request) {
  const prefix = new URL(req.url).searchParams.get("prefix") ?? "";
  if (![...PUBLIC_ROOTS, ...PRIVATE_ROOTS].some((r) => prefix === `${r}/`)) return Response.json({ error: "Tiền tố không hợp lệ" }, { status: 400 });
  if ((await whoAmI()).role !== "admin") return Response.json({ error: "Không có quyền" }, { status: 403 });
  try { return Response.json(await getBucketUsage(prefix)); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 }); }
}
