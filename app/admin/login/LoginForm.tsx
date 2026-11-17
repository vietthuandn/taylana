"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { Button, Field, Input } from "@/components/admin/ui";

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
    <form onSubmit={onSubmit} className="w-full max-w-sm rounded-[12px] border border-[#e5e5e7] bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-[#ff5fa2] text-[13px] font-bold text-white">T</span>
        <span className="text-[16px] font-semibold text-[#18181b]">Taylana</span>
        <span className="rounded-[4px] border border-[#e5e5e7] px-1.5 text-[11px] font-medium text-[#71717a]">Admin</span>
      </div>
      <h1>Đăng nhập</h1>
      <p className="mb-5 mt-1 text-[13px] text-[#71717a]">Chỉ dành cho chủ tiệm.</p>

      <Field label="Email" className="mb-4">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Mật khẩu" className="mb-4">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>

      {error && <p className="mb-4 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
