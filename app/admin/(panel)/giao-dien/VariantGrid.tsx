"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { HomeVariantMeta } from "@/lib/homeVariants";
import { setActiveHomeVariant } from "@/app/admin/homeVariantActions";
import { Badge, Button, Message, Textarea, confirmDialog } from "@/components/admin/ui";

// Khung xem trước thu nhỏ: iframe 1280×960 thu nhỏ còn 25%, không tương tác
function Thumb({ id }: { id: string }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden border-b border-[#efeff1] bg-[#f7f7f8]">
      <iframe src={`/?preview=${encodeURIComponent(id)}`} title={`Xem trước ${id}`} loading="lazy" tabIndex={-1} aria-hidden
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0" style={{ width: 1280, height: 960, transform: "scale(0.25)" }} />
    </div>
  );
}

export function VariantGrid({ variants, active, notes, notesReady }: { variants: HomeVariantMeta[]; active: string; notes: Record<string, string>; notesReady: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(notesReady ? null : { type: "err", text: "Chưa có bảng ghi chú — cần chạy supabase/migration_home_variants.sql." });
  const [text, setText] = useState(notes);
  const [saved, setSaved] = useState(notes);
  const [busy, setBusy] = useState("");

  async function makeActive(v: HomeVariantMeta) {
    if (!await confirmDialog(`Đặt "${v.name}" làm trang chủ cho mọi khách?`, { title: "Đổi trang chủ", ok: "Đặt làm trang chủ", danger: false })) return;
    setBusy(v.id);
    const r = await setActiveHomeVariant(v.id);
    setBusy("");
    if (r.error) return setMsg({ type: "err", text: r.error });
    setMsg({ type: "ok", text: `Đã đặt "${v.name}" làm trang chủ.` });
    router.refresh();
  }
  async function saveNote(id: string) {
    const note = text[id] ?? "";
    if (note === (saved[id] ?? "")) return;
    const { error } = await createClient().from("home_variant_notes").upsert({ variant_id: id, note, updated_at: new Date().toISOString() });
    if (error) return setMsg({ type: "err", text: error.message });
    setSaved({ ...saved, [id]: note });
    setMsg({ type: "ok", text: "Đã lưu ghi chú." });
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {variants.map((v) => (
          <li key={v.id} className="flex flex-col overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
            <Thumb id={v.id} />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[#18181b]">
                  {v.name} {v.id === active && <Badge tone="green">Đang dùng</Badge>}
                </p>
                <p className="mt-0.5 text-[13px] text-[#71717a]">{v.description}</p>
                <p className="mt-0.5 text-[12px] text-[#a1a1aa]">Tạo ngày {new Date(v.createdAt).toLocaleDateString("vi-VN")} · <span className="font-mono">{v.id}</span></p>
              </div>
              <Textarea rows={2} placeholder="Ghi chú, nhận xét về mẫu này..." value={text[v.id] ?? ""} disabled={!notesReady}
                onChange={(e) => setText({ ...text, [v.id]: e.target.value })} onBlur={() => saveNote(v.id)} />
              <div className="mt-auto flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<ExternalLink size={16} />}
                  onClick={() => window.open(`/?preview=${encodeURIComponent(v.id)}`, "_blank", "noopener")}>Xem trước</Button>
                {v.id !== active && <Button size="sm" loading={busy === v.id} onClick={() => makeActive(v)}>Đặt làm trang chủ</Button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Message msg={msg} />
    </>
  );
}
