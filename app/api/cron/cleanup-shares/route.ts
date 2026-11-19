/* Dọn link chia sẻ mockup hết hạn (gọi mỗi 15 phút bởi pg_cron + pg_net của Supabase — xem supabase/migration_mockup_shares.sql).
   Chỉ chạy khi header Authorization: Bearer <CRON_SECRET> đúng. Xoá file qua Storage API (service role, phía server) rồi xoá dòng. */
import { cleanupExpiredShares } from "@/lib/mockupShare/cleanup";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const r = await cleanupExpiredShares();
  return Response.json(r, { status: r.ok ? 200 : 500 });
}
