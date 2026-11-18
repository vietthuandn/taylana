"use client";

/* Quản lý Mẫu Custom CD (design_templates) và Khung Photostrip (photostrip_frames). */
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { SPECS } from "@/lib/print";
import { newSlotId, stripSlots, targetLabels, type Slot } from "@/lib/templates";
import { revalidatePublic } from "@/app/admin/actions";
import { useSize } from "@/components/designer/useSize";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import type { TemplateDoc } from "@/lib/cdDoc";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { btnClass, inputClass } from "./styles";
import { AdminPage, Badge, Button, EmptyState, Field, ImageInput, Message, PageHeader, SortButtons, Toggle, confirmDialog } from "./ui";

const TemplateCanvas = dynamic(() => import("./TemplateCanvas").then((m) => m.TemplateCanvas), { ssr: false });
// Mẫu Custom CD: dùng chung trình chỉnh với trang Custom CD
const CdTemplateEditor = dynamic(() => import("@/components/cd-editor/TemplateEditor").then((m) => m.CdTemplateEditor), { ssr: false });

type Mode = "cd" | "strip";
type Row = {
  id?: string; name: string; overlay_url: string | null; slots: Slot[]; is_active: boolean; sort_order: number;
  target?: "front" | "back" | "back_outer" | "back_inner" | "disc"; background_url?: string | null;
  doc?: TemplateDoc | null; thumbnail_url?: string | null;
  slot_count?: 3 | 4; background_color?: string;
};

const cfg = {
  cd: { table: "design_templates", path: "/thiet-ke/cd", folder: "templates" },
  strip: { table: "photostrip_frames", path: "/photostrip", folder: "photostrip" },
} as const;

const specOf = (mode: Mode, r: Row) => (mode === "strip" ? SPECS.photostrip : r.target === "disc" ? SPECS.disc : !r.target || r.target === "front" ? SPECS.front : SPECS.back);

export function TemplateAdmin({ mode }: { mode: Mode }) {
  const { table, path, folder } = cfg[mode];
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().from(table).select("*").order("sort_order").order("created_at");
    if (error) setMsg({ type: "err", text: error.message });
    setRows((data as Row[]) ?? []);
  }, [table]);
  useEffect(() => { load(); }, [load]);

  async function after(text: string) {
    setMsg({ type: "ok", text });
    await revalidatePublic([path]);
    await load();
  }

  function blank(): Row {
    return mode === "cd"
      ? { name: "", target: "front", overlay_url: null, background_url: null, slots: [], is_active: true, sort_order: 0 }
      : { name: "", slot_count: 4, overlay_url: null, background_url: null, background_color: "#ffffff", slots: stripSlots(4), is_active: true, sort_order: 0 };
  }

  async function save(r: Row) {
    if (!r.name.trim()) return setMsg({ type: "err", text: "Cần đặt tên mẫu" });
    const payload: Record<string, unknown> = { name: r.name.trim(), overlay_url: r.overlay_url, slots: r.slots, is_active: r.is_active };
    if (mode === "cd") Object.assign(payload, { target: r.target, background_url: r.background_url ?? null },
      r.doc !== undefined ? { doc: r.doc, thumbnail_url: r.thumbnail_url ?? null } : {});
    else Object.assign(payload, { slot_count: r.slot_count, background_color: r.background_color || "#ffffff", background_url: r.background_url ?? null });
    const sb = createClient();
    const res = r.id ? await sb.from(table).update(payload).eq("id", r.id)
      : await sb.from(table).insert({ ...payload, sort_order: (rows.at(-1)?.sort_order ?? 0) + 1 });
    if (res.error) return setMsg({ type: "err", text: res.error.message });
    setEditing(null);
    await after("✓ Đã lưu mẫu");
  }

  async function remove(r: Row) {
    if (!r.id || !await confirmDialog(`Xoá mẫu "${r.name}"?`)) return;
    const { error } = await createClient().from(table).delete().eq("id", r.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await Promise.all([removePublicImage(r.overlay_url), removePublicImage(r.background_url)]);
    await after("✓ Đã xoá");
  }

  async function toggle(r: Row) {
    const { error } = await createClient().from(table).update({ is_active: !r.is_active }).eq("id", r.id!);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(r.is_active ? "Đã ẩn mẫu" : "Đã hiện mẫu");
  }

  async function move(i: number, dir: -1 | 1) {
    const next = [...rows];
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x);
    setRows(next);
    const sb = createClient();
    await Promise.all(next.map((r, idx) => (r.sort_order === idx + 1 ? null : sb.from(table).update({ sort_order: idx + 1 }).eq("id", r.id!))));
    await after("✓ Đã đổi thứ tự");
  }

  if (editing && mode === "cd") {
    return (
      <><Message msg={msg} /><CdTemplateEditor row={editing as never} onCancel={() => setEditing(null)}
        onSave={(v) => save({ ...editing, name: v.name, target: v.target, is_active: v.is_active, doc: v.doc, thumbnail_url: v.thumbnail_url, overlay_url: null, background_url: null, slots: [] })} /></>
    );
  }
  if (editing) {
    return <><Message msg={msg} /><Editor mode={mode} folder={folder} row={editing} onCancel={() => setEditing(null)} onSave={save} /></>;
  }

  const info = mode === "cd"
    ? { title: "Mẫu Custom CD", desc: "Mẫu thiết kế khách chọn ở trang Custom CD: ảnh trang trí, khung ảnh, chữ, màu nền." }
    : { title: "Khung Photostrip", desc: "Khổ 2 x 6 inch (600 x 1800 px). Mỗi khung có 3 hoặc 4 ô ảnh, màu nền và ảnh trang trí phía trước (tuỳ chọn)." };

  return (
    <AdminPage>
      <PageHeader title={info.title}
        actions={<Button icon={<Plus size={16} />} onClick={() => setEditing(blank())}>Tạo mẫu mới</Button>} />
      <Message msg={msg} />
      {!rows.length && (
        <div className="rounded-[12px] border border-dashed border-[#d4d4d8] bg-white">
          <EmptyState>Chưa có mẫu nào.{mode === "strip" ? " Khách đang dùng 2 khung trắng mặc định (3 và 4 ảnh)." : ""}</EmptyState>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rows.map((r, i) => {
          const spec = specOf(mode, r);
          return (
            <li key={r.id} className="group flex flex-col overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white transition-shadow hover:shadow-[0_4px_16px_rgb(0_0_0/0.06)]">
              <button className="grid aspect-square place-items-center bg-[#f4f4f5] p-4" onClick={() => setEditing({ ...r })} aria-label={`Sửa ${r.name}`}>
                <div className={`${mode === "strip" ? "h-full" : "w-full"} ${r.is_active ? "" : "opacity-50"}`} style={mode === "strip" ? { aspectRatio: `${spec.w} / ${spec.h}` } : undefined}>
                  {r.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail_url} alt="" className={`w-full object-cover shadow-sm ${spec.shape === "disc" ? "rounded-full" : "rounded-[4px]"}`} style={{ aspectRatio: `${spec.w} / ${spec.h}` }} />
                  ) : <TemplateThumb ratio={spec.w / spec.h} slots={r.slots} overlay={r.overlay_url} background={r.background_url}
                    bgColor={r.background_color} disc={spec.shape === "disc"} />}
                </div>
              </button>
              <div className="flex flex-1 flex-col border-t border-[#efeff1] p-3">
                <p className="truncate text-[14px] font-medium text-[#18181b]">{r.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge>{mode === "cd" ? targetLabels[r.target ?? "front"] : `${r.slot_count} ảnh`}</Badge>
                  {r.is_active ? <Badge tone="green">Hiện</Badge> : <Badge>Ẩn</Badge>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-1 pt-2">
                  <SortButtons first={i === 0} last={i === rows.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
                  <span className="flex">
                    <button className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]" title="Sửa" onClick={() => setEditing({ ...r })}><Pencil size={16} /></button>
                    <button className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]" title={r.is_active ? "Ẩn" : "Hiện"} onClick={() => toggle(r)}>{r.is_active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]" title="Xoá" onClick={() => remove(r)}><Trash2 size={16} /></button>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </AdminPage>
  );
}

function Editor({ mode, folder, row, onCancel, onSave }: { mode: Mode; folder: string; row: Row; onCancel: () => void; onSave: (r: Row) => Promise<unknown> }) {
  const [r, setR] = useState<Row>(row);
  const [sel, setSel] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.8);
  const [saving, setSaving] = useState(false);
  const spec = specOf(mode, r);
  const width = mode === "strip" ? 220 : spec.w > spec.h ? 440 : 380;
  const [areaRef, area] = useSize<HTMLDivElement>();
  const selected = r.slots.find((s) => s.id === sel);
  const mm = (f: number, total: number) => Math.round(f * total * 10) / 10;

  function addSlot(shape: Slot["shape"]) {
    const ratio = spec.w / spec.h;
    const w = 0.35, h = shape === "circle" ? 0.35 * ratio : 0.35 * (mode === "strip" ? 0.6 : ratio);
    const s: Slot = { id: newSlotId(), shape, x: 0.5 - w / 2, y: 0.5 - h / 2, w, h };
    setR({ ...r, slots: [...r.slots, s] });
    setSel(s.id);
  }

  function setSlot(p: Partial<Slot>) {
    if (!sel) return;
    setR({ ...r, slots: r.slots.map((s) => (s.id === sel ? { ...s, ...p } : s)) });
  }

  const fit = area.w > 0 ? Math.max(120, Math.min(area.w - 64, (area.h - 150) * (spec.w / spec.h))) : width;

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col bg-white">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e5e5e7] px-3">
        <Button variant="secondary" size="sm" onClick={onCancel}>← Danh sách mẫu</Button>
        <input className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 text-[14px] font-semibold text-[#18181b] hover:border-[#e5e5e7] focus:border-[#ff5fa2] focus:outline-none focus:ring-[3px] focus:ring-[#ff5fa2]/15 sm:max-w-sm"
          placeholder="Tên mẫu" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} aria-label="Tên mẫu" />
        <Button className="ml-auto" loading={saving} onClick={async () => { setSaving(true); await onSave(r); setSaving(false); }}>Lưu mẫu</Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---------- Canvas ---------- */}
        <div ref={areaRef} className="flex min-h-[420px] min-w-0 flex-col items-center justify-center gap-3 overflow-auto bg-[#f4f4f5] p-6 lg:flex-1">
          <div style={{ width: fit }}>
            <TemplateCanvas spec={spec} width={fit} overlay={r.overlay_url} background={r.background_url} bgColor={r.background_color}
              slots={r.slots} onChange={(slots) => setR({ ...r, slots })} selectedId={sel} onSelect={setSel} overlayOpacity={opacity} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => addSlot("rect")}>＋ Ô chữ nhật</Button>
            <Button variant="secondary" size="sm" onClick={() => addSlot("circle")}>＋ Ô tròn</Button>
            {mode === "strip" && (
              <Button variant="secondary" size="sm" onClick={() => setR({ ...r, slots: stripSlots(r.slot_count ?? 4) })}>Chia ô tự động</Button>
            )}
          </div>
          <p className="text-center text-[12px] text-[#71717a]">Kéo ô để di chuyển · kéo góc để đổi kích thước. Ô màu hồng là ô đang chọn.</p>
        </div>

        {/* ---------- Thuộc tính ---------- */}
        <aside className="space-y-4 border-[#e5e5e7] p-4 lg:w-[320px] lg:shrink-0 lg:overflow-y-auto lg:border-l">
          {mode === "cd" ? (
            <Field label="Áp dụng cho">
              <select className={inputClass} value={r.target} onChange={(e) => setR({ ...r, target: e.target.value as Row["target"] })}>
                <option value="front">Bìa trước (12 x 12 cm)</option>
                <option value="back">Bìa sau (15 x 11.7 cm)</option>
                <option value="disc">Mặt đĩa (tròn 12 cm)</option>
              </select>
            </Field>
          ) : (
            <Field label="Số ảnh">
              <select className={inputClass} value={r.slot_count} onChange={(e) => setR({ ...r, slot_count: Number(e.target.value) as 3 | 4 })}>
                <option value={3}>3 ảnh</option>
                <option value={4}>4 ảnh</option>
              </select>
            </Field>
          )}
          <ImageInput value={r.overlay_url} onChange={(u) => setR({ ...r, overlay_url: u })} folder={folder}
            label={`Ảnh khung phía trước (PNG nền trong suốt, nên ${mode === "strip" ? "600 x 1800" : `${Math.round((spec.w / 25.4) * 300)} x ${Math.round((spec.h / 25.4) * 300)}`} px)`} />
          {mode === "cd" ? (
            <ImageInput value={r.background_url ?? null} onChange={(u) => setR({ ...r, background_url: u })} folder={folder} label="Ảnh nền phía sau (không bắt buộc)" />
          ) : (
            <ImageInput value={r.background_url ?? null} onChange={(u) => setR({ ...r, background_url: u })} folder={folder}
              label="Ảnh nền phía sau (không bắt buộc, nên 600 x 1800 px)" removeLabel="Bỏ ảnh — dùng màu nền" />
          )}
          {mode === "strip" && (
            <Field label="Màu nền (khi không có ảnh nền)">
              <input type="color" className="h-9 w-14 rounded-[8px] border border-[#e5e5e7]" value={r.background_color} onChange={(e) => setR({ ...r, background_color: e.target.value })} />
            </Field>
          )}

          {selected ? (
            <div className="rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] p-3">
              <p className="mb-2 text-[13px] font-medium">Ô #{r.slots.indexOf(selected) + 1} ({selected.shape === "circle" ? "tròn" : "chữ nhật"}) — chỉnh số chính xác (mm):</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(["x", "y", "w", "h"] as const).map((k) => {
                  const total = k === "x" || k === "w" ? spec.w : spec.h;
                  return (
                    <label key={k}>{{ x: "Trái", y: "Trên", w: "Rộng", h: "Cao" }[k]}
                      <input className={`${inputClass} !px-2`} type="number" step={0.5} value={mm(selected[k], total)}
                        onChange={(e) => setSlot({ [k]: Number(e.target.value) / total })} />
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={btnClass("secondary", "sm")} onClick={() => setSlot({ shape: selected.shape === "circle" ? "rect" : "circle" })}>
                  Đổi thành {selected.shape === "circle" ? "chữ nhật" : "tròn"}
                </button>
                <button className={btnClass("secondary", "sm")} onClick={() => {
                  const c = { ...selected, id: newSlotId(), x: Math.min(selected.x + 0.04, 1 - selected.w), y: Math.min(selected.y + 0.04, 1 - selected.h) };
                  setR({ ...r, slots: [...r.slots, c] }); setSel(c.id);
                }}>Nhân đôi</button>
                <button className={btnClass("danger", "sm")} onClick={() => { setR({ ...r, slots: r.slots.filter((s) => s.id !== sel) }); setSel(null); }}>Xoá ô</button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#71717a]">Bấm vào một ô trên canvas để chỉnh số đo hoặc xoá.</p>
          )}

          {mode === "strip" && r.slots.length !== r.slot_count && (
            <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#dc2626]">Khung {r.slot_count} ảnh nhưng đang có {r.slots.length} ô.</p>
          )}
          {r.overlay_url && (
            <Field label="Độ hiện của khung khi chỉnh">
              <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full" />
            </Field>
          )}
          <Toggle checked={r.is_active} onChange={(v) => setR({ ...r, is_active: v })} label="Hiện cho khách" />
        </aside>
      </div>
    </div>
  );
}
