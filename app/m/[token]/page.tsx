/* Trang xem link chia sẻ mockup /m/<token>: công khai, chỉ đọc, không cần đăng nhập.
   Server kiểm tra token theo GIỜ SERVER ngay lúc truy cập (RPC get_mockup_share: chỉ trả state khi token đúng + còn hạn,
   đồng thời tăng view_count). Còn hạn → signed URL cho từng ảnh (thời hạn = thời gian còn lại của link, tối đa 24 giờ). */
import { after } from "next/server";
import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import { serviceClient } from "@/lib/supabase/service";
import { getMockupData } from "@/lib/mockup/load";
import { cleanupExpiredShares } from "@/lib/mockupShare/cleanup";
import { SHARE_BUCKET, type ShareState } from "@/lib/mockupShare/types";
import { Logo } from "@/components/site/Header";
import { ShareViewerLoader } from "./ShareViewerLoader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Xem mockup", robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f7f8]">
      <header className="flex h-14 shrink-0 items-center border-b border-[#e5e5e7] bg-white px-4"><Logo /></header>
      {children}
    </div>
  );
}
function Expired({ text = "Link xem mockup này đã hết hạn" }: { text?: string }) {
  return (
    <Shell>
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <p className="text-[20px] font-semibold text-[#18181b]">{text}</p>
          <p className="mt-2 text-[14px] text-[#71717a]">Link chỉ xem được trong 24 giờ. Liên hệ tiệm nếu bạn cần xem lại.</p>
          <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-[8px] bg-[#ff5fa2] px-5 text-[14px] font-medium text-white hover:bg-[#f0468f]">Về trang chủ</Link>
        </div>
      </div>
    </Shell>
  );
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = publicClient();
  if (!sb || !/^[0-9A-Za-z]{16,64}$/.test(token)) return <Expired />;
  const { data } = await sb.rpc("get_mockup_share", { p_token: token });
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; state: ShareState; expires_at: string } | null | undefined;
  const left = row ? new Date(row.expires_at).getTime() - Date.now() : 0;
  if (!row || left <= 0) {
    after(async () => { await cleanupExpiredShares().catch(() => null); }); // dự phòng: dọn link hết hạn (chạy nền)
    return <Expired />;
  }
  const svc = serviceClient();
  if (!svc) return <Expired text="Trang xem mockup chưa được cấu hình xong" />;
  const st = row.state;
  const paths = [...Object.values(st.slots), ...(st.bg.kind === "file" ? [st.bg.path] : [])];
  const ttl = Math.max(60, Math.min(24 * 3600, Math.floor(left / 1000)));
  const signed = paths.length ? await svc.storage.from(SHARE_BUCKET).createSignedUrls(paths, ttl) : { data: [] };
  const urls: Record<string, string> = {};
  for (const s of signed.data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  const mock = await getMockupData();
  return (
    <Shell>
      <ShareViewerLoader state={st} urls={urls} expiresAt={row.expires_at} watermark={mock.watermark} />
    </Shell>
  );
}
