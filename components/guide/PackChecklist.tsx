"use client";
/* Hướng dẫn → "Cần chuẩn bị bao nhiêu file?": chọn gói CD → danh sách ảnh + nhạc cần chuẩn bị (con số in đậm). */
import { useState } from "react";

export type GuidePack = { id: string; name: string; front: number; back: number; disc: boolean };
export function PackChecklist({ packs }: { packs: GuidePack[] }) {
  const [id, setId] = useState("");
  const p = packs.find((x) => x.id === id);
  const rows = p ? [
    ...(p.front ? [{ k: p.front >= 4 ? "Bìa trước / Booklet" : "Bìa trước", n: p.front, spec: "12 × 12 cm - png / jpg" }] : []),
    ...(p.back ? [{ k: "Bìa sau", n: p.back, spec: "15 × 11.7 cm - png / jpg" }] : []),
    ...(p.disc ? [{ k: "CD", n: 1, spec: "12 × 12 cm - png / jpg" }] : []),
  ] : [];
  const total = rows.reduce((t, r) => t + r.n, 0);
  return (
    <section className="rounded-[14px] border border-[#e5e5e7] bg-white p-5 sm:p-6">
      <h2 className="text-[18px] font-semibold">Gói của bạn cần chuẩn bị bao nhiêu file?</h2>
      <select value={id} onChange={(e) => setId(e.target.value)} className="mt-3 h-11 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 text-[15px] outline-none focus:border-[#ff5fa2] sm:max-w-[420px]">
        <option value="">— Chọn gói CD —</option>
        {packs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {p && (
        <ul className="mt-4 space-y-1.5 text-[15px] leading-relaxed text-[#3f3f46]">
          {rows.map((r) => <li key={r.k}>• {r.k}: <b className="text-[17px] text-[#18181b]">{r.n}</b> ảnh <span className="text-[#71717a]">({r.spec})</span></li>)}
          {p.disc && <li>• Nhạc: file không quá <b className="text-[17px] text-[#18181b]">79</b> phút <span className="text-[#71717a]">(mp3, wav)</span></li>}
          <li className="pt-1 font-semibold text-[#18181b]">• Tổng cộng <b className="text-[18px] text-[#ff5fa2]">{total}</b> file ảnh{p.disc ? " và nhạc" : ""}</li>
        </ul>
      )}
    </section>
  );
}
