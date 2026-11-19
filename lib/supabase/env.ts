// Biến môi trường (đã khai báo trên Vercel). Key "publishable" an toàn để dùng ở trình duyệt.
// service_role key KHÔNG BAO GIỜ dùng ở trình duyệt; chỉ dùng phía server qua lib/supabase/service.ts (biến SUPABASE_SERVICE_ROLE_KEY).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
