"use client";

/* Admin → Chất liệu Scrapbook → tab "Lời chúc": chủ đề (thêm, đổi tên, bật/tắt, thứ tự, xoá) và lời chúc theo chủ đề
   (nội dung, ngôn ngữ, bật/tắt, thứ tự). Khách thấy ở Booklet Scrapbook → tab Chữ → "Lời chúc có sẵn".
   "Nạp dữ liệu mẫu": thêm 7 chủ đề × 10 lời chúc mẫu (bỏ qua chủ đề đã có). */
import { promptDialog } from "@/components/ui/dialog";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import type { Wish, WishTopic } from "@/lib/scrapbook/types";
import { Badge, Button, Card, EmptyState, Field, Input, Message, Select, SortButtons, Textarea, Toggle, confirmDialog } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const PATHS = ["/thiet-ke/booklet-scrapbook"];

export function WishAdmin() {
  const [topics, setTopics] = useState<WishTopic[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [cur, setCur] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [form, setForm] = useState({ content: "", lang: "vi" as "vi" | "en" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    const [t, w] = await Promise.all([sb.from("wish_topics").select("*").order("sort_order").order("created_at"), sb.from("wishes").select("*").order("sort_order").order("created_at")]);
    if (t.error) setMsg({ type: "err", text: "Chưa có bảng lời chúc — cần chạy supabase/migration_booklet_scrapbook.sql." });
    const tt = (t.data ?? []) as WishTopic[];
    setTopics(tt); setWishes((w.data ?? []) as Wish[]);
    setCur((c) => (c && tt.some((x) => x.id === c) ? c : tt[0]?.id ?? null));
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PATHS); await load(); };
  const list = wishes.filter((w) => w.topic_id === cur);

  async function seed() {
    setBusy(true);
    const sb = createClient();
    let n = 0;
    for (const t of DEFAULT_TOPICS) {
      if (topics.some((x) => x.name === t.name)) continue;
      const { data, error } = await sb.from("wish_topics").insert({ name: t.name, sort_order: t.sort_order }).select("id").single();
      if (error) { setMsg({ type: "err", text: error.message }); break; }
      const rows = DEFAULT_WISHES.filter((w) => w.topic_id === t.id).map((w) => ({ topic_id: data.id, content: w.content, lang: w.lang, sort_order: w.sort_order }));
      const r = await sb.from("wishes").insert(rows);
      if (r.error) { setMsg({ type: "err", text: r.error.message }); break; }
      n++;
    }
    setBusy(false);
    await after(n ? `Đã nạp ${n} chủ đề mẫu.` : "Các chủ đề mẫu đã có sẵn.");
  }
  async function addTopic() {
    if (!name.trim()) return setMsg({ type: "err", text: "Nhập tên chủ đề." });
    const { error } = await createClient().from("wish_topics").insert({ name: name.trim(), sort_order: (topics.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return setMsg({ type: "err", text: error.message });
    setName(""); await after("Đã thêm chủ đề.");
  }
  async function patch(table: "wish_topics" | "wishes", id: string, v: Record<string, unknown>, text = "Đã lưu.") {
    const { error } = await createClient().from(table).update(v).eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(text);
  }
  async function remove(table: "wish_topics" | "wishes", id: string, label: string) {
    if (!await confirmDialog(label, { danger: true, ok: "Xoá" })) return;
    const { error } = await createClient().from(table).delete().eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after("Đã xoá.");
  }
  async function move(table: "wish_topics" | "wishes", arr: { id: string; sort_order: number }[], i: number, d: number) {
    const j = i + d; if (j < 0 || j >= arr.length) return;
    const sb = createClient();
    await Promise.all([sb.from(table).update({ sort_order: arr[j].sort_order }).eq("id", arr[i].id), sb.from(table).update({ sort_order: arr[i].sort_order }).eq("id", arr[j].id)]);
    await after("Đã đổi thứ tự.");
  }
  async function addWish() {
    if (!cur || !form.content.trim()) return setMsg({ type: "err", text: "Nhập nội dung lời chúc." });
    const { error } = await createClient().from("wishes").insert({ topic_id: cur, content: form.content.trim(), lang: form.lang, sort_order: (list.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return setMsg({ type: "err", text: error.message });
    setForm({ ...form, content: "" }); await after("Đã thêm lời chúc.");
  }

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  const topic = topics.find((t) => t.id === cur);
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card title="Chủ đề" actions={<Button size="sm" variant="secondary" loading={busy} onClick={seed}>Nạp dữ liệu mẫu</Button>}>
        <div className="mb-3 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên chủ đề mới" />
          <Button icon={<Plus size={16} />} onClick={addTopic}>Thêm</Button>
        </div>
        {topics.length ? (
          <ul className="space-y-1">
            {topics.map((t, i) => (
              <li key={t.id} className={cx("flex items-center gap-1 rounded-[8px] border px-2 py-1.5", cur === t.id ? "border-[#ff5fa2] bg-[#fff5f9]" : "border-[#e5e5e7]", !t.is_active && "opacity-60")}>
                <button type="button" onClick={() => setCur(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">{t.name} <span className="font-normal text-[#a1a1aa]">({wishes.filter((w) => w.topic_id === t.id).length})</span></button>
                <SortButtons onUp={() => move("wish_topics", topics, i, -1)} onDown={() => move("wish_topics", topics, i, 1)} first={i === 0} last={i === topics.length - 1} />
              </li>
            ))}
          </ul>
        ) : <EmptyState>Chưa có chủ đề — bấm “Nạp dữ liệu mẫu”.</EmptyState>}
      </Card>

      {topic ? (
        <Card title={`Lời chúc · ${topic.name}`} actions={
          <div className="flex items-center gap-2">
            <Toggle checked={topic.is_active} onChange={(v) => patch("wish_topics", topic.id, { is_active: v }, v ? "Đã bật chủ đề." : "Đã tắt chủ đề.")} label="Hiện với khách" />
            <Button size="sm" variant="secondary" onClick={async () => { const n = await promptDialog({ title: "Đổi tên chủ đề", label: "Tên chủ đề", defaultValue: topic.name, confirmText: "Đổi tên" }); if (n?.trim()) await patch("wish_topics", topic.id, { name: n.trim() }); }}>Đổi tên</Button>
            <Button size="sm" variant="secondary" className="!text-[#dc2626]" icon={<Trash2 size={14} />} onClick={() => remove("wish_topics", topic.id, `Xoá chủ đề "${topic.name}" và toàn bộ lời chúc trong đó?`)}>Xoá</Button>
          </div>}>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end">
            <Field label="Lời chúc mới"><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={2} placeholder="Viết lời chúc ngắn, ấm áp..." /></Field>
            <Field label="Ngôn ngữ"><Select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value as "vi" | "en" })}><option value="vi">Tiếng Việt</option><option value="en">English</option></Select></Field>
            <Button icon={<Plus size={16} />} onClick={addWish}>Thêm</Button>
          </div>
          {list.length ? (
            <ul className="space-y-2">
              {list.map((w, i) => (
                <li key={w.id} className={cx("flex items-start gap-2 rounded-[10px] border border-[#e5e5e7] p-2", !w.is_active && "opacity-60")}>
                  <textarea defaultValue={w.content} rows={2} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== w.content) patch("wishes", w.id, { content: v }); }}
                    className="min-w-0 flex-1 resize-y rounded-[6px] border border-transparent px-2 py-1 text-[13px] outline-none hover:border-[#e5e5e7] focus:border-[#ff5fa2]" />
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <select value={w.lang} onChange={(e) => patch("wishes", w.id, { lang: e.target.value })} className="h-7 rounded-[6px] border border-[#e5e5e7] px-1 text-[12px]"><option value="vi">VI</option><option value="en">EN</option></select>
                      {!w.is_active && <Badge>Tắt</Badge>}
                      <Toggle checked={w.is_active} onChange={(v) => patch("wishes", w.id, { is_active: v }, v ? "Đã bật." : "Đã tắt.")} label="" />
                    </div>
                    <div className="flex items-center gap-1">
                      <SortButtons onUp={() => move("wishes", list, i, -1)} onDown={() => move("wishes", list, i, 1)} first={i === 0} last={i === list.length - 1} />
                      <button type="button" onClick={() => remove("wishes", w.id, "Xoá lời chúc này?")} aria-label="Xoá" className="text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState>Chủ đề này chưa có lời chúc.</EmptyState>}
        </Card>
      ) : <div />}
      <Message msg={msg} />
    </div>
  );
}
