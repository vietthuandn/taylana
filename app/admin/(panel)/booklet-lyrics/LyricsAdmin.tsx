"use client";

/* Admin → Booklet Lyrics: lưu vào site_settings (key "lyrics_booklet"). */
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { BACKS, BODY_FONTS, LAYOUTS, TITLE_FONTS, mergeSettings, type LyricsSettings } from "@/lib/lyricsBooklet/types";
import { Button, Card, ColorInput, Field, Input, Message, Select, Toggle } from "@/components/admin/ui";

type Msg = { type: "ok" | "err"; text: string } | null;

export function LyricsAdmin() {
  const [s, setS] = useState<LyricsSettings | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    createClient().from("site_settings").select("value").eq("key", "lyrics_booklet").maybeSingle()
      .then(({ data }) => setS(mergeSettings((data?.value as Partial<LyricsSettings>) ?? null)));
  }, []);
  if (!s) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  const num = (v: string, min: number, max: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

  async function save() {
    setSaving(true);
    const { error } = await createClient().from("site_settings").upsert({ key: "lyrics_booklet", value: s, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setMsg({ type: "err", text: error.message });
    setMsg({ type: "ok", text: "Đã lưu cài đặt." });
    await revalidatePublic(["/thiet-ke/booklet-lyrics"]);
  }
  return (
    <div className="space-y-6">
      <Card title="Giới hạn lyrics">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bài dài (chiếm nguyên trang) khi quá" hint="LONG_SONG_LINES — số dòng"><Input type="number" value={s.longLines} onChange={(e) => setS({ ...s, longLines: num(e.target.value, 10, 200, 45) })} /></Field>
          <Field label="Tối đa số dòng 1 bài" hint="MAX_SONG_LINES"><Input type="number" value={s.maxLines} onChange={(e) => setS({ ...s, maxLines: num(e.target.value, 10, 300, 90) })} /></Field>
          <Field label="Cỡ chữ lời tối thiểu (pt)" hint="Tự co từ 7.5pt xuống tới cỡ này"><Input type="number" step="0.25" value={s.minFontPt} onChange={(e) => setS({ ...s, minFontPt: num(e.target.value, 5, 7.5, 6.5) })} /></Field>
        </div>
      </Card>
      <Card title="Font chữ">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Font tiêu đề"><Select value={s.titleFont} onChange={(e) => setS({ ...s, titleFont: e.target.value })}>{TITLE_FONTS.map((f) => <option key={f}>{f}</option>)}</Select></Field>
          <Field label="Font lời"><Select value={s.bodyFont} onChange={(e) => setS({ ...s, bodyFont: e.target.value })}>{BODY_FONTS.map((f) => <option key={f}>{f}</option>)}</Select></Field>
        </div>
      </Card>
      <Card title="Bảng màu" description="Khách chọn 1 trong các bảng màu này, hoặc “Tự động” theo ảnh bìa.">
        <ul className="space-y-2">
          {s.palettes.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#e5e5e7] p-2">
              <Input value={p.name} onChange={(e) => setS({ ...s, palettes: s.palettes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="w-40" />
              {(["bg", "ink", "accent"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1 text-[12px] text-[#71717a]">{k === "bg" ? "Nền" : k === "ink" ? "Chữ" : "Nhấn"}
                  <ColorInput value={p[k]} onChange={(v) => setS({ ...s, palettes: s.palettes.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })} />
                </span>
              ))}
              <button type="button" onClick={() => setS({ ...s, palettes: s.palettes.filter((_, j) => j !== i) })} disabled={s.palettes.length <= 1} aria-label="Xoá"
                className="ml-auto grid h-8 w-8 place-items-center rounded-[6px] text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-40"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-3" icon={<Plus size={14} />}
          onClick={() => setS({ ...s, palettes: [...s.palettes, { id: Math.random().toString(36).slice(2, 8), name: "Bảng màu mới", bg: "#ffffff", ink: "#1f1f23", accent: "#ff5fa2" }] })}>Thêm bảng màu</Button>
      </Card>
      <Card title="Mẫu dàn trang">
        <div className="grid gap-2 sm:grid-cols-3">{LAYOUTS.map((l) => <Toggle key={l.id} checked={s.layouts[l.id]} onChange={(v) => setS({ ...s, layouts: { ...s.layouts, [l.id]: v } })} label={l.name} />)}</div>
      </Card>
      <Card title="Mẫu bìa sau">
        <div className="grid gap-2 sm:grid-cols-2">{BACKS.map((b) => <Toggle key={b.id} checked={s.backs[b.id]} onChange={(v) => setS({ ...s, backs: { ...s.backs, [b.id]: v } })} label={b.name} />)}</div>
      </Card>
      <div className="flex items-center gap-3"><Button onClick={save} loading={saving}>Lưu cài đặt</Button><Message msg={msg} /></div>
    </div>
  );
}
