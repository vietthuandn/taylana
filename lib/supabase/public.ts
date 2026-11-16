import { createClient as create } from "@supabase/supabase-js";
import { hasSupabase, SUPABASE_KEY, SUPABASE_URL } from "./env";

// Client "khách vãng lai" (không đăng nhập) để đọc dữ liệu công khai ở phía server.
export function publicClient() {
  if (!hasSupabase) return null;
  return create(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}
