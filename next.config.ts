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

const nextConfig: NextConfig = {
  // Đường dẫn cũ → trang mới (giữ nguyên tham số, ví dụ ?don=<mã>, ?ma=<mã>, ?design=<id>)
  async redirects() {
    return [
      { source: "/custom-cd", destination: "/thiet-ke/cd", permanent: false },
      // Gửi file đang ẩn (lib/features.ts) → mọi đường dẫn Gửi file chuyển sang "Lên mockup"
      ...(FEATURE_UPLOAD_FILES ? [
        { source: "/gui-file-in", destination: "/gui-file/cd", permanent: false },
        { source: "/nop-file", destination: "/gui-file/cd", permanent: false },
      ] : ["/gui-file", "/gui-file/:path*", "/gui-file-in", "/gui-file-in/:path*", "/nop-file"].map((source) => ({ source, destination: "/thiet-ke/mockup", permanent: false }))),
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      ...(supabase ? [{ protocol: supabase.protocol.replace(":", "") as "http" | "https", hostname: supabase.hostname, port: supabase.port }] : []),
    ],
    // chỉ dùng khi chạy thử Supabase trên máy (localhost)
    dangerouslyAllowLocalIP: isLocal,
  },
};

export default nextConfig;
