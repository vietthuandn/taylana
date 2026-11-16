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
      <div className="pop rounded-[2rem] bg-matcha-100 px-6 py-8 text-center">
        <p className="font-display text-2xl">Cảm ơn bạn nhiều lắm! ♡</p>
        <p className="mt-1 text-cocoa-500">Đánh giá sẽ hiện lên sau khi tiệm duyệt nhé.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="pop stitch space-y-4 rounded-[2rem] bg-cream-50 p-5 sm:p-7">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Tên của bạn *</span>
        <input className="field" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div>
        <span className="mb-1 block text-sm font-medium">Chấm điểm</span>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`}
              onClick={() => setRating(n)}
              className={`text-4xl transition hover:scale-110 ${n <= rating ? "text-pink-400" : "text-cocoa-300"}`}>
              ★
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Cảm nhận</span>
        <textarea className="field" rows={4} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Ảnh sản phẩm (không bắt buộc, tối đa 8MB)</span>
        <span className="flex items-center gap-3">
          <span className="btn bg-pink-100 !min-h-10 !text-base">Chọn ảnh</span>
          <span className="truncate text-sm text-cocoa-500">{file ? file.name : "Chưa chọn ảnh"}</span>
        </span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="rounded-xl bg-pink-100 px-3 py-2 text-sm text-pink-500">{error}</p>}
      <button type="submit" className="btn w-full bg-pink-300" disabled={state === "sending"}>
        {state === "sending" ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </form>
  );
}
