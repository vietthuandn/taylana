"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/format";
import { removePublicImage } from "@/lib/upload";
import { revalidatePublic } from "@/app/admin/actions";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, ImageInput, Message, SortButtons, Table, Toggle, confirmDialog } from "./ui";

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
  // preset thiết kế (chỉ gói sản phẩm): trang Custom CD hiện tab/số trang theo gói
  has_disc?: boolean;
  front_pages?: number;
  back_pages?: number;
};

// Mô tả ngắn preset của gói
export const presetText = (r: { has_disc?: boolean; front_pages?: number; back_pages?: number }) =>
  [r.front_pages ? (r.front_pages >= 4 ? `Booklet ${r.front_pages} trang` : `Bìa trước ${r.front_pages} trang`) : "", r.back_pages ? `Bìa sau ${r.back_pages} trang` : "", r.has_disc !== false ? "Mặt đĩa" : ""].filter(Boolean).join(" · ");

const empty: Row = { name: "", price: 0, description: "", features: [], image_url: null, is_active: true, sort_order: 0, has_disc: true, front_pages: 0, back_pages: 0 };

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
    if (table === "packages") Object.assign(payload, { has_disc: row.has_disc !== false, front_pages: row.front_pages ?? 0, back_pages: row.back_pages ?? 0 });
    if (!payload.name) return setMsg({ type: "err", text: "Tên không được để trống" });

    const res = row.id
      ? await sb.from(table).update(payload).eq("id", row.id)
      : await sb.from(table).insert({ ...payload, sort_order: (rows.at(-1)?.sort_order ?? 0) + 1 });
    if (res.error) return setMsg({ type: "err", text: res.error.message });
    setEditing(null);
    await after("✓ Đã lưu");
  }

  async function remove(row: Row) {
    if (!row.id || !await confirmDialog(`Xoá "${row.name}"? Không thể hoàn tác.`)) return;
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
    <Card title={title} description={`${rows.length} mục`} padded={false}
      actions={<Button size="sm" icon={<Plus size={16} />} onClick={() => setEditing({ ...empty })}>Thêm mới</Button>}>
      <Message msg={msg} />
      {editing && !editing.id && <div className="border-b border-[#efeff1] p-5"><Editor row={editing} withFeatures={withFeatures} folder={table} onCancel={() => setEditing(null)} onSave={save} /></div>}

      {loading ? (
        <EmptyState>Đang tải...</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>Chưa có mục nào.</EmptyState>
      ) : (
        <div className="[&>div]:rounded-none [&>div]:border-0">
          <Table head={["", "Tên", table === "packages" ? "Cấu hình" : "Mô tả", "Giá", "Trạng thái", ""]}>
            {rows.map((r, i) =>
              editing && editing.id === r.id ? (
                <tr key={r.id} className="!h-auto hover:!bg-transparent">
                  <td colSpan={6} className="!p-5"><Editor row={editing} withFeatures={withFeatures} folder={table} onCancel={() => setEditing(null)} onSave={save} /></td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td className="w-[76px] !pr-0"><SortButtons first={i === 0} last={i === rows.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} /></td>
                  <td>
                    <div className="flex items-center gap-3">
                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image_url} alt="" className="h-9 w-9 shrink-0 rounded-[6px] object-cover" />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-[6px] bg-[#f4f4f5]" />
                      )}
                      <span className="font-medium text-[#18181b]">{r.name}</span>
                    </div>
                  </td>
                  <td className="max-w-[260px] truncate text-[13px] text-[#71717a]">{table === "packages" ? presetText(r) || "Chưa có preset" : r.description || "—"}</td>
                  <td className="font-medium">{formatVND(r.price)}</td>
                  <td>{r.is_active ? <Badge tone="green">Đang hiện</Badge> : <Badge>Đang ẩn</Badge>}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ ...r })} icon={<Pencil size={16} />}>Sửa</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickToggle(r)} icon={r.is_active ? <EyeOff size={16} /> : <Eye size={16} />}>{r.is_active ? "Ẩn" : "Hiện"}</Button>
                      <Button variant="ghost" size="sm" className="!text-[#dc2626] hover:!bg-[#fef2f2]" onClick={() => remove(r)} aria-label="Xoá"><Trash2 size={16} /></Button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </Table>
        </div>
      )}
    </Card>
  );
}

function Editor({ row, withFeatures, folder, onCancel, onSave }: { row: Row; withFeatures?: boolean; folder: string; onCancel: () => void; onSave: (r: Row) => void }) {
  const [r, setR] = useState(row);
  const [featuresText, setFeaturesText] = useState((row.features ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
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
      {folder === "packages" && (
        <div className="grid gap-3 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] p-4 sm:col-span-2 sm:grid-cols-3">
          <p className="text-[13px] font-semibold sm:col-span-3">Preset thiết kế (trang Custom CD)</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={r.has_disc !== false} onChange={(e) => setR({ ...r, has_disc: e.target.checked })} /> Có Mặt đĩa
          </label>
          <Field label="Số trang Bìa trước">
            <select className="field" value={r.front_pages ?? 0} onChange={(e) => setR({ ...r, front_pages: Number(e.target.value) })}>
              {[0, 1, 2, 4, 8, 12].map((n) => <option key={n} value={n}>{n === 0 ? "Không có" : n >= 4 ? `${n} (booklet)` : n}</option>)}
            </select>
          </Field>
          <Field label="Số trang Bìa sau">
            <select className="field" value={r.back_pages ?? 0} onChange={(e) => setR({ ...r, back_pages: Number(e.target.value) })}>
              {[0, 1, 2].map((n) => <option key={n} value={n}>{n === 0 ? "Không có" : n}</option>)}
            </select>
          </Field>
        </div>
      )}
      <ImageInput value={r.image_url} onChange={(url) => setR({ ...r, image_url: url })} folder={folder} label="Ảnh mẫu" />
      <div className="flex items-center"><Toggle checked={r.is_active} onChange={(v) => setR({ ...r, is_active: v })} label="Hiện trên web" /></div>
      <div className="flex justify-end gap-2 border-t border-[#efeff1] pt-4 sm:col-span-2">
        <Button variant="secondary" onClick={onCancel}>Huỷ</Button>
        <Button type="submit" loading={saving}>Lưu</Button>
      </div>
    </form>
  );
}
