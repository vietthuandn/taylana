"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/format";
import { removePublicImage } from "@/lib/upload";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Field, ImageInput, Message, SortButtons, Toggle } from "./ui";

// Dùng chung cho bảng "packages" (gói sản phẩm) và "addons" (phụ kiện)
type Row = {
  id?: string;
  name: string;
  price: number;
  description: string;
  features?: string[];
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

const empty: Row = { name: "", price: 0, description: "", features: [], image_url: null, is_active: true, sort_order: 0 };

export function CatalogEditor({ table, title, withFeatures }: { table: "packages" | "addons"; title: string; withFeatures?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().from(table).select("*").order("sort_order").order("created_at");
    if (error) setMsg({ type: "err", text: error.message });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [table]);

  useEffect(() => {
    load();
  }, [load]);

  async function after(text: string) {
    setMsg({ type: "ok", text });
    await revalidatePublic(["/dat-don"]);
    await load();
  }

  async function save(row: Row) {
    const sb = createClient();
    const payload: Partial<Row> = {
      name: row.name.trim(),
      price: Math.max(0, Math.round(row.price)),
      description: row.description,
      image_url: row.image_url,
      is_active: row.is_active,
    };
    if (withFeatures) payload.features = (row.features ?? []).map((f) => f.trim()).filter(Boolean);
    if (!payload.name) return setMsg({ type: "err", text: "Tên không được để trống" });

    const res = row.id
      ? await sb.from(table).update(payload).eq("id", row.id)
      : await sb.from(table).insert({ ...payload, sort_order: (rows.at(-1)?.sort_order ?? 0) + 1 });
    if (res.error) return setMsg({ type: "err", text: res.error.message });
    setEditing(null);
    await after("✓ Đã lưu");
  }

  async function remove(row: Row) {
    if (!row.id || !confirm(`Xoá "${row.name}"? Không thể hoàn tác.`)) return;
    const { error } = await createClient().from(table).delete().eq("id", row.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await removePublicImage(row.image_url);
    await after("✓ Đã xoá");
  }

  async function quickToggle(row: Row) {
    const { error } = await createClient().from(table).update({ is_active: !row.is_active }).eq("id", row.id!);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(row.is_active ? "Đã ẩn" : "Đã hiện");
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...rows];
    const [it] = next.splice(index, 1);
    next.splice(index + dir, 0, it);
    setRows(next);
    const sb = createClient();
    await Promise.all(next.map((r, i) => (r.sort_order === i + 1 ? null : sb.from(table).update({ sort_order: i + 1 }).eq("id", r.id!))));
    await after("✓ Đã đổi thứ tự");
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl">{title}</h2>
        <button className="btn btn-sm" onClick={() => setEditing({ ...empty })}>+ Thêm</button>
      </div>
      <div className="mb-3"><Message msg={msg} /></div>

      {editing && !editing.id && <Editor row={editing} withFeatures={withFeatures} folder={table} onCancel={() => setEditing(null)} onSave={save} />}

      {loading ? (
        <p className="text-ink-500">Đang tải...</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-500">Chưa có mục nào.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) =>
            editing && editing.id === r.id ? (
              <li key={r.id}><Editor row={editing} withFeatures={withFeatures} folder={table} onCancel={() => setEditing(null)} onSave={save} /></li>
            ) : (
              <li key={r.id} className={`pop-sm flex items-center gap-3 rounded-2xl bg-cream-50 p-3 ${r.is_active ? "" : "opacity-60"}`}>
                <SortButtons first={i === 0} last={i === rows.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-cream-200" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg">{r.name}</p>
                  <p className="text-sm">
                    <b className="text-hot-500">{formatVND(r.price)}</b>{" "}
                    {!r.is_active && <Badge>Đang ẩn</Badge>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button className="rounded-full bg-lime-300 px-3 py-1 text-sm" onClick={() => setEditing({ ...r })}>Sửa</button>
                  <button className="rounded-full bg-cream-200 px-3 py-1 text-sm" onClick={() => quickToggle(r)}>{r.is_active ? "Ẩn" : "Hiện"}</button>
                  <button className="rounded-full bg-hot-100 px-3 py-1 text-sm text-hot-500" onClick={() => remove(r)}>Xoá</button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function Editor({ row, withFeatures, folder, onCancel, onSave }: { row: Row; withFeatures?: boolean; folder: string; onCancel: () => void; onSave: (r: Row) => void }) {
  const [r, setR] = useState(row);
  const [featuresText, setFeaturesText] = useState((row.features ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="pop mb-3 grid gap-4 rounded-3xl bg-violet-100 p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ ...r, features: featuresText.split("\n") });
        setSaving(false);
      }}
    >
      <Field label="Tên *"><input className="field" required value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
      <Field label="Giá (đồng)" hint={formatVND(r.price || 0)}>
        <input className="field" type="number" min={0} step={1000} inputMode="numeric" value={r.price}
          onChange={(e) => setR({ ...r, price: Number(e.target.value) })} />
      </Field>
      <Field label="Mô tả" className="sm:col-span-2">
        <textarea className="field" rows={2} value={r.description} onChange={(e) => setR({ ...r, description: e.target.value })} />
      </Field>
      {withFeatures && (
        <Field label="Trong gói có gì" hint="Mỗi dòng là một ý" className="sm:col-span-2">
          <textarea className="field" rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} />
        </Field>
      )}
      <ImageInput value={r.image_url} onChange={(url) => setR({ ...r, image_url: url })} folder={folder} label="Ảnh mẫu" />
      <div className="flex items-center"><Toggle checked={r.is_active} onChange={(v) => setR({ ...r, is_active: v })} label="Hiện trên web" /></div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-sm" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Huỷ</button>
      </div>
    </form>
  );
}
