"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage, uploadPublicImage } from "@/lib/upload";
import type { ShowcaseItem } from "@/lib/types";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Field, ImageInput, Message, SortButtons, Toggle, confirmDialog } from "@/components/admin/ui";

type Draft = Omit<ShowcaseItem, "id" | "image_url"> & { id?: string; image_url: string | null };
const empty: Draft = { title: "", category: "CD", image_url: null, description: "", is_active: true, sort_order: 0 };

export function ShowcaseAdmin() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [bulk, setBulk] = useState("");

  const load = useCallback(async () => {
    const { data } = await createClient().from("showcase_items").select("*").order("sort_order").order("created_at", { ascending: false });
    setItems(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  async function after(text: string) {
    setMsg({ type: "ok", text });
    await revalidatePublic(["/san-pham"]);
    await load();
  }

  async function save(d: Draft) {
    if (!d.image_url) return setMsg({ type: "err", text: "Cần có ảnh" });
    const sb = createClient();
    const payload = { title: d.title.trim(), category: d.category.trim() || "CD", image_url: d.image_url, description: d.description, is_active: d.is_active };
    const res = d.id
      ? await sb.from("showcase_items").update(payload).eq("id", d.id)
      : await sb.from("showcase_items").insert({ ...payload, sort_order: 0 });
    if (res.error) return setMsg({ type: "err", text: res.error.message });
    setEditing(null);
    await after("✓ Đã lưu");
  }

  // Tải nhiều ảnh cùng lúc → mỗi ảnh thành 1 sản phẩm
  async function bulkUpload(files: FileList) {
    const sb = createClient();
    let done = 0;
    for (const f of Array.from(files)) {
      setBulk(`Đang tải ${done + 1}/${files.length}...`);
      try {
        const url = await uploadPublicImage(f, "showcase");
        await sb.from("showcase_items").insert({ image_url: url, title: "", category: categories[0] ?? "CD" });
        done++;
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Lỗi" });
      }
    }
    setBulk("");
    await after(`✓ Đã thêm ${done} ảnh`);
  }

  async function remove(it: ShowcaseItem) {
    if (!await confirmDialog("Xoá sản phẩm này?")) return;
    const { error } = await createClient().from("showcase_items").delete().eq("id", it.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await removePublicImage(it.image_url);
    await after("✓ Đã xoá");
  }

  async function move(i: number, dir: -1 | 1) {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x);
    setItems(next);
    const sb = createClient();
    await Promise.all(next.map((r, idx) => (r.sort_order === idx + 1 ? null : sb.from("showcase_items").update({ sort_order: idx + 1 }).eq("id", r.id))));
    await after("✓ Đã đổi thứ tự");
  }

  return (
    <section className="mb-12">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px]">Ảnh sản phẩm (showcase)</h2>
        <div className="flex gap-2">
          <label className="btn cursor-pointer btn-sm">
            {bulk || "Tải nhiều ảnh"}
            <input type="file" multiple accept="image/*" className="sr-only" disabled={!!bulk}
              onChange={(e) => { if (e.target.files?.length) bulkUpload(e.target.files); e.target.value = ""; }} />
          </label>
          <button className="btn btn-sm" onClick={() => setEditing({ ...empty, category: categories[0] ?? "CD" })}>+ Thêm</button>
        </div>
      </div>
      <div className="mb-3"><Message msg={msg} /></div>
      <datalist id="showcase-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>

      {editing && (
        <form className="mb-4 grid gap-4 rounded-[12px] border border-[#e5e5e7] bg-white p-5 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); save(editing); }}>
          <ImageInput value={editing.image_url} onChange={(u) => setEditing({ ...editing, image_url: u })} folder="showcase" label="Ảnh *" />
          <div className="flex items-center"><Toggle checked={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} label="Hiện trên web" /></div>
          <Field label="Tên sản phẩm"><input className="field" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
          <Field label="Loại (dùng để lọc)" hint="Ví dụ: CD, Combo, Booklet, Photostrip">
            <input className="field" list="showcase-cats" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
          </Field>
          <Field label="Mô tả" className="sm:col-span-2">
            <textarea className="field" rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn btn-sm">Lưu</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Huỷ</button>
          </div>
        </form>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it, i) => (
          <li key={it.id} className={`overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white ${it.is_active ? "" : "opacity-60"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.image_url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
            <div className="space-y-1 p-2">
              <p className="truncate text-sm font-bold">{it.title || "(chưa đặt tên)"}</p>
              <p className="flex gap-1"><Badge tone="matcha">{it.category}</Badge>{!it.is_active && <Badge>Ẩn</Badge>}</p>
              <div className="flex items-center justify-between">
                <SortButtons first={i === 0} last={i === items.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
                <span className="flex gap-1">
                  <button className="rounded-full bg-lime-300 px-2 py-0.5 text-xs" onClick={() => setEditing({ ...it })}>Sửa</button>
                  <button className="rounded-full bg-hot-100 px-2 py-0.5 text-xs text-hot-500" onClick={() => remove(it)}>Xoá</button>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!items.length && <p className="text-ink-500">Chưa có ảnh sản phẩm nào.</p>}
    </section>
  );
}
