"use client";
/* Hướng dẫn → đầu trang: "Kiểm tra trước — gói của bạn cần bao nhiêu file?" Chọn gói CD → các ô Bìa trước / Bìa sau / CD / Nhạc
   với con số to + tổng số file. Khung nền gradient để khác biệt với các mục hướng dẫn bên dưới. */
import { useState } from "react";
import { ClipboardCheck, Disc3, Image as ImageIcon, Music, PanelsTopLeft } from "lucide-react";

export type GuidePack = { id: string; name: string; front: number; back: number; disc: boolean };
export function PackChecklist({ packs }: { packs: GuidePack[] }) {
  const [id, setId] = useState("");
  const p = packs.find((x) => x.id === id);
  const rows = p ? [
    ...(p.front ? [{ k: p.front >= 4 ? "Bìa trước / Booklet" : "Bìa trước", n: String(p.front), unit: "ảnh", spec: "12 × 12 cm · png / jpg", icon: <ImageIcon size={18} /> }] : []),
    ...(p.back ? [{ k: "Bìa sau", n: String(p.back), unit: "ảnh", spec: "15 × 11.7 cm · png / jpg", icon: <PanelsTopLeft size={18} /> }] : []),
    ...(p.disc ? [{ k: "CD", n: "1", unit: "ảnh", spec: "12 × 12 cm · png / jpg", icon: <Disc3 size={18} /> }] : []),
    ...(p.disc ? [{ k: "Nhạc", n: "≤ 79", unit: "phút", spec: "mp3, wav", icon: <Music size={18} /> }] : []),
  ] : [];
  const total = p ? p.front + p.back + (p.disc ? 1 : 0) : 0;
  return (
    <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#ff5fa2] via-[#e05bd8] to-[#7c5cff] p-[1.5px] shadow-[0_10px_30px_rgba(124,92,255,0.18)]">
      <div className="rounded-[17px] bg-white/95 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-[#ff5fa2] to-[#7c5cff] text-white"><ClipboardCheck size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ff5fa2]">Kiểm tra trước</p>
            <h2 className="text-[18px] font-bold leading-snug text-[#18181b]">Gói của bạn cần chuẩn bị bao nhiêu file?</h2>
          </div>
        </div>
        <select value={id} onChange={(e) => setId(e.target.value)} className="mt-4 h-12 w-full rounded-[12px] border-[1.5px] border-[#ead7ff] bg-[#fbf8ff] px-3 text-[15px] font-medium outline-none focus:border-[#7c5cff]">
          <option value="">— Chọn gói CD của bạn —</option>
          {packs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {p ? (
          <>
            <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {rows.map((r) => (
                <li key={r.k} className="rounded-[14px] border border-[#f0e6ff] bg-gradient-to-b from-white to-[#fbf7ff] p-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#52525b]"><span className="text-[#a35cff]">{r.icon}</span>{r.k}</p>
                  <p className="mt-1.5 text-[#18181b]"><b className="text-[30px] font-extrabold leading-none tracking-tight">{r.n}</b> <span className="text-[13px] text-[#71717a]">{r.unit}</span></p>
                  <p className="mt-1 text-[12px] text-[#a1a1aa]">{r.spec}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#18181b] px-4 py-2 text-[14px] text-white">
              Tổng cộng <b className="text-[18px] text-[#ffb3d6]">{total}</b> file ảnh{p.disc ? " + nhạc" : ""}
            </p>
          </>
        ) : <p className="mt-3 text-[13px] text-[#71717a]">Chọn gói để xem cần chuẩn bị mấy ảnh bìa, booklet, mặt đĩa và nhạc trước khi bắt đầu làm file.</p>}
      </div>
    </section>
  );
}
