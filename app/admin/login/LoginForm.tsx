"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { CdIcon } from "@/components/decor/Icons";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!hasSupabase) {
      setError("Chưa cấu hình Supabase (thiếu biến môi trường).");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError("Sai email hoặc mật khẩu.");
      return;
    }
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Tài khoản này không có quyền quản trị.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="pop stitch w-full max-w-sm rounded-[2rem] bg-cream-50 px-6 py-8">
      <CdIcon className="mx-auto mb-2 h-16 w-16 animate-spin-slow" />
      <h1 className="text-center text-3xl">Quản trị Taylana</h1>
      <p className="mb-6 text-center text-sm text-cocoa-400">Chỉ dành cho chủ tiệm</p>

      <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required className="field mb-4"
        value={email} onChange={(e) => setEmail(e.target.value)} />

      <label className="mb-1 block text-sm font-medium" htmlFor="password">Mật khẩu</label>
      <input id="password" type="password" autoComplete="current-password" required className="field mb-4"
        value={password} onChange={(e) => setPassword(e.target.value)} />

      {error && <p className="mb-4 rounded-xl bg-pink-100 px-3 py-2 text-sm text-pink-500">{error}</p>}

      <button type="submit" disabled={loading} className="btn w-full bg-pink-300">
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
