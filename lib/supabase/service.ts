import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/* Client quyền service role — CHỈ dùng phía server (dọn link chia sẻ mockup hết hạn, tạo signed URL ảnh riêng tư).
   Key đọc từ biến môi trường SUPABASE_SERVICE_ROLE_KEY (không có tiền tố NEXT_PUBLIC → không bao giờ lộ ra trình duyệt). */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
