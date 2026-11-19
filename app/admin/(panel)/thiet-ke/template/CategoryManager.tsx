"use client";

/* Quản lý danh mục mẫu (template_categories) của 1 phạm vi: thêm (gợi ý sẵn), đổi tên, bật/tắt, xoá (danh mục còn mẫu thì phải
   chuyển mẫu sang danh mục khác trước), kéo thả sắp xếp. */
import { useEffect, useState } from "react";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { SUGGESTED_CATEGORIES, type Category, type CategoryScope } from "@/lib/scrapbook/library";
import { MIGRATE_MSG, isMissing } from "@/lib/scrapbook/libraryClient";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import { Button, Toggle, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

const PATHS = ["/thiet-ke/cd-template", "/thiet-ke/booklet", "/thiet-ke/cd"];

export function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx("relative max-h-[92dvh] w-full overflow-y-auto rounded-[14px] bg-white shadow-xl", wide ? "max-w-[960px]" : "max-w-[460px]")}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

export function CategoryManager({ scope, cats, counts, onChange, onClose }: { scope: CategoryScope; cats: Category[]; counts: Record<string, number>; onChange: (c: Category[]) => void; onClose: () => void }) {
  const [list, setList] = useState(() => cats.slice().sort((a, b) => a.sort_order - b.sort_order));
  const [drag, setDrag] = useState<string | null>(null);
  const set = (l: Category[]) => { setList(l); onChange(l); };
  const sb = () => createClient();
  const fail = (m: string) => toast(isMissing(m) ? MIGRATE_MSG : m, "err");

  async function add(name: string) {
    const n = name.trim();
    if (!n) return;
    if (list.some((c) => c.name.toLowerCase() === n.toLowerCase())) return toast("Danh mục đã có", "err");
    const { data, error } = await sb().from("template_categories").insert({ scope, name: n, sort_order: list.length + 1 }).select("*").single();
    if (error) return fail(error.message);
    set([...list, data as Category]); toast("Đã thêm danh mục"); await revalidatePublic(PATHS);
  }
  async function rename(c: Category) {
    const v = await promptDialog({ title: "Đổi tên danh mục", label: "Tên", defaultValue: c.name });
    if (!v?.trim() || v.trim() === c.name) return;
    const { error } = await sb().from("template_categories").update({ name: v.trim() }).eq("id", c.id);
    if (error) return fail(error.message);
    set(list.map((x) => (x.id === c.id ? { ...x, name: v.trim() } : x))); await revalidatePublic(PATHS);
  }
  async function toggle(c: Category, v: boolean) {
    const { error } = await sb().from("template_categories").update({ is_active: v }).eq("id", c.id);
    if (error) return fail(error.message);
    set(list.map((x) => (x.id === c.id ? { ...x, is_active: v } : x))); await revalidatePublic(PATHS);
  }
  async function remove(c: Category) {
    if (counts[c.id]) return toast(`Danh mục “${c.name}” còn ${counts[c.id]} mẫu — chuyển mẫu sang danh mục khác trước (nút “Đổi danh mục” trên thẻ mẫu).`, "err");
    if (!(await confirmDialog({ title: `Xoá danh mục “${c.name}”?`, confirmText: "Xoá", danger: true }))) return;
    const { error } = await sb().from("template_categories").delete().eq("id", c.id);
    if (error) return fail(error.message);
    set(list.filter((x) => x.id !== c.id)); await revalidatePublic(PATHS);
  }
  async function drop(target: Category) {
    const from = list.find((x) => x.id === drag); setDrag(null);
    if (!from || from.id === target.id) return;
    const a = list.filter((x) => x.id !== from.id); a.splice(a.findIndex((x) => x.id === target.id) + (list.indexOf(from) < list.indexOf(target) ? 1 : 0), 0, from);
    const next = a.map((x, i) => ({ ...x, sort_order: i + 1 }));
    set(next);
    await Promise.all(next.map((x) => sb().from("template_categories").update({ sort_order: x.sort_order }).eq("id", x.id)));
    await revalidatePublic(PATHS);
  }
  const missing = SUGGESTED_CATEGORIES.filter((n) => !list.some((c) => c.name.toLowerCase() === n.toLowerCase()));
  return (
    <Modal onClose={onClose}>
      <div className="space-y-4 p-5">
        <h2 className="text-[17px] font-semibold">Danh mục</h2>
        <ul className="space-y-1">
          {list.map((c) => (
            <li key={c.id} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(c)}
              className={cx("flex items-center gap-2 rounded-[8px] border px-2 py-1.5", drag === c.id ? "border-[#ff5fa2] opacity-50" : "border-[#e5e5e7]")}>
              <GripVertical size={14} className="cursor-grab text-[#a1a1aa]" />
              <span className="min-w-0 flex-1 truncate text-[14px]">{c.name} <span className="text-[12px] text-[#a1a1aa]">· {counts[c.id] ?? 0} mẫu</span></span>
              <Toggle checked={c.is_active} onChange={(v) => toggle(c, v)} label="" />
              <button type="button" onClick={() => rename(c)} title="Đổi tên" className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]"><Pencil size={14} /></button>
              <button type="button" onClick={() => remove(c)} title="Xoá" className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
            </li>
          ))}
          {!list.length && <li className="text-[13px] text-[#71717a]">Chưa có danh mục.</li>}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.namedItem("n") as HTMLInputElement; add(f.value); f.value = ""; }}>
          <input name="n" placeholder="Tên danh mục mới" className="h-9 flex-1 rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
          <Button type="submit" size="sm" icon={<Plus size={14} />}>Thêm</Button>
        </form>
        {missing.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] text-[#71717a]">Gợi ý:</p>
            <div className="flex flex-wrap gap-1.5">{missing.map((n) => <button key={n} type="button" onClick={() => add(n)} className="h-7 rounded-full border border-dashed border-[#d4d4d8] px-3 text-[12px] text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]">+ {n}</button>)}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
