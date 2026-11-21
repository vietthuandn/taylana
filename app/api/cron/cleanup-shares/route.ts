/* Gọi bởi pg_cron + pg_net của Supabase — CHỈ khi có link chia sẻ mockup hết hạn (lịch kiểm tra trong SQL, không gọi Vercel vô ích).
   Chỉ chạy khi header Authorization: Bearer <CRON_SECRET> đúng. Dọn link hết hạn (xoá file trên kho lưu trữ rồi xoá dòng).
   (Bước chuyển file cũ sang R2 đã bỏ khỏi lịch chạy để tiết kiệm thời gian CPU của Vercel — code vẫn ở lib/storage/migrate.ts.) */
import { cleanupExpiredShares } from "@/lib/mockupShare/cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const r = await cleanupExpiredShares();
  return Response.json(r, { status: r.ok ? 200 : 500 });
}
