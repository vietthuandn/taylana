import type { NextConfig } from "next";
import { FEATURE_UPLOAD_FILES } from "./lib/features";

// Cho phép next/image tối ưu ảnh từ Supabase Storage (lấy đúng địa chỉ từ biến môi trường)
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return null;
  }
})();
const isLocal = supabase?.hostname === "localhost" || supabase?.hostname === "127.0.0.1";
const r2 = (() => { try { return new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""); } catch { return null; } })();

const nextConfig: NextConfig = {
  // Đường dẫn cũ → trang mới (giữ nguyên tham số, ví dụ ?don=<mã>, ?ma=<mã>, ?design=<id>)
  async redirects() {
    return [
      { source: "/custom-cd", destination: "/thiet-ke/cd", permanent: false },
      { source: "/thiet-ke/scrapbook", destination: "/thiet-ke/cd-template", permanent: false },
      { source: "/thiet-ke/booklet-scrapbook", destination: "/thiet-ke/booklet", permanent: false },
      // Admin → Thiết kế: trang cũ → Quản lý chất liệu / Quản lý template
      ...([["khung", "khung"], ["font", "font"], ["loi-chuc", "loi-chuc"]] as const).map(([a, b]) => ({ source: "/admin/scrapbook", has: [{ type: "query" as const, key: "tab", value: a }], destination: `/admin/thiet-ke/chat-lieu?tab=${b}`, permanent: false })),
      { source: "/admin/scrapbook", has: [{ type: "query", key: "tab", value: "mau" }], destination: "/admin/thiet-ke/template/cd-template", permanent: false },
      { source: "/admin/scrapbook", destination: "/admin/thiet-ke/chat-lieu?tab=sticker", permanent: false },
      { source: "/admin/scrapbook/mau", destination: "/admin/thiet-ke/template/cd-template", permanent: false },
      { source: "/admin/scrapbook/mau/sua", destination: "/admin/thiet-ke/template/sua", permanent: false },
      { source: "/admin/thiet-ke/template/cd-scrapbook", destination: "/admin/thiet-ke/template/cd-template", permanent: false },
      { source: "/admin/thiet-ke/template/booklet-scrapbook", destination: "/admin/thiet-ke/template/booklet-template", permanent: false },
      { source: "/admin/mau-cd", destination: "/admin/thiet-ke/template/cd-nang-cao", permanent: false },
      { source: "/admin/photostrip", destination: "/admin/thiet-ke/template/photostrip", permanent: false },
      { source: "/admin/booklet-lyrics", destination: "/admin/thiet-ke/template/booklet-lyrics", permanent: false },
      { source: "/admin/template-canva", destination: "/admin/thiet-ke/template/canva", permanent: false },
      { source: "/admin/mockup", destination: "/admin/thiet-ke/template/mockup", permanent: false },
      // Gửi file đang ẩn (lib/features.ts) → mọi đường dẫn Gửi file chuyển sang "Lên mockup"
      ...(FEATURE_UPLOAD_FILES ? [
        { source: "/gui-file-in", destination: "/gui-file/cd", permanent: false },
        { source: "/nop-file", destination: "/gui-file/cd", permanent: false },
      ] : ["/gui-file", "/gui-file/:path*", "/gui-file-in", "/gui-file-in/:path*", "/nop-file"].map((source) => ({ source, destination: "/thiet-ke/mockup", permanent: false }))),
    ];
  },
  images: {
    // ảnh lưu ở Cloudflare R2 (đã có cache CDN 1 năm) → dùng thẳng URL gốc, không qua tối ưu ảnh của Vercel
    unoptimized: true,
    remotePatterns: [
      ...(r2 ? [{ protocol: "https" as const, hostname: r2.hostname }] : []),
      { protocol: "https", hostname: "*.supabase.co" },
      ...(supabase ? [{ protocol: supabase.protocol.replace(":", "") as "http" | "https", hostname: supabase.hostname, port: supabase.port }] : []),
    ],
    // chỉ dùng khi chạy thử Supabase trên máy (localhost)
    dangerouslyAllowLocalIP: isLocal,
  },
};

export default nextConfig;
