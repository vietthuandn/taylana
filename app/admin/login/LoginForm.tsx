"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";

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
    <form onSubmit={onSubmit} className="panel w-full max-w-sm px-6 py-8">
      <p className="mb-2 text-center font-display text-5xl text-ink-900">TAYLANA</p>
      <h1 className="text-center text-2xl">Quản trị</h1>
      <p className="mb-6 text-center text-sm text-ink-500">Chỉ dành cho chủ tiệm</p>

      <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required className="field mb-4"
        value={email} onChange={(e) => setEmail(e.target.value)} />

      <label className="mb-1 block text-sm font-medium" htmlFor="password">Mật khẩu</label>
      <input id="password" type="password" autoComplete="current-password" required className="field mb-4"
        value={password} onChange={(e) => setPassword(e.target.value)} />

      {error && <p className="mb-4 rounded-xl bg-hot-100 px-3 py-2 text-sm text-hot-500">{error}</p>}

      <button type="submit" disabled={loading} className="btn w-full">
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
