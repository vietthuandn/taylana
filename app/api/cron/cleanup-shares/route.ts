/* Gọi mỗi 15 phút bởi pg_cron + pg_net của Supabase (xem supabase/migration_mockup_shares.sql).
   Chỉ chạy khi header Authorization: Bearer <CRON_SECRET> đúng.
   1) Dọn link chia sẻ mockup hết hạn (xoá file trên kho lưu trữ rồi xoá dòng).
   2) Chuyển file cũ Supabase Storage → R2 thêm 1 đợt (chạy nền sau khi trả lời; xong hết thì tự dừng — lib/storage/migrate.ts). */
import { after } from "next/server";
import { cleanupExpiredShares } from "@/lib/mockupShare/cleanup";
import { runMigrationBatch } from "@/lib/storage/migrate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  after(async () => { await runMigrationBatch().catch(() => null); });
  const r = await cleanupExpiredShares();
  return Response.json(r, { status: r.ok ? 200 : 500 });
}
