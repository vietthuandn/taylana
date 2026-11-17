"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import type { GuideSection } from "@/lib/types";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Field, ImageInput, Message, SortButtons, Toggle, confirmDialog } from "@/components/admin/ui";

type Draft = Omit<GuideSection, "id"> & { id?: string };
const empty: Draft = { title: "", body: "", images: [], links: [], is_active: true, sort_order: 0 };

function moveItem<T>(arr: T[], i: number, dir: -1 | 1) {
  const next = [...arr];
  const [x] = next.splice(i, 1);
  next.splice(i + dir, 0, x);
  return next;
}

export function GuideAdmin() {
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().from("guide_sections").select("*").order("sort_order").order("created_at");
    if (error) setMsg({ type: "err", text: error.message });
    setSections(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function after(text: string) {
    setMsg({ type: "ok", text });
    await revalidatePublic(["/huong-dan"]);
    await load();
  }

  async function save(d: Draft) {
    if (!d.title.trim()) return setMsg({ type: "err", text: "Cần có tiêu đề" });
    const payload = {
      title: d.title.trim(),
      body: d.body,
      images: d.images.filter((i) => i.url || i.caption),
      links: d.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      is_active: d.is_active,
    };
    const sb = createClient();
    const res = d.id
      ? await sb.from("guide_sections").update(payload).eq("id", d.id)
      : await sb.from("guide_sections").insert({ ...payload, sort_order: (sections.at(-1)?.sort_order ?? 0) + 1 });
    if (res.error) return setMsg({ type: "err", text: res.error.message });
    // xoá ảnh đã bỏ khỏi mục
    if (d.id) {
      const before = sections.find((s) => s.id === d.id)?.images.map((i) => i.url) ?? [];
      const now = new Set(payload.images.map((i) => i.url));
      await Promise.all(before.filter((u) => u && !now.has(u)).map(removePublicImage));
    }
    setEditing(null);
    await after("✓ Đã lưu");
  }

  async function remove(s: GuideSection) {
    if (!await confirmDialog(`Xoá mục "${s.title}"?`)) return;
    const { error } = await createClient().from("guide_sections").delete().eq("id", s.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await Promise.all(s.images.map((i) => removePublicImage(i.url)));
    await after("✓ Đã xoá");
  }

  async function move(i: number, dir: -1 | 1) {
    const next = moveItem(sections, i, dir);
    setSections(next);
    const sb = createClient();
    await Promise.all(next.map((s, idx) => (s.sort_order === idx + 1 ? null : sb.from("guide_sections").update({ sort_order: idx + 1 }).eq("id", s.id))));
    await after("✓ Đã đổi thứ tự");
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button className="btn btn-sm" onClick={() => setEditing({ ...empty })}>+ Thêm mục</button>
      </div>
      <div className="mb-3"><Message msg={msg} /></div>
      {editing && !editing.id && <Editor draft={editing} onCancel={() => setEditing(null)} onSave={save} />}

      <ul className="space-y-3">
        {sections.map((s, i) =>
          editing?.id === s.id ? (
            <li key={s.id}><Editor draft={editing} onCancel={() => setEditing(null)} onSave={save} /></li>
          ) : (
            <li key={s.id} className={`flex items-center gap-3 rounded-[12px] border border-[#e5e5e7] bg-white p-3 ${s.is_active ? "" : "opacity-60"}`}>
              <SortButtons first={i === 0} last={i === sections.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#18181b]">{s.title}</p>
                <p className="flex flex-wrap gap-1 text-xs">
                  <Badge>{s.images.length} ảnh</Badge><Badge>{s.links.length} link</Badge>
                  {!s.is_active && <Badge tone="pink">Đang ẩn</Badge>}
                </p>
              </div>
              <button className="rounded-[6px] border border-[#e5e5e7] bg-white px-2.5 py-1 text-[13px] font-medium hover:bg-[#f4f4f5]" onClick={() => setEditing({ ...s })}>Sửa</button>
              <button className="rounded-[6px] border border-[#e5e5e7] bg-white px-2.5 py-1 text-[13px] font-medium text-[#dc2626] hover:bg-[#fef2f2]" onClick={() => remove(s)}>Xoá</button>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

function Editor({ draft, onCancel, onSave }: { draft: Draft; onCancel: () => void; onSave: (d: Draft) => Promise<unknown> }) {
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const setImg = (i: number, v: Partial<Draft["images"][number]>) => setD({ ...d, images: d.images.map((x, j) => (j === i ? { ...x, ...v } : x)) });
  const setLink = (i: number, v: Partial<Draft["links"][number]>) => setD({ ...d, links: d.links.map((x, j) => (j === i ? { ...x, ...v } : x)) });

  return (
    <form className="mb-4 space-y-4 rounded-[12px] border border-[#e5e5e7] bg-white p-5"
      onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSave(d); setSaving(false); }}>
      <Field label="Tiêu đề *"><input className="field" required value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
      <Field label="Nội dung" hint="Xuống dòng sẽ được giữ nguyên. Dán link https://... sẽ tự bấm được.">
        <textarea className="field" rows={8} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium">Ảnh minh hoạ</p>
        <div className="space-y-3">
          {d.images.map((img, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-2xl bg-cream-50 p-3">
              <ImageInput value={img.url || null} onChange={(u) => setImg(i, { url: u ?? "" })} folder="guide" label={`Ảnh ${i + 1}`} />
              <Field label="Chú thích" className="min-w-40 flex-1">
                <input className="field" placeholder="Ví dụ: Bìa trước 12x12cm" value={img.caption} onChange={(e) => setImg(i, { caption: e.target.value })} />
              </Field>
              <SortButtons first={i === 0} last={i === d.images.length - 1}
                onUp={() => setD({ ...d, images: moveItem(d.images, i, -1) })} onDown={() => setD({ ...d, images: moveItem(d.images, i, 1) })} />
              <button type="button" className="rounded-[6px] border border-[#e5e5e7] bg-white px-2.5 py-1 text-[13px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
                onClick={() => setD({ ...d, images: d.images.filter((_, j) => j !== i) })}>Bỏ</button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm underline" onClick={() => setD({ ...d, images: [...d.images, { url: "", caption: "" }] })}>+ Thêm ảnh</button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Link (nút bấm)</p>
        <div className="space-y-2">
          {d.links.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-2xl bg-cream-50 p-3 sm:grid-cols-[1fr_2fr_auto]">
              <input className="field" placeholder="Chữ trên nút, vd: Template Canva" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
              <input className="field" placeholder="https://www.canva.com/..." value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
              <button type="button" className="rounded-[6px] border border-[#e5e5e7] bg-white px-2.5 py-1 text-[13px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
                onClick={() => setD({ ...d, links: d.links.filter((_, j) => j !== i) })}>Bỏ</button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm underline" onClick={() => setD({ ...d, links: [...d.links, { label: "", url: "" }] })}>+ Thêm link</button>
      </div>

      <Toggle checked={d.is_active} onChange={(v) => setD({ ...d, is_active: v })} label="Hiện trên web" />
      <div className="flex gap-2">
        <button className="btn btn-sm" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Huỷ</button>
      </div>
    </form>
  );
}
