import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Ảnh tải lên Supabase Storage (gói sản phẩm, showcase...)
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
