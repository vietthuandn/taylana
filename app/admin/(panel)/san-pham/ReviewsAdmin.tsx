"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Field, ImageInput, Message } from "@/components/admin/ui";
import { Stars } from "@/components/site/Stars";

type Draft = { id?: string; customer_name: string; rating: number; content: string; image_url: string | null; is_approved: boolean; created_at?: string };

export function ReviewsAdmin() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("reviews").select("*").order("created_at", { ascending: false }).limit(300);
    setReviews(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function after(text: string) {
    setMsg({ type: "ok", text });
    await revalidatePublic(["/san-pham"]);
    await load();
  }

  async function setApproved(r: Review, v: boolean) {
    const { error } = await createClient().from("reviews").update({ is_approved: v }).eq("id", r.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(v ? "✓ Đã duyệt — đánh giá đang hiện trên web" : "Đã ẩn đánh giá");
  }

  async function save(d: Draft) {
    const sb = createClient();
    const payload = { customer_name: d.customer_name.trim(), rating: d.rating, content: d.content.trim(), image_url: d.image_url, is_approved: d.is_approved };
    const res = d.id ? await sb.from("reviews").update(payload).eq("id", d.id) : await sb.from("reviews").insert(payload);
    if (res.error) return setMsg({ type: "err", text: res.error.message });
    setEditing(null);
    await after("✓ Đã lưu");
  }

  async function remove(r: Review) {
    if (!confirm(`Xoá đánh giá của ${r.customer_name}?`)) return;
    const { error } = await createClient().from("reviews").delete().eq("id", r.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await removePublicImage(r.image_url);
    await after("✓ Đã xoá");
  }

  const pendingCount = reviews.filter((r) => !r.is_approved).length;
  const shown = reviews.filter((r) => (filter === "all" ? true : filter === "approved" ? r.is_approved : !r.is_approved));

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Đánh giá</h2>
        <button className="btn bg-pink-200 !min-h-10 !text-base"
          onClick={() => setEditing({ customer_name: "", rating: 5, content: "", image_url: null, is_approved: true })}>
          + Tự thêm đánh giá
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {([["pending", `Chờ duyệt (${pendingCount})`], ["approved", "Đã duyệt"], ["all", "Tất cả"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`pop-sm rounded-full px-4 py-1.5 text-sm ${filter === k ? "bg-pink-300" : "bg-cream-50"}`}>{l}</button>
        ))}
      </div>
      <div className="mb-3"><Message msg={msg} /></div>

      {editing && (
        <form className="pop mb-4 grid gap-4 rounded-3xl bg-butter-100 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(editing); }}>
          <Field label="Tên khách *"><input className="field" required maxLength={80} value={editing.customer_name} onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })} /></Field>
          <Field label="Số sao">
            <select className="field" value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
            </select>
          </Field>
          <Field label="Nội dung" className="sm:col-span-2">
            <textarea className="field" rows={3} maxLength={2000} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
          </Field>
          <ImageInput value={editing.image_url} onChange={(u) => setEditing({ ...editing, image_url: u })} folder="reviews" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={editing.is_approved} onChange={(e) => setEditing({ ...editing, is_approved: e.target.checked })} />
            Hiện trên web
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn bg-pink-300 !min-h-10 !text-base">Lưu</button>
            <button type="button" className="btn bg-cream-50 !min-h-10 !text-base" onClick={() => setEditing(null)}>Huỷ</button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="pop-sm flex gap-3 rounded-2xl bg-cream-50 p-3">
            {r.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={r.image_url} target="_blank" rel="noreferrer"><img src={r.image_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /></a>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <b>{r.customer_name}</b> <Stars value={r.rating} />
                {r.is_approved ? <Badge tone="matcha">Đang hiện</Badge> : <Badge tone="pink">Chờ duyệt</Badge>}
              </p>
              <p className="whitespace-pre-line text-sm">{r.content}</p>
              <p className="text-xs text-cocoa-400">{formatDate(r.created_at)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.is_approved ? (
                  <button className="rounded-full bg-cream-200 px-3 py-1 text-xs" onClick={() => setApproved(r, false)}>Ẩn</button>
                ) : (
                  <button className="rounded-full bg-matcha-300 px-3 py-1 text-xs font-bold" onClick={() => setApproved(r, true)}>✓ Duyệt</button>
                )}
                <button className="rounded-full bg-matcha-100 px-3 py-1 text-xs" onClick={() => setEditing({ ...r })}>Sửa</button>
                <button className="rounded-full bg-pink-100 px-3 py-1 text-xs text-pink-500" onClick={() => remove(r)}>Xoá</button>
              </div>
            </div>
          </li>
        ))}
        {!shown.length && <li className="text-cocoa-400">Không có đánh giá nào.</li>}
      </ul>
    </section>
  );
}
