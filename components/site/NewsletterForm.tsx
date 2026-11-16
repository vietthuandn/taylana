"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";

export function NewsletterForm() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"" | "sending" | "done" | "error">("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.replace(/\D/g, "").length >= 9;
    if (!ok) { setState("error"); setMsg("Nhập email hoặc số Zalo hợp lệ nhé."); return; }
    if (!hasSupabase) { setState("error"); setMsg("Web chưa kết nối database."); return; }
    setState("sending");
    const { error } = await createClient().from("subscribers").insert({ contact: v });
    if (error) { setState("error"); setMsg(error.code === "42P01" || error.code === "PGRST205" ? "Tính năng đang được bật, bạn quay lại sau nhé." : error.message); return; }
    setState("done");
  }

  if (state === "done") return <p className="rounded-full bg-lime-500 px-5 py-3 font-semibold text-ink-900">✓ Cảm ơn bạn! Tiệm sẽ báo tin mới.</p>;
  return (
    <form onSubmit={submit}>
      <div className="flex rounded-full border-[1.5px] border-ink-900 bg-white p-1 focus-within:border-violet-500">
        <input value={value} onChange={(e) => { setValue(e.target.value); setState(""); }} placeholder="Email hoặc số Zalo"
          aria-label="Email hoặc số Zalo" maxLength={120}
          className="min-w-0 flex-1 rounded-full bg-transparent px-4 text-base text-ink-900 outline-none" />
        <button className="btn btn-sm shrink-0" disabled={state === "sending"}>{state === "sending" ? "..." : "Đăng ký"}</button>
      </div>
      {state === "error" && <p className="mt-2 text-sm text-hot-700">{msg}</p>}
    </form>
  );
}
