import type { NextConfig } from "next";

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
      { source: "/gui-file-in", destination: "/gui-file/cd", permanent: false },
      { source: "/nop-file", destination: "/gui-file/cd", permanent: false },
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
