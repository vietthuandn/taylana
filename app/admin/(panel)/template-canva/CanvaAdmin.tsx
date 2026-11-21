"use client";

/* Admin → Template Canva: thêm / sửa / xoá template (tên, kích thước hiển thị, loại, ảnh xem trước, link Canva, bật/tắt),
   kéo thả để đổi thứ tự. Cài đặt chung: icon + chữ trên nút "Dùng template". Link phải là https + canva.com / canva.link. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, GripVertical, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { uploadCanvaImage } from "@/lib/upload";
import { CANVA_KINDS, isCanvaUrl, mergeCanvaButton, type CanvaButton, type CanvaKind, type CanvaTemplate } from "@/lib/canva";
import { CanvaShape } from "@/components/site/CanvaShape";
import { Badge, Button, Card, EmptyState, Field, Input, Message, Select, Toggle, confirmDialog } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const PATHS = ["/thiet-ke"];
type Form = { id?: string; name: string; size_label: string; kind: CanvaKind; image_url: string; canva_url: string; is_active: boolean };
const EMPTY: Form = { name: "", size_label: "12 × 12 cm", kind: "front", image_url: "", canva_url: "", is_active: true };

export function CanvaAdmin() {
  const [list, setList] = useState<CanvaTemplate[]>([]);
  const [btn, setBtn] = useState<CanvaButton>(mergeCanvaButton(null));
  const [msg, setMsg] = useState<Msg>(null);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const iconIn = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [t, s] = await Promise.all([sb.from("canva_templates").select("*").order("sort_order").order("created_at"), sb.from("site_settings").select("value").eq("key", "canva_button").maybeSingle()]);
    if (t.error) setMsg({ type: "err", text: "Chưa có bảng template — cần chạy supabase/migration_canva_templates.sql." });
    setList((t.data ?? []) as CanvaTemplate[]);
    setBtn(mergeCanvaButton((s.data?.value as Partial<CanvaButton>) ?? null));
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PATHS); await load(); };

  async function save(f: Form) {
    if (!f.name.trim()) return setMsg({ type: "err", text: "Nhập tên template." });
    if (!isCanvaUrl(f.canva_url)) return setMsg({ type: "err", text: "Link Canva phải bắt đầu bằng https:// và thuộc canva.com hoặc canva.link." });
    if (f.image_url && !/^https?:\/\//i.test(f.image_url)) return setMsg({ type: "err", text: "Link ảnh xem trước phải bắt đầu bằng https://" });
    const row = { name: f.name.trim(), size_label: f.size_label.trim(), kind: f.kind, image_url: f.image_url.trim() || null, canva_url: f.canva_url.trim(), is_active: f.is_active };
    const sb = createClient();
    const { error } = f.id ? await sb.from("canva_templates").update(row).eq("id", f.id) : await sb.from("canva_templates").insert({ ...row, sort_order: (list.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return setMsg({ type: "err", text: error.message });
    setForm(null);
    await after(f.id ? "Đã lưu template." : "Đã thêm template.");
  }
  async function patch(id: string, v: Partial<CanvaTemplate>, text: string) {
    const { error } = await createClient().from("canva_templates").update(v).eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(text);
  }
  async function remove(t: CanvaTemplate) {
    if (!await confirmDialog(`Xoá template "${t.name}"?`, { title: "Xoá template?", ok: "Xoá", danger: true })) return;
    const { error } = await createClient().from("canva_templates").delete().eq("id", t.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after("Đã xoá template.");
  }
  async function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...list]; const [x] = next.splice(from, 1); next.splice(to, 0, x);
    setList(next);
    const sb = createClient();
    await Promise.all(next.map((t, i) => (t.sort_order === i + 1 ? null : sb.from("canva_templates").update({ sort_order: i + 1 }).eq("id", t.id))));
    await after("Đã đổi thứ tự.");
  }
  async function saveButton(v: CanvaButton) {
    const { error } = await createClient().from("site_settings").upsert({ key: "canva_button", value: v, updated_at: new Date().toISOString() });
    if (error) return setMsg({ type: "err", text: error.message });
    await after("Đã lưu cài đặt nút.");
  }

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-6">
      <Card title={`Template (${list.length})`} actions={<Button size="sm" icon={<Plus size={15} />} onClick={() => setForm({ ...EMPTY })}>Thêm template</Button>}>
        {list.length ? (
          <ul className="space-y-2">
            {list.map((t, i) => (
              <li key={t.id} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (drag !== null) reorder(drag, i); setDrag(null); }}
                className={cx("flex items-center gap-3 rounded-[10px] border border-[#e5e5e7] bg-white p-2", drag === i && "opacity-40", !t.is_active && "opacity-60")}>
                <GripVertical size={16} className="shrink-0 cursor-grab text-[#a1a1aa]" />
                <div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-[#f7f7f8]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.image_url ? <img src={t.image_url} alt="" className="max-h-full max-w-full object-contain" /> : <div className="grid h-full w-full place-items-center scale-[0.9]"><CanvaShape kind={t.kind} size="" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{t.name}</p>
                  <p className="text-[12px] text-[#71717a]">{t.size_label} · {CANVA_KINDS.find((k) => k.id === t.kind)?.name}</p>
                </div>
                {!t.is_active && <Badge>Đang tắt</Badge>}
                <Toggle checked={t.is_active} onChange={(v) => patch(t.id, { is_active: v }, v ? "Đã bật." : "Đã tắt.")} label="" />
                <a href={t.canva_url} target="_blank" rel="noopener noreferrer" title="Mở link Canva" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]"><ExternalLink size={15} /></a>
                <button type="button" onClick={() => setForm({ id: t.id, name: t.name, size_label: t.size_label, kind: t.kind, image_url: t.image_url ?? "", canva_url: t.canva_url, is_active: t.is_active })} title="Sửa" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]"><Pencil size={15} /></button>
                <button type="button" onClick={() => remove(t)} title="Xoá" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#a1a1aa] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Chưa có template.</EmptyState>}
        <p className="mt-2 text-[12px] text-[#a1a1aa]">Kéo thả để đổi thứ tự hiển thị.</p>
      </Card>

      <Card title="Nút “Dùng template”">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1 text-[13px] font-medium">Icon trên nút (PNG / SVG)</p>
            <div className="flex items-center gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-gradient-to-r from-[#00C4CC] to-[#7D2AE8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {btn.icon_url ? <img src={btn.icon_url} alt="" className="h-6 w-6 object-contain" /> : <ExternalLink size={18} className="text-white" />}
              </span>
              <Button size="sm" variant="secondary" icon={<Upload size={14} />} loading={busy} onClick={() => iconIn.current?.click()}>{btn.icon_url ? "Đổi icon" : "Tải icon"}</Button>
              {btn.icon_url && <button type="button" onClick={() => saveButton({ ...btn, icon_url: null })} className="text-[12px] text-[#dc2626]">Bỏ icon</button>}
              <input ref={iconIn} type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setBusy(true); try { await saveButton({ ...btn, icon_url: await uploadCanvaImage(f) }); } catch (err) { setMsg({ type: "err", text: err instanceof Error ? err.message : "Tải icon thất bại" }); } setBusy(false); }} />
            </div>
            <p className="mt-1 text-[12px] text-[#a1a1aa]">Chưa có icon thì nút dùng icon “mở liên kết”.</p>
          </div>
          <Field label="Chữ trên nút" className="min-w-[220px] flex-1"><Input value={btn.label} onChange={(e) => setBtn({ ...btn, label: e.target.value })} /></Field>
          <Button onClick={() => saveButton(mergeCanvaButton(btn))}>Lưu chữ</Button>
        </div>
      </Card>
      <Message msg={msg} />
      {form && <TemplateForm value={form} onClose={() => setForm(null)} onSave={save} onErr={(t) => setMsg({ type: "err", text: t })} />}
    </div>
  );
}

function TemplateForm({ value, onClose, onSave, onErr }: { value: Form; onClose: () => void; onSave: (f: Form) => void; onErr: (t: string) => void }) {
  const [f, setF] = useState(value);
  const [busy, setBusy] = useState(false);
  const imgIn = useRef<HTMLInputElement>(null);
  const linkOk = !f.canva_url || isCanvaUrl(f.canva_url);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-[560px] space-y-3 overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-semibold">{value.id ? "Sửa template" : "Thêm template"}</p>
        <Field label="Tên"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ví dụ: Bìa trước / Booklet" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kích thước hiển thị"><Input value={f.size_label} onChange={(e) => setF({ ...f, size_label: e.target.value })} placeholder="12 × 12 cm" /></Field>
          <Field label="Loại"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CanvaKind })}>{CANVA_KINDS.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select></Field>
        </div>
        <Field label="Link Canva" hint="https://… thuộc canva.com hoặc canva.link"><Input value={f.canva_url} onChange={(e) => setF({ ...f, canva_url: e.target.value })} placeholder="https://canva.link/..." /></Field>
        {!linkOk && <p className="text-[12px] text-[#dc2626]">Link phải là https và thuộc canva.com hoặc canva.link.</p>}
        <div>
          <p className="mb-1 text-[13px] font-medium">Ảnh xem trước</p>
          <div className="flex items-start gap-3">
            <div className="grid h-28 w-36 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#f7f7f8] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.image_url ? <img src={f.image_url} alt="" className="max-h-full max-w-full object-contain" /> : <CanvaShape kind={f.kind} size={f.size_label} />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Button size="sm" variant="secondary" icon={<Upload size={14} />} loading={busy} onClick={() => imgIn.current?.click()}>Tải ảnh lên</Button>
              <Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="hoặc dán link ảnh https://..." />
              {f.image_url && <button type="button" onClick={() => setF({ ...f, image_url: "" })} className="text-[12px] text-[#dc2626]">Bỏ ảnh</button>}
              <input ref={imgIn} type="file" accept="image/*" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setBusy(true); try { setF((c) => ({ ...c, image_url: "" })); const u = await uploadCanvaImage(file); setF((c) => ({ ...c, image_url: u })); } catch (err) { onErr(err instanceof Error ? err.message : "Tải ảnh thất bại"); } setBusy(false); }} />
            </div>
          </div>
        </div>
        <Toggle checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} label="Hiện với khách" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={() => onSave(f)} disabled={busy}>{value.id ? "Lưu" : "Thêm template"}</Button>
        </div>
      </div>
    </div>
  );
}
