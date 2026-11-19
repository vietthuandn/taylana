"use client";

/* Booklet Template → "Trình tạo template": bộ booklet hoàn chỉnh (bảng booklet_bundles) = tên, danh mục (scope booklet_bundle),
   số trang 2 / 4 / 8 / 12 → các ô đúng loại (đơn / đôi), mỗi ô chọn 1 mẫu (lọc theo danh mục, dùng lại 1 mẫu cho nhiều ô được),
   xem trước cả bộ bằng trình xem sách. Thumbnail của bộ = trang 1. Danh sách: lọc số trang / danh mục, sửa, nhân bản, bật tắt,
   xoá, kéo thả sắp xếp. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Folder, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { BUNDLE_PAGES, bundleSlots, groupByCategory, type Bundle, type Category, type DesignTpl, type TplKind } from "@/lib/scrapbook/library";
import { MIGRATE_MSG, isMissing, loadBundles, loadCategories, loadTemplates } from "@/lib/scrapbook/libraryClient";
import { confirmDialog } from "@/components/ui/dialog";
import { Badge, Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { CategoryManager, Modal } from "./CategoryManager";
import { PUBLIC_PATHS } from "./LibraryAdmin";

type Draft = { id?: string; name: string; category_id: string | null; page_count: number; template_ids: string[]; is_active: boolean };
const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[13px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]");

export function BundleAdmin() {
  const [cats, setCats] = useState<Category[]>([]);
  const [tplCats, setTplCats] = useState<Category[]>([]);
  const [tpls, setTpls] = useState<DesignTpl[]>([]);
  const [list, setList] = useState<Bundle[]>([]);
  const [err, setErr] = useState("");
  const [pages, setPages] = useState(0);
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [manage, setManage] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, c1, c2, t, b] = await Promise.all([loadCategories("booklet_bundle"), loadCategories("booklet_single"), loadCategories("booklet_spread"), loadTemplates(["booklet_single", "booklet_spread"]), loadBundles()]);
      setCats(c); setTplCats([...c1, ...c2]); setTpls(t); setList(b); setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải"); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const byId = useMemo(() => new Map(tpls.map((t) => [t.id, t])), [tpls]);
  const shown = list.filter((b) => (!pages || b.page_count === pages) && (!cat || b.category_id === cat));

  async function save(d: Draft) {
    const v = { name: d.name.trim() || "Bộ mẫu mới", category_id: d.category_id, page_count: d.page_count, template_ids: d.template_ids, is_active: d.is_active, thumbnail_url: byId.get(d.template_ids[0])?.thumbnail_url ?? null };
    const sb = createClient();
    const r = d.id ? await sb.from("booklet_bundles").update(v).eq("id", d.id) : await sb.from("booklet_bundles").insert({ ...v, sort_order: Math.max(0, ...list.map((x) => x.sort_order)) + 1 });
    if (r.error) return toast(isMissing(r.error.message) ? MIGRATE_MSG : r.error.message, "err");
    toast("Đã lưu bộ mẫu"); setEdit(null); await load(); await revalidatePublic(PUBLIC_PATHS);
  }
  async function patch(b: Bundle, v: Partial<Bundle>, text: string) {
    const { error } = await createClient().from("booklet_bundles").update(v).eq("id", b.id);
    if (error) return toast(error.message, "err");
    setList((l) => l.map((x) => (x.id === b.id ? { ...x, ...v } : x))); toast(text); await revalidatePublic(PUBLIC_PATHS);
  }
  async function remove(b: Bundle) {
    if (!(await confirmDialog({ title: `Xoá bộ mẫu “${b.name}”?`, message: "Các mẫu trang bên trong vẫn giữ nguyên.", confirmText: "Xoá", danger: true }))) return;
    const { error } = await createClient().from("booklet_bundles").delete().eq("id", b.id);
    if (error) return toast(error.message, "err");
    setList((l) => l.filter((x) => x.id !== b.id)); toast("Đã xoá"); await revalidatePublic(PUBLIC_PATHS);
  }
  async function drop(t: Bundle) {
    const from = list.find((x) => x.id === drag); setDrag(null);
    if (!from || from.id === t.id) return;
    const a = list.filter((x) => x.id !== from.id); a.splice(a.findIndex((x) => x.id === t.id) + (from.sort_order < t.sort_order ? 1 : 0), 0, from);
    const next = a.map((x, i) => ({ ...x, sort_order: i + 1 }));
    setList(next);
    const sb = createClient();
    await Promise.all(next.map((x) => sb.from("booklet_bundles").update({ sort_order: x.sort_order }).eq("id", x.id)));
    await revalidatePublic(PUBLIC_PATHS);
  }
  const icon = "grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setPages(0)} className={chip(!pages)}>Mọi số trang</button>
          {BUNDLE_PAGES.map((n) => <button key={n} type="button" onClick={() => setPages(n)} className={chip(pages === n)}>{n} trang</button>)}
        </div>
        <span className="flex-1" />
        <Button variant="secondary" icon={<Folder size={16} />} onClick={() => setManage(true)}>Danh mục</Button>
        <Button icon={<Plus size={16} />} onClick={() => setEdit({ name: "", category_id: cats[0]?.id ?? null, page_count: 8, template_ids: [], is_active: true })}>Tạo bộ mẫu</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setCat("")} className={chip(!cat)}>Tất cả danh mục</button>
        {cats.map((c) => <button key={c.id} type="button" onClick={() => setCat(c.id)} className={chip(cat === c.id)}>{c.name}</button>)}
      </div>
      {err && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{err}</p>}
      {!err && !shown.length && <p className="rounded-[12px] border border-dashed border-[#d4d4d8] bg-white p-8 text-center text-[14px] text-[#71717a]">Chưa có bộ mẫu. Tạo mẫu Trang đơn / Trang đôi trước, rồi bấm “Tạo bộ mẫu” để ghép.</p>}
      {groupByCategory(shown, cats).map((g) => (
        <section key={g.cat?.id ?? "o"}>
          <h3 className="mb-2 text-[14px] font-semibold">{g.cat?.name ?? "Chưa có danh mục"}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {g.items.map((b) => {
              const thumb = b.thumbnail_url ?? byId.get(b.template_ids[0])?.thumbnail_url;
              return (
                <li key={b.id} draggable onDragStart={() => setDrag(b.id)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(b)}
                  className={cx("overflow-hidden rounded-[12px] border bg-white", drag === b.id ? "border-[#ff5fa2] opacity-50" : "border-[#e5e5e7]")}>
                  <button type="button" onClick={() => setEdit({ ...b })} className="relative grid aspect-square w-full place-items-center bg-[#f4f4f5] p-2">
                    <GripVertical size={15} className="absolute left-1 top-1 text-[#a1a1aa]" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {thumb ? <img src={thumb} alt="" className={cx("max-h-full max-w-full", !b.is_active && "opacity-40")} /> : <BookOpen className="text-[#d4d4d8]" />}
                  </button>
                  <div className="border-t border-[#efeff1] p-2.5">
                    <p className="truncate text-[13px] font-medium">{b.name}</p>
                    <div className="mt-1 flex gap-1"><Badge>{b.page_count} trang</Badge>{b.is_active ? <Badge tone="green">Bật</Badge> : <Badge>Tắt</Badge>}</div>
                    <div className="mt-1.5 flex justify-end gap-0.5">
                      <button type="button" className={icon} title="Sửa" onClick={() => setEdit({ ...b })}><Pencil size={14} /></button>
                      <button type="button" className={icon} title="Nhân bản" onClick={() => save({ ...b, id: undefined, name: `${b.name} (bản sao)` })}><Copy size={14} /></button>
                      <button type="button" className={icon} title={b.is_active ? "Tắt" : "Bật"} onClick={() => patch(b, { is_active: !b.is_active }, b.is_active ? "Đã tắt" : "Đã bật")}>{b.is_active ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      <button type="button" className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]" title="Xoá" onClick={() => remove(b)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {manage && <CategoryManager scope="booklet_bundle" cats={cats} counts={Object.fromEntries(cats.map((c) => [c.id, list.filter((x) => x.category_id === c.id).length]))} onChange={setCats} onClose={() => setManage(false)} />}
      {edit && <Builder draft={edit} cats={cats} tplCats={tplCats} tpls={tpls} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function Builder({ draft, cats, tplCats, tpls, onClose, onSave }: { draft: Draft; cats: Category[]; tplCats: Category[]; tpls: DesignTpl[]; onClose: () => void; onSave: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState<Draft>(draft);
  const [pick, setPick] = useState<number | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const slots = bundleSlots(d.page_count);
  const byId = new Map(tpls.map((t) => [t.id, t]));
  const setPages = (n: number) => setD({ ...d, page_count: n, template_ids: bundleSlots(n).map((s, k) => (bundleSlots(d.page_count)[k]?.kind === s.kind ? d.template_ids[k] : "") ?? "") });
  const missing = slots.some((_, k) => !d.template_ids[k]);
  const thumb = (k: number) => byId.get(d.template_ids[k])?.thumbnail_url ?? null;
  return (
    <Modal onClose={onClose} wide>
      <div className="space-y-4 p-5">
        <h2 className="text-[17px] font-semibold">{d.id ? "Sửa bộ mẫu" : "Tạo bộ mẫu"}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Tên bộ mẫu" className="h-10 rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
          <select value={d.category_id ?? ""} onChange={(e) => setD({ ...d, category_id: e.target.value || null })} className="h-10 rounded-[8px] border border-[#e5e5e7] bg-white px-2 text-[14px]">
            <option value="">— Chưa có danh mục —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5"><span className="text-[13px] font-medium">Số trang:</span>{BUNDLE_PAGES.map((n) => <button key={n} type="button" onClick={() => setPages(n)} className={chip(d.page_count === n)}>{n} trang</button>)}</div>
        <div className="flex flex-wrap gap-3">
          {slots.map((s, k) => (
            <button key={k} type="button" onClick={() => setPick(k)} className="text-center">
              <span className={cx("grid place-items-center overflow-hidden rounded-[8px] border-[1.5px] bg-[#f4f4f5]", s.kind === "booklet_spread" ? "h-24 w-48" : "h-24 w-24", d.template_ids[k] ? "border-[#e5e5e7]" : "border-dashed border-[#d4d4d8]")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumb(k) ? <img src={thumb(k)!} alt="" className="h-full w-full object-contain" /> : d.template_ids[k] ? <span className="px-1 text-[11px]">{byId.get(d.template_ids[k])?.name}</span> : <Plus size={18} className="text-[#a1a1aa]" />}
              </span>
              <span className="mt-1 block text-[12px] font-medium">{s.label} <span className="font-normal text-[#a1a1aa]">({s.kind === "booklet_spread" ? "đôi" : "đơn"})</span></span>
              <span className="block max-w-[190px] truncate text-[11px] text-[#71717a]">{byId.get(d.template_ids[k])?.name ?? "Chọn mẫu"}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" icon={<BookOpen size={15} />} onClick={() => setView(0)}>Xem trước cả bộ</Button>
          <span className="flex-1 text-[12px] text-[#71717a]">{missing ? "Còn ô chưa chọn mẫu — trang đó sẽ trống." : "Thumbnail của bộ = Trang 1."}</span>
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button loading={busy} onClick={async () => { setBusy(true); await onSave(d); setBusy(false); }}>Lưu bộ mẫu</Button>
        </div>
      </div>
      {pick !== null && <TplPicker kind={slots[pick].kind} tpls={tpls} cats={tplCats} current={d.template_ids[pick]} onClose={() => setPick(null)}
        onPick={(id) => { const ids = [...d.template_ids]; ids[pick] = id; setD({ ...d, template_ids: ids }); setPick(null); }} />}
      {view !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal onClick={() => setView(null)}>
          <div className="flex w-full max-w-[900px] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex aspect-[2/1] w-full items-center justify-center bg-[#27272a]">
              {/* trình xem sách: trang đơn đứng 1 bên gáy, trang đôi mở cả cặp */}
              {slots[view].kind === "booklet_spread"
                // eslint-disable-next-line @next/next/no-img-element
                ? (thumb(view) ? <img src={thumb(view)!} alt="" className="h-full w-full object-contain shadow-2xl" /> : <span className="text-white/60">Chưa chọn mẫu</span>)
                : <div className={cx("flex h-full w-1/2", slots[view].gutter === "right" ? "mr-[50%]" : "ml-[50%]")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {thumb(view) ? <img src={thumb(view)!} alt="" className="h-full w-full object-contain shadow-2xl" /> : <span className="m-auto text-white/60">Chưa chọn mẫu</span>}
                  </div>}
            </div>
            <div className="flex items-center gap-3 text-white">
              <button type="button" onClick={() => setView(Math.max(0, view - 1))} disabled={view === 0} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 disabled:opacity-30" aria-label="Trang trước"><ChevronLeft size={18} /></button>
              <span className="min-w-[120px] text-center text-[14px]">{slots[view].label}</span>
              <button type="button" onClick={() => setView(Math.min(slots.length - 1, view + 1))} disabled={view >= slots.length - 1} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 disabled:opacity-30" aria-label="Trang sau"><ChevronRight size={18} /></button>
            </div>
            <p className="text-[12px] text-white/70">Bấm ra ngoài để đóng</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TplPicker({ kind, tpls, cats, current, onPick, onClose }: { kind: TplKind; tpls: DesignTpl[]; cats: Category[]; current?: string; onPick: (id: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState("");
  const scoped = cats.filter((c) => c.scope === kind);
  const items = tpls.filter((t) => t.kind === kind && (!cat || t.category_id === cat));
  const spread = kind === "booklet_spread";
  return (
    <Modal onClose={onClose} wide>
      <div className="space-y-3 p-5">
        <h2 className="text-[16px] font-semibold">Chọn mẫu {spread ? "Trang đôi" : "Trang đơn"}</h2>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCat("")} className={chip(!cat)}>Tất cả</button>
          {scoped.map((c) => <button key={c.id} type="button" onClick={() => setCat(c.id)} className={chip(cat === c.id)}>{c.name}</button>)}
        </div>
        {!items.length && <p className="text-[13px] text-[#71717a]">Chưa có mẫu {spread ? "Trang đôi" : "Trang đơn"} — tạo ở tab tương ứng.</p>}
        <div className={cx("grid gap-2", spread ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-5")}>
          {items.map((t) => (
            <button key={t.id} type="button" onClick={() => onPick(t.id)} className={cx("rounded-[10px] border p-1 text-left", current === t.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/25" : "border-[#e5e5e7] hover:border-[#ff5fa2]")}>
              <span className={cx("grid place-items-center overflow-hidden rounded-[6px] bg-[#f4f4f5]", spread ? "aspect-[2/1]" : "aspect-square")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.thumbnail_url ? <img src={t.thumbnail_url} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] text-[#a1a1aa]">{t.name}</span>}
              </span>
              <span className="mt-1 block truncate text-[11px] font-medium">{t.name}</span>
              <span className="block text-[10px] text-[#a1a1aa]">{t.photo_count} ảnh{t.is_active ? "" : " · đang tắt"}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
