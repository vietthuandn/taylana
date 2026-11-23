"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import type { GuideSection } from "@/lib/types";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Button, Field, ImageInput, Message, SortButtons, Toggle, confirmDialog, toast } from "@/components/admin/ui";
import { Copy, ExternalLink, Share2 } from "lucide-react";

type GuideSettings = { show_tools: boolean; tools_title: string; tools: { label: string; href: string }[]; order_enabled: boolean; order_href: string };
const DEF: GuideSettings = {
  show_tools: false, tools_title: "App cũng có xây dựng nhiều tiện ích thiết kế cho CD, khám phá ngay nhé:",
  tools: [{ label: "Thiết kế CD và Booklet", href: "/thiet-ke" }, { label: "Booklet Lyrics", href: "/thiet-ke/booklet-lyrics" }, { label: "Xem Mockup", href: "/thiet-ke/mockup" }],
  order_enabled: false, order_href: "/dat-don",
};

/** cài đặt trang (site_settings "guide"): khối tiện ích thiết kế, nút Đặt đơn · nút Chia sẻ (link /xem/huong-dan — không có thanh điều hướng) */
function PageSettings() {
  const [v, setV] = useState<GuideSettings>(DEF);
  const [saving, setSaving] = useState(false);
  useEffect(() => { createClient().from("site_settings").select("value").eq("key", "guide").maybeSingle().then(({ data }) => { if (data?.value) setV({ ...DEF, ...(data.value as Partial<GuideSettings>) }); }); }, []);
  async function save(n: GuideSettings) {
    setV(n); setSaving(true);
    const { error } = await createClient().from("site_settings").upsert({ key: "guide", value: n, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast(error.message, "err");
    await revalidatePublic(["/huong-dan", "/xem/huong-dan"]);
    toast("Đã lưu cài đặt trang");
  }
  const share = () => `${location.origin}/xem/huong-dan`;
  return (
    <div className="mb-5 space-y-3 rounded-[12px] border border-[#e5e5e7] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[15px] font-semibold">Cài đặt trang</p>
        <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={async () => { try { await navigator.clipboard.writeText(share()); toast("Đã sao chép link chia sẻ"); } catch { toast(share()); } }}>Sao chép link chia sẻ</Button>
        <Button size="sm" icon={<Share2 size={14} />} onClick={() => window.open(share(), "_blank")}>Chia sẻ</Button>
      </div>
      <p className="text-[12px] text-[#71717a]">Link chia sẻ <b>/xem/huong-dan</b> chỉ có 1 trang hướng dẫn, không có thanh điều hướng của web. Link <b>/huong-dan</b> hiện như bình thường.</p>
      <Toggle checked={v.show_tools} onChange={(x) => save({ ...v, show_tools: x })} label="Hiện khối “tiện ích thiết kế” (dưới mục có ảnh)" />
      {v.show_tools && (
        <div className="space-y-2 rounded-[10px] bg-[#fafafa] p-3">
          <input className="field" value={v.tools_title} onChange={(e) => setV({ ...v, tools_title: e.target.value })} onBlur={() => save(v)} />
          {v.tools.map((t, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className="field" value={t.label} placeholder="Chữ trên nút" onChange={(e) => setV({ ...v, tools: v.tools.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} onBlur={() => save(v)} />
              <input className="field" value={t.href} placeholder="/thiet-ke" onChange={(e) => setV({ ...v, tools: v.tools.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} onBlur={() => save(v)} />
              <button type="button" className="text-[13px] text-[#dc2626]" onClick={() => save({ ...v, tools: v.tools.filter((_, j) => j !== i) })}>Bỏ</button>
            </div>
          ))}
          <button type="button" className="text-sm hover:text-[#ff5fa2]" onClick={() => setV({ ...v, tools: [...v.tools, { label: "", href: "/" }] })}>+ Thêm nút</button>
        </div>
      )}
      <p className="text-[12px] text-[#71717a]">Nút “Đặt đơn” cuối trang tự mở / khoá theo công tắc “Tạm nghỉ bán” ở Sản phẩm của tôi. Link nút:</p>
      {<input className="field" value={v.order_href} onChange={(e) => setV({ ...v, order_href: e.target.value })} onBlur={() => save(v)} placeholder="/dat-don" />}
      {saving && <p className="text-[12px] text-[#a1a1aa]">Đang lưu…</p>}
      <a href="/huong-dan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#ff5fa2]">Xem trang /huong-dan <ExternalLink size={12} /></a>
    </div>
  );
}

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
      links: d.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim(), ...(l.icon ? { icon: l.icon } : {}) })),
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
      <PageSettings />
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
              <div className="grid min-w-60 flex-1 gap-2 sm:grid-cols-2">
                <Field label="Tiêu đề thẻ"><input className="field" placeholder="Ví dụ: Bìa trước / Booklet" value={img.caption} onChange={(e) => setImg(i, { caption: e.target.value })} /></Field>
                <Field label="Dòng phụ"><input className="field" placeholder="Ví dụ: 12 × 12 cm" value={img.sub ?? ""} onChange={(e) => setImg(i, { sub: e.target.value })} /></Field>
                <Field label="Link nút (không bắt buộc)"><input className="field" placeholder="https://www.canva.com/..." value={img.link ?? ""} onChange={(e) => setImg(i, { link: e.target.value })} /></Field>
                <Field label="Chữ trên nút"><input className="field" placeholder="Dùng template" value={img.link_label ?? ""} onChange={(e) => setImg(i, { link_label: e.target.value })} /></Field>
              </div>
              <SortButtons first={i === 0} last={i === d.images.length - 1}
                onUp={() => setD({ ...d, images: moveItem(d.images, i, -1) })} onDown={() => setD({ ...d, images: moveItem(d.images, i, 1) })} />
              <button type="button" className="rounded-[6px] border border-[#e5e5e7] bg-white px-2.5 py-1 text-[13px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
                onClick={() => setD({ ...d, images: d.images.filter((_, j) => j !== i) })}>Bỏ</button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm hover:text-[#ff5fa2]" onClick={() => setD({ ...d, images: [...d.images, { url: "", caption: "" }] })}>+ Thêm ảnh</button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Link (nút bấm)</p>
        <div className="space-y-2">
          {d.links.map((l, i) => (
            <div key={i} className="grid items-center gap-2 rounded-2xl bg-cream-50 p-3 sm:grid-cols-[auto_1fr_2fr_auto]">
              <ImageInput value={l.icon || null} onChange={(u) => setLink(i, { icon: u ?? undefined })} folder="guide" label="Icon" allowSvg />
              <input className="field" placeholder="Chữ trên nút, vd: Template Canva" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
              <input className="field" placeholder="https://www.canva.com/..." value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
              <button type="button" className="rounded-[6px] border border-[#e5e5e7] bg-white px-2.5 py-1 text-[13px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
                onClick={() => setD({ ...d, links: d.links.filter((_, j) => j !== i) })}>Bỏ</button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm hover:text-[#ff5fa2]" onClick={() => setD({ ...d, links: [...d.links, { label: "", url: "" }] })}>+ Thêm link</button>
      </div>

      <Toggle checked={d.is_active} onChange={(v) => setD({ ...d, is_active: v })} label="Hiện trên web" />
      <div className="flex gap-2">
        <button className="btn btn-sm" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Huỷ</button>
      </div>
    </form>
  );
}
