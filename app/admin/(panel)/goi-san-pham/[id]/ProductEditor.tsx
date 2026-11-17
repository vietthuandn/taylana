"use client";

/* Sửa 1 sản phẩm: thông tin + các nhóm tuỳ chọn (Chọn 1 / Chọn nhiều) + lựa chọn (kéo thả sắp xếp). */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatVND } from "@/lib/format";
import { removePublicImage } from "@/lib/upload";
import type { Option, OptionGroup, Product } from "@/lib/catalog";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Button, Card, EmptyState, Field, ImageInput, ImagesInput, Input, Message, Select, Table, Textarea, Toggle, confirmDialog } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const PUBLIC_PATHS = ["/dat-don", "/gio-hang", "/custom-cd", "/thiet-ke", "/gui-file", "/gui-file-in"];
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const presetText = (o: Pick<Option, "front_pages" | "back_pages" | "has_disc">) => [
  o.front_pages ? (o.front_pages >= 4 ? `Booklet ${o.front_pages} trang` : `Bìa trước ${o.front_pages} trang`) : "",
  o.back_pages ? `Bìa sau ${o.back_pages} trang` : "", o.has_disc !== false && o.has_disc !== null ? "Mặt đĩa" : "",
].filter(Boolean).join(" · ");

export function ProductEditor({ id }: { id: string }) {
  const router = useRouter();
  const isNew = id === "moi";
  const [p, setP] = useState<Product | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (isNew) { setP({ id: "", slug: "", name: "", description: "", images: [], is_active: true, sort_order: 0, groups: [] }); return; }
    const sb = createClient();
    const [pr, gr, op] = await Promise.all([
      sb.from("products").select("*").eq("id", id).maybeSingle(),
      sb.from("option_groups").select("*").eq("product_id", id).order("sort_order").order("created_at"),
      sb.from("options").select("*").order("sort_order").order("created_at"),
    ]);
    if (pr.error || !pr.data) { setMsg({ type: "err", text: pr.error?.message ?? "Không tìm thấy sản phẩm" }); return; }
    const opts = (op.data ?? []) as Option[];
    setP({ ...(pr.data as Product), images: pr.data.images ?? [], groups: ((gr.data ?? []) as OptionGroup[]).map((g) => ({ ...g, options: opts.filter((o) => o.group_id === g.id) })) });
  }, [id, isNew]);
  useEffect(() => { load(); }, [load]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PUBLIC_PATHS); await load(); };

  async function saveInfo() {
    if (!p) return;
    if (!p.name.trim()) return setMsg({ type: "err", text: "Cần nhập tên sản phẩm." });
    const payload = { name: p.name.trim(), slug: slugify(p.slug || p.name) || `san-pham-${Date.now()}`, description: p.description, images: p.images, is_active: p.is_active };
    setSaving(true);
    const sb = createClient();
    const res = isNew ? await sb.from("products").insert(payload).select("id").single() : await sb.from("products").update(payload).eq("id", p.id).select("id").single();
    setSaving(false);
    if (res.error) return setMsg({ type: "err", text: res.error.message.includes("slug") ? "Đường dẫn (slug) đã có, đổi tên khác nhé." : res.error.message });
    await revalidatePublic(PUBLIC_PATHS);
    if (isNew) { router.replace(`/admin/goi-san-pham/${res.data.id}`); return; }
    setMsg({ type: "ok", text: "Đã lưu thông tin sản phẩm." });
  }
  async function removeProduct() {
    if (!p?.id || !await confirmDialog(`Xoá sản phẩm "${p.name}" cùng tất cả nhóm tuỳ chọn? Đơn cũ vẫn giữ thông tin đã đặt.`)) return;
    const { error } = await createClient().from("products").delete().eq("id", p.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await revalidatePublic(PUBLIC_PATHS);
    router.replace("/admin/goi-san-pham");
  }
  async function addGroup() {
    if (!p?.id) return;
    const { error } = await createClient().from("option_groups").insert({ product_id: p.id, name: "Nhóm mới", select_type: "multi", required: false, sort_order: (p.groups.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return setMsg({ type: "err", text: error.message });
    await after("Đã thêm nhóm tuỳ chọn.");
  }

  if (!p) return <><p className="text-[13px] text-[#71717a]">Đang tải...</p><Message msg={msg} /></>;
  return (
    <div className="space-y-6 pb-12">
      <Card title="Thông tin" description="Tên, mô tả và ảnh hiện trên trang Đặt đơn."
        actions={<>{!isNew && <Button variant="danger" size="sm" onClick={removeProduct} aria-label="Xoá sản phẩm"><Trash2 size={16} /></Button>}<Button size="sm" loading={saving} onClick={saveInfo}>{isNew ? "Tạo sản phẩm" : "Lưu"}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên sản phẩm *"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value, slug: isNew ? slugify(e.target.value) : p.slug })} /></Field>
          <Field label="Đường dẫn (slug)" hint="Dùng trong link /dat-don?sp=..."><Input value={p.slug} onChange={(e) => setP({ ...p, slug: slugify(e.target.value) })} /></Field>
          <Field label="Mô tả" hint="Xuống dòng để tách đoạn. Link tự bấm được." className="sm:col-span-2">
            <Textarea rows={5} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <ImagesInput value={p.images} onChange={(images) => setP({ ...p, images })} folder="products" label="Ảnh sản phẩm" hint="Kéo thả để sắp thứ tự. Ảnh đầu tiên là ảnh chính." />
          </div>
          <Toggle checked={p.is_active} onChange={(v) => setP({ ...p, is_active: v })} label="Đang bán" />
        </div>
      </Card>

      {!isNew && p.groups.map((g) => <GroupCard key={g.id} group={g} onChanged={after} onError={(t) => setMsg({ type: "err", text: t })} />)}
      {!isNew && <Button variant="secondary" icon={<Plus size={16} />} onClick={addGroup}>Thêm nhóm tuỳ chọn</Button>}
      <Message msg={msg} />
    </div>
  );
}

// ---------- 1 nhóm tuỳ chọn ----------
function GroupCard({ group, onChanged, onError }: { group: OptionGroup; onChanged: (t: string) => Promise<void>; onError: (t: string) => void }) {
  const [g, setG] = useState(group);
  const [editing, setEditing] = useState<Partial<Option> | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [order, setOrder] = useState(group.options);
  useEffect(() => { setG(group); setOrder(group.options); }, [group]);
  const isType = g.select_type === "single";
  const dirty = g.name !== group.name || g.select_type !== group.select_type || g.required !== group.required;

  async function saveGroup() {
    if (!g.name.trim()) return onError("Cần nhập tên nhóm.");
    const { error } = await createClient().from("option_groups").update({ name: g.name.trim(), select_type: g.select_type, required: g.required }).eq("id", g.id);
    if (error) return onError(error.message);
    await onChanged("Đã lưu nhóm.");
  }
  async function removeGroup() {
    if (!await confirmDialog(`Xoá nhóm "${group.name}" và ${group.options.length} lựa chọn?`)) return;
    const { error } = await createClient().from("option_groups").delete().eq("id", g.id);
    if (error) return onError(error.message);
    await onChanged("Đã xoá nhóm.");
  }
  async function saveOption(o: Partial<Option>) {
    if (!o.name?.trim()) return onError("Cần nhập tên lựa chọn.");
    const payload = {
      name: o.name.trim(), price: Math.max(0, Math.round(o.price ?? 0)), image_url: o.image_url ?? null, description: o.description ?? "",
      is_active: o.is_active ?? true,
      front_pages: isType ? o.front_pages ?? 0 : null, back_pages: isType ? o.back_pages ?? 0 : null, has_disc: isType ? o.has_disc !== false : null,
    };
    const sb = createClient();
    const res = o.id ? await sb.from("options").update(payload).eq("id", o.id)
      : await sb.from("options").insert({ ...payload, group_id: g.id, sort_order: (order.at(-1)?.sort_order ?? 0) + 1 });
    if (res.error) return onError(res.error.message);
    setEditing(null);
    await onChanged("Đã lưu lựa chọn.");
  }
  async function toggle(o: Option) {
    const { error } = await createClient().from("options").update({ is_active: !o.is_active }).eq("id", o.id);
    if (error) return onError(error.message);
    await onChanged(o.is_active ? "Đã ẩn lựa chọn." : "Đã hiện lựa chọn.");
  }
  async function remove(o: Option) {
    if (!await confirmDialog(`Xoá lựa chọn "${o.name}"? Đơn cũ vẫn giữ tên và giá đã đặt.`)) return;
    const { error } = await createClient().from("options").delete().eq("id", o.id);
    if (error) return onError(error.message);
    await removePublicImage(o.image_url);
    await onChanged("Đã xoá lựa chọn.");
  }
  async function drop(to: number) {
    if (drag === null || drag === to) return;
    const next = [...order];
    const [x] = next.splice(drag, 1);
    next.splice(to, 0, x);
    setOrder(next);
    const sb = createClient();
    await Promise.all(next.map((o, i) => (o.sort_order === i + 1 ? null : sb.from("options").update({ sort_order: i + 1 }).eq("id", o.id))));
    await onChanged("Đã đổi thứ tự.");
  }

  const seg = (on: boolean) => cx("rounded-[6px] px-3 py-1.5 text-[13px] font-medium", on ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]");
  return (
    <Card title={group.name} description={`${isType ? "Chọn 1" : "Chọn nhiều"}${group.required ? " · bắt buộc" : ""} · ${group.options.length} lựa chọn`}
      actions={<Button variant="danger" size="sm" onClick={removeGroup} aria-label="Xoá nhóm"><Trash2 size={16} /></Button>}>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Tên nhóm"><Input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} className="sm:w-56" /></Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Kiểu chọn</p>
          <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
            <button type="button" className={seg(g.select_type === "single")} onClick={() => setG({ ...g, select_type: "single" })}>Chọn 1</button>
            <button type="button" className={seg(g.select_type === "multi")} onClick={() => setG({ ...g, select_type: "multi" })}>Chọn nhiều</button>
          </div>
        </div>
        <div className="pb-2"><Toggle checked={g.required} onChange={(v) => setG({ ...g, required: v })} label="Bắt buộc" /></div>
        {dirty && <Button size="sm" onClick={saveGroup}>Lưu nhóm</Button>}
      </div>

      <div className="mt-4">
        <Table head={["", "Lựa chọn", isType ? "Giá" : "Giá cộng thêm", ...(isType ? ["Preset thiết kế"] : []), "Trạng thái", ""]}
          empty={!order.length && <EmptyState>Chưa có lựa chọn.</EmptyState>}>
          {order.map((o, i) => (
            editing?.id === o.id ? (
              <tr key={o.id} className="!h-auto hover:!bg-transparent"><td colSpan={isType ? 6 : 5} className="!p-4"><OptionForm o={editing} isType={isType} onCancel={() => setEditing(null)} onSave={saveOption} /></td></tr>
            ) : (
              <tr key={o.id} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); drop(i); setDrag(null); }}
                className={cx(drag === i && "opacity-40")}>
                <td className="w-8 cursor-grab text-[#a1a1aa]"><GripVertical size={16} /></td>
                <td>
                  <div className="flex items-center gap-3">
                    {o.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.image_url} alt="" className="h-9 w-9 shrink-0 rounded-[6px] object-cover" />
                    ) : <div className="h-9 w-9 shrink-0 rounded-[6px] bg-[#f4f4f5]" />}
                    <span className="font-medium text-[#18181b]">{o.name}</span>
                  </div>
                </td>
                <td className="tabular-nums">{isType ? "" : "+"}{formatVND(o.price)}</td>
                {isType && <td className="text-[13px] text-[#71717a]">{presetText(o) || "—"}</td>}
                <td>{o.is_active ? <Badge tone="green">Đang bán</Badge> : <Badge>Đang ẩn</Badge>}</td>
                <td className="text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ ...o })} icon={<Pencil size={16} />}>Sửa</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(o)} aria-label={o.is_active ? "Ẩn" : "Hiện"}>{o.is_active ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
                    <Button variant="ghost" size="sm" className="!text-[#dc2626]" onClick={() => remove(o)} aria-label="Xoá"><Trash2 size={16} /></Button>
                  </div>
                </td>
              </tr>
            )
          ))}
        </Table>
        {editing && !editing.id && <div className="mt-4 rounded-[12px] border border-[#e5e5e7] p-4"><OptionForm o={editing} isType={isType} onCancel={() => setEditing(null)} onSave={saveOption} /></div>}
        <Button variant="secondary" size="sm" className="mt-4" icon={<Plus size={16} />}
          onClick={() => setEditing({ name: "", price: 0, image_url: null, is_active: true, front_pages: 0, back_pages: 0, has_disc: true })}>Thêm lựa chọn</Button>
      </div>
    </Card>
  );
}

function OptionForm({ o, isType, onCancel, onSave }: { o: Partial<Option>; isType: boolean; onCancel: () => void; onSave: (o: Partial<Option>) => void }) {
  const [r, setR] = useState(o);
  const [saving, setSaving] = useState(false);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Tên *"><Input value={r.name ?? ""} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
      <Field label={isType ? "Giá (đ)" : "Giá cộng thêm (đ)"} hint={formatVND(r.price ?? 0)}>
        <Input type="number" min={0} step={1000} value={r.price ?? 0} onChange={(e) => setR({ ...r, price: Number(e.target.value) })} />
      </Field>
      {isType && (
        <div className="grid gap-3 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] p-4 sm:col-span-2 sm:grid-cols-3">
          <p className="text-[13px] font-semibold sm:col-span-3">Preset thiết kế (Custom CD, Gửi file)</p>
          <Field label="Số trang Bìa trước">
            <Select value={r.front_pages ?? 0} onChange={(e) => setR({ ...r, front_pages: Number(e.target.value) })}>
              {[0, 1, 2, 4, 8, 12].map((n) => <option key={n} value={n}>{n === 0 ? "Không có" : n >= 4 ? `${n} (booklet)` : n}</option>)}
            </Select>
          </Field>
          <Field label="Số trang Bìa sau">
            <Select value={r.back_pages ?? 0} onChange={(e) => setR({ ...r, back_pages: Number(e.target.value) })}>
              {[0, 1, 2].map((n) => <option key={n} value={n}>{n === 0 ? "Không có" : n}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-[14px]">
            <input type="checkbox" className="h-4 w-4" checked={r.has_disc !== false} onChange={(e) => setR({ ...r, has_disc: e.target.checked })} /> Có Mặt đĩa
          </label>
        </div>
      )}
      <ImageInput value={r.image_url ?? null} onChange={(u) => setR({ ...r, image_url: u })} folder="options" label="Ảnh riêng (không bắt buộc)" />
      <div className="flex items-center"><Toggle checked={r.is_active !== false} onChange={(v) => setR({ ...r, is_active: v })} label="Đang bán" /></div>
      <div className="flex justify-end gap-2 border-t border-[#efeff1] pt-4 sm:col-span-2">
        <Button variant="secondary" onClick={onCancel}>Huỷ</Button>
        <Button loading={saving} onClick={async () => { setSaving(true); await onSave(r); setSaving(false); }}>Lưu</Button>
      </div>
    </div>
  );
}
