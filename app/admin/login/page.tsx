import type { Metadata } from "next";
import { hasSupabase, SUPABASE_URL } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Đăng nhập admin", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const { loi } = await searchParams;
  let problem = "";
  if (!hasSupabase || loi === "env") {
    problem = "Web chưa có biến môi trường Supabase ở môi trường này. Trên Vercel: Settings → Environment Variables → bật cả Production và Preview cho NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, rồi Redeploy.";
  } else if (loi?.includes("is_admin")) {
    problem = `Chưa tìm thấy hàm is_admin trong database — hãy chạy file supabase/schema.sql trong SQL Editor. (${loi})`;
  } else if (loi) {
    problem = `Không kết nối được Supabase (${SUPABASE_URL}): ${loi}`;
  }
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        {problem && <p className="pop-sm mb-4 rounded-2xl bg-butter-100 p-3 text-sm break-words">⚠ {problem}</p>}
        <LoginForm />
      </div>
    </main>
  );
}
