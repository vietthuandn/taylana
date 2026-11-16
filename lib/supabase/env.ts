// Biến môi trường (đã khai báo trên Vercel). Key "publishable" an toàn để dùng ở trình duyệt.
// TUYỆT ĐỐI không dùng service_role key trong dự án này.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
