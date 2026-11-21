/* Gọi bởi pg_cron + pg_net của Supabase — CHỈ khi có việc (lịch kiểm tra trong SQL, không gọi Vercel vô ích):
   1) link chia sẻ mockup hết hạn · 2) thiết kế của khách quá 24 giờ kể từ lần sửa gần nhất.
   Chỉ chạy khi header Authorization: Bearer <CRON_SECRET> đúng. Xoá file trên kho lưu trữ rồi xoá dòng. */
import { cleanupExpiredShares } from "@/lib/mockupShare/cleanup";
import { cleanupExpiredDesigns } from "@/lib/designCleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const [r, d] = await Promise.all([cleanupExpiredShares(), cleanupExpiredDesigns().catch(() => ({ designs: 0, files: 0 }))]);
  return Response.json({ ...r, expiredDesigns: d }, { status: r.ok ? 200 : 500 });
}
