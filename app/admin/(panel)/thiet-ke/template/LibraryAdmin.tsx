"use client";

/* Quản lý template → danh sách mẫu CỐ ĐỊNH của 1 loại (CD Template · Trang đơn · Trang đôi — bảng design_templates):
   nhóm theo danh mục, lọc danh mục, tìm theo tên. Mỗi thẻ: Sửa · Đổi tên · Đổi danh mục · Nhân bản · Bật/Tắt · Xoá; kéo thả đổi
   thứ tự trong danh mục. "+ Tạo mẫu mới" (tên, danh mục, mặt trống hoặc nhân bản 1 mẫu có sẵn) · "Danh mục" (quản lý danh mục).
   extra: nút riêng của từng loại (vd. "Chuyển mẫu cũ thành mẫu riêng"). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, Folder, FolderInput, GripVertical, Pencil, Plus, Search, Trash2, Type } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { deleteFiles } from "@/lib/storage/client";
import { KIND_INFO, blankTemplate, groupByCategory, type Category, type DesignTpl, type TplKind } from "@/lib/scrapbook/library";
import { MIGRATE_MSG, isMissing, loadCategories, loadTemplates } from "@/lib/scrapbook/libraryClient";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import { Badge, Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { RowMenu } from "@/components/ui/RowMenu";
import { LiveThumb } from "@/components/scrapbook/LibraryGrid";
import { CategoryManager, Modal } from "./CategoryManager";

export const EDITOR = "/admin/thiet-ke/template/sua";
export const PUBLIC_PATHS = ["/thiet-ke/cd-template", "/thiet-ke/booklet", "/thiet-ke/cd"];
const now = () => new Date().toISOString();

export function LibraryAdmin({ kind, extra, reloadKey = 0 }: { kind: TplKind; extra?: (reload: () => void) => React.ReactNode; reloadKey?: number }) {
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<DesignTpl[]>([]);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [drag, setDrag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [manage, setManage] = useState(false);
  const [moving, setMoving] = useState<DesignTpl | null>(null);
  const spread = kind === "booklet_spread", disc = kind === "cd", backc = kind === "back";

  const load = useCallback(async () => {
    try { const [c, t] = await Promise.all([loadCategories(kind), loadTemplates([kind])]); setCats(c); setItems(t); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải mẫu"); }
    setReady(true);
  }, [kind]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const shown = useMemo(() => items.filter((t) => (!cat || t.category_id === cat) && (!q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()))), [items, cat, q]);
  const groups = useMemo(() => groupByCategory(shown, cats), [shown, cats]);

  async function patch(t: DesignTpl, v: Partial<DesignTpl>, text: string) {
    const { error } = await createClient().from("design_templates").update({ ...v, updated_at: now() }).eq("id", t.id);
    if (error) return toast(isMissing(error.message) ? MIGRATE_MSG : error.message, "err"), false;
    setItems((l) => l.map((x) => (x.id === t.id ? { ...x, ...v } : x)));
    if (text) toast(text);
    await revalidatePublic(PUBLIC_PATHS);
    return true;
  }
  async function insert(v: Partial<DesignTpl>) {
    const sort = Math.max(0, ...items.filter((x) => x.category_id === v.category_id).map((x) => x.sort_order)) + 1;
    const { data, error } = await createClient().from("design_templates").insert({ kind, is_active: true, sort_order: sort, ...v }).select("id").single();
    if (error) { toast(isMissing(error.message) ? MIGRATE_MSG : error.message, "err"); return null; }
    await revalidatePublic(PUBLIC_PATHS);
    return data.id as string;
  }
  async function rename(t: DesignTpl) {
    const v = await promptDialog({ title: "Đổi tên mẫu", label: "Tên mẫu", defaultValue: t.name });
    if (v?.trim() && v.trim() !== t.name) await patch(t, { name: v.trim() }, "Đã đổi tên");
  }
  async function duplicate(t: DesignTpl) {
    const id = await insert({ name: `${t.name} (bản sao)`, category_id: t.category_id, config: structuredClone(t.config.legacy ? { template: t.config.template } : t.config), photo_count: t.photo_count, thumbnail_url: null });
    if (id) { toast("Đã nhân bản — đang mở trình sửa…"); router.push(`${EDITOR}?tpl=${id}`); }
  }
  async function remove(t: DesignTpl) {
    if (!(await confirmDialog({ title: `Xoá mẫu “${t.name}”?`, message: "Không khôi phục được. Bộ booklet đang dùng mẫu này sẽ trống ô tương ứng.", confirmText: "Xoá", danger: true }))) return;
    const { error } = await createClient().from("design_templates").delete().eq("id", t.id);
    if (error) return toast(error.message, "err");
    if (t.thumbnail_url) deleteFiles({ urls: [t.thumbnail_url] }).catch(() => 0);
    setItems((l) => l.filter((x) => x.id !== t.id));
    toast("Đã xoá mẫu");
    await revalidatePublic(PUBLIC_PATHS);
  }
  async function drop(target: DesignTpl) {
    const from = items.find((x) => x.id === drag);
    setDrag(null);
    if (!from || from.id === target.id) return;
    if (from.category_id !== target.category_id) return toast("Chỉ đổi thứ tự trong cùng danh mục — dùng “Đổi danh mục” để chuyển.", "err");
    const group = items.filter((x) => x.category_id === from.category_id && x.id !== from.id).sort((a, b) => a.sort_order - b.sort_order);
    group.splice(group.findIndex((x) => x.id === target.id) + (from.sort_order < target.sort_order ? 1 : 0), 0, from);
    const sb = createClient();
    await Promise.all(group.map((x, i) => (x.sort_order === i + 1 ? null : sb.from("design_templates").update({ sort_order: i + 1 }).eq("id", x.id))));
    setItems((l) => l.map((x) => { const i = group.findIndex((g) => g.id === x.id); return i >= 0 ? { ...x, sort_order: i + 1 } : x; }));
    toast("Đã đổi thứ tự");
    await revalidatePublic(PUBLIC_PATHS);
  }

  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[13px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]");
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Chưa có danh mục";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên" className="h-9 w-[220px] rounded-[8px] border border-[#e5e5e7] bg-white pl-8 pr-2 text-[14px] outline-none focus:border-[#ff5fa2]" />
        </label>
        <span className="flex-1" />
        {extra?.(load)}
        <Button variant="secondary" icon={<Folder size={16} />} onClick={() => setManage(true)}>Danh mục</Button>
        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Tạo mẫu mới</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setCat("")} className={chip(!cat)}>Tất cả ({items.length})</button>
        {cats.map((c) => <button key={c.id} type="button" onClick={() => setCat(c.id)} className={chip(cat === c.id)}>{c.name} ({items.filter((x) => x.category_id === c.id).length})</button>)}
      </div>
      {err && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{err}</p>}
      {ready && !err && !items.length && <p className="rounded-[12px] border border-dashed border-[#d4d4d8] bg-white p-8 text-center text-[14px] text-[#71717a]">Chưa có mẫu {KIND_INFO[kind].label} nào. Bấm “Tạo mẫu mới”{disc ? " hoặc “Chuyển mẫu cũ thành mẫu riêng”" : ""}.</p>}
      {groups.map((g) => (
        <section key={g.cat?.id ?? "other"}>
          <h3 className="mb-2 text-[14px] font-semibold text-[#18181b]">{g.cat?.name ?? "Chưa có danh mục"} <span className="font-normal text-[#a1a1aa]">· {g.items.length}</span></h3>
          <ul className={cx("grid gap-3", spread ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6")}>
            {g.items.map((t) => (
              <li key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(t)}
                className={cx("flex flex-col overflow-hidden rounded-[12px] border bg-white transition-shadow hover:shadow-[0_4px_16px_rgb(0_0_0/0.06)]", drag === t.id ? "border-[#ff5fa2] opacity-50" : "border-[#e5e5e7]")}>
                <button type="button" onClick={() => router.push(`${EDITOR}?tpl=${t.id}`)} className={cx("relative grid place-items-center bg-[#f4f4f5] p-2", spread ? "aspect-[2/1]" : backc ? "aspect-[150/117]" : "aspect-square")} aria-label={`Sửa ${t.name}`}>
                  <GripVertical size={15} className="absolute left-1 top-1 cursor-grab text-[#a1a1aa]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.thumbnail_url ? <img src={t.thumbnail_url} alt="" draggable={false} className={cx("max-h-full max-w-full", !t.is_active && "opacity-40")} loading="lazy" />
                    : backc ? <LiveThumb t={t} className={cx("max-h-full max-w-full", !t.is_active && "opacity-40")} />
                    : <span className={cx("grid place-items-center bg-white text-[11px] text-[#a1a1aa]", disc ? "aspect-square w-[80%] rounded-full" : spread ? "h-[80%] w-[90%]" : "aspect-square w-[80%]")}>Chưa có ảnh</span>}
                </button>
                <div className="flex flex-1 flex-col border-t border-[#efeff1] p-2.5">
                  <p className="truncate text-[13px] font-medium" title={t.name}>{t.name}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge>{t.photo_count} ảnh</Badge>
                    <button type="button" title={t.is_active ? "Đang bật — bấm để tắt" : "Đang tắt — bấm để bật"} onClick={() => patch(t, { is_active: !t.is_active }, t.is_active ? "Đã tắt mẫu" : "Đã bật mẫu")}
                      className={cx("inline-flex h-[22px] items-center gap-1 rounded-full border px-2 text-[12px] font-medium", t.is_active ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]" : "border-[#e5e5e7] bg-[#f4f4f5] text-[#71717a]")}>
                      {t.is_active ? <Eye size={12} /> : <EyeOff size={12} />}{t.is_active ? "Bật" : "Tắt"}
                    </button>
                    <RowMenu className="ml-auto -mr-1" items={[
                      { label: "Sửa", icon: <Pencil size={14} />, onClick: () => router.push(`${EDITOR}?tpl=${t.id}`) },
                      { label: "Đổi tên", icon: <Type size={14} />, onClick: () => rename(t) },
                      { label: "Đổi danh mục", icon: <FolderInput size={14} />, title: `Đang: ${catName(t.category_id)}`, onClick: () => setMoving(t) },
                      { label: "Nhân bản", icon: <Copy size={14} />, onClick: () => duplicate(t) },
                      { label: "Xoá", icon: <Trash2 size={14} />, danger: true, onClick: () => remove(t) },
                    ]} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {manage && <CategoryManager scope={kind} cats={cats} counts={Object.fromEntries(cats.map((c) => [c.id, items.filter((x) => x.category_id === c.id).length]))} onChange={setCats} onClose={() => setManage(false)} />}
      {moving && (
        <Modal onClose={() => setMoving(null)}>
          <div className="space-y-3 p-5">
            <h2 className="text-[16px] font-semibold">Đổi danh mục · {moving.name}</h2>
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => <button key={c.id} type="button" onClick={async () => { if (await patch(moving, { category_id: c.id, sort_order: Math.max(0, ...items.filter((x) => x.category_id === c.id).map((x) => x.sort_order)) + 1 }, `Đã chuyển sang “${c.name}”`)) setMoving(null); }} className={chip(moving.category_id === c.id)}>{c.name}</button>)}
            </div>
            {!cats.length && <p className="text-[13px] text-[#71717a]">Chưa có danh mục — bấm “Danh mục” để thêm.</p>}
          </div>
        </Modal>
      )}
      {creating && (
        <CreateModal kind={kind} cats={cats} items={items} onClose={() => setCreating(false)} onCreate={async (name, category_id, from) => {
          const src = items.find((x) => x.id === from);
          const template = src ? structuredClone(src.config.template) : blankTemplate(kind);
          const id = await insert({ name, category_id, config: { template }, photo_count: src?.photo_count ?? 0, thumbnail_url: null });
          if (id) { toast("Đã tạo mẫu — đang mở trình sửa…"); router.push(`${EDITOR}?tpl=${id}`); }
        }} />
      )}
    </div>
  );
}

function CreateModal({ kind, cats, items, onClose, onCreate }: { kind: TplKind; cats: Category[]; items: DesignTpl[]; onClose: () => void; onCreate: (name: string, cat: string | null, from: string | null) => Promise<void> }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState<string | null>(cats[0]?.id ?? null);
  const [from, setFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sel = "h-10 w-full rounded-[8px] border border-[#e5e5e7] bg-white px-2 text-[14px]";
  return (
    <Modal onClose={onClose}>
      <form className="space-y-4 p-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onCreate(name.trim() || "Mẫu mới", cat, from); setBusy(false); }}>
        <h2 className="text-[17px] font-semibold">Tạo mẫu mới · {KIND_INFO[kind].label}</h2>
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Tên mẫu</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mẫu mới" autoFocus className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" /></label>
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Danh mục</span>
          <select value={cat ?? ""} onChange={(e) => setCat(e.target.value || null)} className={sel}>
            <option value="">— Chưa có danh mục —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Bắt đầu từ</span>
          <select value={from ?? ""} onChange={(e) => setFrom(e.target.value || null)} className={sel}>
            <option value="">{kind === "cd" ? "Mặt đĩa trống" : kind === "back" ? "Bìa sau trống" : kind === "booklet_spread" ? "Cặp trang trống" : "Trang trống"}</option>
            {items.map((t) => <option key={t.id} value={t.id}>Nhân bản: {t.name}</option>)}
          </select></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Huỷ</Button><Button type="submit" loading={busy}>Tạo và mở trình sửa</Button></div>
      </form>
    </Modal>
  );
}
