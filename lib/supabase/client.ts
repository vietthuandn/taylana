"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

// Dùng trong component chạy ở trình duyệt ("use client").
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
