"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { uploadPublicImage } from "@/lib/upload";

export function ReviewForm() {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"" | "sending" | "done">("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!hasSupabase) return setError("Web chưa kết nối database.");
    setState("sending");
    try {
      let image_url: string | null = null;
      if (file) image_url = await uploadPublicImage(file, "reviews", 8);
      const { error } = await createClient()
        .from("reviews")
        .insert({ customer_name: name.trim(), rating, content: content.trim(), image_url, is_approved: false });
      if (error) throw new Error(error.message);
      setState("done");
    } catch (err) {
      setState("");
      setError(err instanceof Error ? err.message : "Gửi thất bại");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-[24px] bg-violet-500 px-6 py-10 text-center text-white">
        <p className="font-display text-4xl uppercase">Cảm ơn bạn!</p>
        <p className="mt-1 text-white/85">Đánh giá sẽ hiện lên sau khi tiệm duyệt.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="panel space-y-4 p-5 sm:p-7">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-900">Tên của bạn *</span>
        <input className="field" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink-900">Chấm điểm</span>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`} onClick={() => setRating(n)}
              className={`text-4xl transition hover:scale-110 ${n <= rating ? "text-hot-500" : "text-ink-100"}`}>★</button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-900">Cảm nhận</span>
        <textarea className="field" rows={4} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-900">Ảnh sản phẩm (không bắt buộc, tối đa 8MB)</span>
        <span className="flex items-center gap-3">
          <span className="chip">Chọn ảnh</span>
          <span className="truncate text-sm text-ink-500">{file ? file.name : "Chưa chọn ảnh"}</span>
        </span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="rounded-full bg-hot-100 px-4 py-2 text-sm font-semibold text-hot-700">{error}</p>}
      <button type="submit" className="btn w-full" disabled={state === "sending"}>{state === "sending" ? "Đang gửi..." : "Gửi đánh giá"}</button>
    </form>
  );
}
