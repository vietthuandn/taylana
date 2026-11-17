"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { uploadPublicImage } from "@/lib/upload";
import { btnClass, inputClass } from "@/components/ui/styles";

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
      <div className="rounded-[12px] border border-[#e5e5e7] bg-white px-6 py-10 text-center">
        <p className="text-[20px] font-semibold text-[#18181b]">Cảm ơn bạn!</p>
        <p className="mt-1 text-[#71717a]">Đánh giá sẽ hiện lên sau khi tiệm duyệt.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[12px] border border-[#e5e5e7] bg-white p-5 sm:p-6">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-[#18181b]">Tên của bạn *</span>
        <input className={inputClass} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-[#18181b]">Chấm điểm</span>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`} onClick={() => setRating(n)}
              className={`text-[28px] leading-none transition hover:scale-110 ${n <= rating ? "text-[#ff5fa2]" : "text-[#e5e5e7]"}`}>★</button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-[#18181b]">Cảm nhận</span>
        <textarea className={`${inputClass} h-auto py-2`} rows={4} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-[#18181b]">Ảnh sản phẩm (không bắt buộc, tối đa 8MB)</span>
        <span className="flex items-center gap-3">
          <span className={btnClass("secondary", "sm")}>Chọn ảnh</span>
          <span className="truncate text-[13px] text-[#71717a]">{file ? file.name : "Chưa chọn ảnh"}</span>
        </span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}
      <button type="submit" className={`${btnClass("primary")} w-full`} disabled={state === "sending"}>{state === "sending" ? "Đang gửi..." : "Gửi đánh giá"}</button>
    </form>
  );
}
