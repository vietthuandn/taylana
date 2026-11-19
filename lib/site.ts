// Địa chỉ web của tiệm (không có dấu / ở cuối). Đặt NEXT_PUBLIC_SITE_URL trên Vercel; chưa đặt → dùng tên miền mặc định.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://taylana-print.vercel.app").replace(/\/+$/, "");
