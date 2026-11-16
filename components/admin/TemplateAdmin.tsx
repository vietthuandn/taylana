"use client";

/* Quản lý Mẫu Custom CD (design_templates) và Khung Photostrip (photostrip_frames). */
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { removePublicImage } from "@/lib/upload";
import { SPECS } from "@/lib/print";
import { newSlotId, stripSlots, targetLabels, type Slot } from "@/lib/templates";
import { revalidatePublic } from "@/app/admin/actions";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { Badge, Field, ImageInput, Message, SortButtons, Toggle } from "./ui";

const TemplateCanvas = dynamic(() => import("./TemplateCanvas").then((m) => m.TemplateCanvas), { ssr: false });

type Mode = "cd" | "strip";
type Row = {
  id?: string; name: string; overlay_url: string | null; slots: Slot[]; is_active: boolean; sort_order: number;
  target?: "front" | "back" | "disc"; background_url?: string | null;
  slot_count?: 3 | 4; background_color?: string;
};

const cfg = {
  cd: { table: "design_templates", path: "/custom-cd", folder: "templates" },
  strip: { table: "photostrip_frames", path: "/photostrip", folder: "photostrip" },
} as const;

const specOf = (mode: Mode, r: Row) => (mode === "strip" ? SPECS.photostrip : SPECS[r.target ?? "front"]);

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
      : { name: "", slot_count: 4, overlay_url: null, background_color: "#ffffff", slots: stripSlots(4), is_active: true, sort_order: 0 };
  }

  async function save(r: Row) {
    if (!r.name.trim()) return setMsg({ type: "err", text: "Cần đặt tên mẫu" });
    const payload: Record<string, unknown> = { name: r.name.trim(), overlay_url: r.overlay_url, slots: r.slots, is_active: r.is_active };
    if (mode === "cd") Object.assign(payload, { target: r.target, background_url: r.background_url ?? null });
    else Object.assign(payload, { slot_count: r.slot_count, background_color: r.background_color || "#ffffff" });
    const sb = createClient();
    const res = r.id ? await sb.from(table).update(payload).eq("id", r.id)
      : await sb.from(table).insert({ ...payload, sort_order: (rows.at(-1)?.sort_order ?? 0) + 1 });
    if (res.error) return setMsg({ type: "err", text: res.error.message });
    setEditing(null);
    await after("✓ Đã lưu mẫu");
  }

  async function remove(r: Row) {
    if (!r.id || !confirm(`Xoá mẫu "${r.name}"?`)) return;
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

  if (editing) {
    return <Editor mode={mode} folder={folder} row={editing} onCancel={() => setEditing(null)} onSave={save} />;
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button className="btn btn-sm" onClick={() => setEditing(blank())}>+ Tạo mẫu mới</button>
      </div>
      <div className="mb-3"><Message msg={msg} /></div>
      {!rows.length && <p className="text-ink-500">Chưa có mẫu nào.{mode === "strip" ? " Khách đang dùng 2 khung trắng mặc định (3 và 4 ảnh)." : ""}</p>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {rows.map((r, i) => {
          const spec = specOf(mode, r);
          return (
            <li key={r.id} className={`pop-sm rounded-2xl bg-cream-50 p-3 ${r.is_active ? "" : "opacity-60"}`}>
              <div className={mode === "strip" ? "mx-auto w-16" : ""}>
                <TemplateThumb ratio={spec.w / spec.h} slots={r.slots} overlay={r.overlay_url} background={r.background_url}
                  bgColor={r.background_color} disc={spec.shape === "disc"} />
              </div>
              <p className="mt-2 truncate font-display">{r.name}</p>
              <p className="flex flex-wrap gap-1">
                <Badge tone="matcha">{mode === "cd" ? targetLabels[r.target ?? "front"] : `${r.slot_count} ảnh`}</Badge>
                <Badge>{r.slots.length} ô</Badge>
                {!r.is_active && <Badge tone="pink">Ẩn</Badge>}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                <SortButtons first={i === 0} last={i === rows.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
                <span className="flex gap-1">
                  <button className="rounded-full bg-lime-300 px-2 py-0.5 text-xs" onClick={() => setEditing({ ...r })}>Sửa</button>
                  <button className="rounded-full bg-cream-200 px-2 py-0.5 text-xs" onClick={() => toggle(r)}>{r.is_active ? "Ẩn" : "Hiện"}</button>
                  <button className="rounded-full bg-hot-100 px-2 py-0.5 text-xs text-hot-500" onClick={() => remove(r)}>Xoá</button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Editor({ mode, folder, row, onCancel, onSave }: { mode: Mode; folder: string; row: Row; onCancel: () => void; onSave: (r: Row) => Promise<unknown> }) {
  const [r, setR] = useState<Row>(row);
  const [sel, setSel] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.8);
  const [saving, setSaving] = useState(false);
  const spec = specOf(mode, r);
  const width = mode === "strip" ? 220 : spec.w > spec.h ? 440 : 380;
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

  return (
    <div className="pop rounded-3xl bg-violet-100 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl">{r.id ? "Sửa mẫu" : "Mẫu mới"}</h2>
        <button className="text-sm underline" onClick={onCancel}>← Quay lại danh sách</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* ---------- Canvas ---------- */}
        <div>
          <div className="mx-auto" style={{ width }}>
            <TemplateCanvas spec={spec} width={width} overlay={r.overlay_url} background={r.background_url} bgColor={r.background_color}
              slots={r.slots} onChange={(slots) => setR({ ...r, slots })} selectedId={sel} onSelect={setSel} overlayOpacity={opacity} />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => addSlot("rect")}>＋ Ô chữ nhật</button>
            <button className="btn btn-ghost btn-sm" onClick={() => addSlot("circle")}>＋ Ô tròn</button>
            {mode === "strip" && (
              <button className="btn btn-ghost btn-sm" onClick={() => setR({ ...r, slots: stripSlots(r.slot_count ?? 4) })}>Chia ô tự động</button>
            )}
          </div>
          {r.overlay_url && (
            <label className="mt-3 block text-center text-xs">Độ hiện của khung khi chỉnh
              <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-violet-500" />
            </label>
          )}
          <p className="mt-2 text-center text-xs text-ink-600">Kéo ô để di chuyển · kéo góc để đổi kích thước. Ô màu hồng là ô đang chọn.</p>
        </div>

        {/* ---------- Thông tin ---------- */}
        <div className="space-y-4">
          <Field label="Tên mẫu *"><input className="field" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
          {mode === "cd" ? (
            <Field label="Áp dụng cho">
              <select className="field" value={r.target} onChange={(e) => setR({ ...r, target: e.target.value as Row["target"] })}>
                <option value="front">Bìa trước (12 x 12 cm)</option>
                <option value="back">Bìa sau (15 x 11.7 cm)</option>
                <option value="disc">Mặt đĩa (tròn 12 cm)</option>
              </select>
            </Field>
          ) : (
            <Field label="Số ảnh">
              <select className="field" value={r.slot_count} onChange={(e) => setR({ ...r, slot_count: Number(e.target.value) as 3 | 4 })}>
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
            <Field label="Màu nền">
              <input type="color" className="h-10 w-16" value={r.background_color} onChange={(e) => setR({ ...r, background_color: e.target.value })} />
            </Field>
          )}

          {selected ? (
            <div className="rounded-2xl bg-cream-50 p-3">
              <p className="mb-2 text-sm font-medium">Ô #{r.slots.indexOf(selected) + 1} ({selected.shape === "circle" ? "tròn" : "chữ nhật"}) — chỉnh số chính xác (mm):</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(["x", "y", "w", "h"] as const).map((k) => {
                  const total = k === "x" || k === "w" ? spec.w : spec.h;
                  return (
                    <label key={k}>{{ x: "Trái", y: "Trên", w: "Rộng", h: "Cao" }[k]}
                      <input className="field !min-h-9 !px-2 !text-sm" type="number" step={0.5} value={mm(selected[k], total)}
                        onChange={(e) => setSlot({ [k]: Number(e.target.value) / total })} />
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => setSlot({ shape: selected.shape === "circle" ? "rect" : "circle" })}>
                  Đổi thành {selected.shape === "circle" ? "chữ nhật" : "tròn"}
                </button>
                <button className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => {
                  const c = { ...selected, id: newSlotId(), x: Math.min(selected.x + 0.04, 1 - selected.w), y: Math.min(selected.y + 0.04, 1 - selected.h) };
                  setR({ ...r, slots: [...r.slots, c] }); setSel(c.id);
                }}>Nhân đôi</button>
                <button className="rounded-full bg-hot-100 px-3 py-1 text-sm text-hot-500" onClick={() => { setR({ ...r, slots: r.slots.filter((s) => s.id !== sel) }); setSel(null); }}>Xoá ô</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-600">Bấm vào một ô trên canvas để chỉnh số đo hoặc xoá.</p>
          )}

          {mode === "strip" && r.slots.length !== r.slot_count && (
            <p className="rounded-xl bg-hot-100 px-3 py-2 text-xs text-hot-500">Khung {r.slot_count} ảnh nhưng đang có {r.slots.length} ô.</p>
          )}
          <Toggle checked={r.is_active} onChange={(v) => setR({ ...r, is_active: v })} label="Hiện cho khách" />
          <div className="flex gap-2">
            <button className="btn btn-sm" disabled={saving}
              onClick={async () => { setSaving(true); await onSave(r); setSaving(false); }}>{saving ? "Đang lưu..." : "Lưu mẫu"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>Huỷ</button>
          </div>
        </div>
      </div>
    </div>
  );
}
