"use client";

/* Admin → Quản lý chất liệu → "Sticker & trang trí". Thêm chất liệu: "Tách từ tờ sticker" (mặc định) · "Thêm từng món".
   Mỗi chất liệu có LOẠI (cố định: Sticker, Băng dính, Doodle, Mảnh giấy, Texture — hệ thống rải sticker / băng dính dùng Loại),
   NHÓM chủ đề (admin tự đặt, bảng asset_groups; để trống = tên Loại), TAGS, tên tự động (Nhóm + " - " tag đầu + số thứ tự).
   Danh sách: lọc theo Nhóm / Loại / tìm tên + tag, lưới dày (tải dần, ảnh thu nhỏ), chọn nhiều để đổi Nhóm / Tag / Loại,
   "Đặt lại tên theo Nhóm và Tag" (xem trước), "Xoá nền lại" (Nền trơn, xem trước, lưu PNG trong suốt), quản lý nhóm. */
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Folder, GripVertical, Pencil, Plus, Search, Trash2, Upload, Wand2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteFiles, uploadFile } from "@/lib/storage/client";
import { loadImg } from "@/lib/mockup/images";
import { uploadScrapbookAsset } from "@/lib/upload";
import { revalidatePublic } from "@/app/admin/actions";
import { flatAlpha } from "@/lib/scrapbook/userSticker";
import { ASSET_TYPES, autoNames, fold, groupCounts, namePrefix, normAsset, tagCounts, typeName } from "@/lib/scrapbook/assetGroups";
import { GROUP_MIGRATE, ensureGroup, loadGroups, typeGroup, uploadAssetThumb } from "@/lib/scrapbook/assetGroupsClient";
import { TONES, type AssetGroup, type AssetGroupRow, type Rect01, type ScrapAsset } from "@/lib/scrapbook/types";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import { Button, Card, Field, Input, Message, Select, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { DENSE, SheetSlicer } from "./SheetSlicer";
import { GroupCombo, TagInput } from "./AssetFields";

type Msg = { type: "ok" | "err"; text: string } | null;
const PATHS = ["/thiet-ke/cd-template", "/thiet-ke/booklet"];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
const PAGE = 120;
/** file không có kênh trong suốt (JPG) */
export const noAlpha = (url: string) => /\.(jpe?g)(\?|$)/i.test(url);

export function ScrapbookAdmin() {
  const [list, setList] = useState<ScrapAsset[]>([]);
  const [groups, setGroups] = useState<AssetGroupRow[]>([]);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [mode, setMode] = useState<"sheet" | "one">("sheet");
  const [form, setForm] = useState({ name: "", grp: "sticker" as AssetGroup, group: null as string | null, tags: [] as string[], tone: "any", url: "" });
  const [busy, setBusy] = useState(false);
  const [regionOf, setRegionOf] = useState<ScrapAsset | null>(null);
  const [editOf, setEditOf] = useState<ScrapAsset | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [lastSel, setLastSel] = useState<string | null>(null);
  const [gf, setGf] = useState(""); const [tf, setTf] = useState(""); const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [bulk, setBulk] = useState({ group: null as string | null, tags: [] as string[], type: "sticker" as AssetGroup });
  const [renameOpen, setRenameOpen] = useState(false);
  const [rebg, setRebg] = useState<ScrapAsset[] | null>(null);
  const [manage, setManage] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const more = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb.from("scrapbook_assets").select("*").order("sort_order").order("created_at");
    if (error) setMsg({ type: "err", text: "Chưa có bảng chất liệu — cần chạy supabase/migration_scrapbook.sql." });
    setList(((data ?? []) as ScrapAsset[]).map(normAsset));
    try { setGroups(await loadGroups()); } catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : GROUP_MIGRATE }); }
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PATHS); await load(); };
  const gc = useMemo(() => groupCounts(groups, list), [groups, list]);
  const tags = useMemo(() => tagCounts(list), [list]);
  const gname = (id?: string | null) => groups.find((g) => g.id === id)?.name;
  const createGroup = useCallback(async (name: string) => {
    try { const g = await ensureGroup(name, groups); setGroups((c) => (c.some((x) => x.id === g.id) ? c : [...c, g])); return g; }
    catch (e) { toast(e instanceof Error ? e.message : "Không tạo được nhóm", "err"); return null; }
  }, [groups]);

  // ---------- thêm từng món ----------
  const autoName = (grp: string, group: string | null, tg: string[]) => autoNames([{ prefix: namePrefix(gname(group) ?? typeName(grp), tg) }], list.map((a) => a.name))[0];
  async function add(url: string, thumb: string | null = null) {
    if (!/^https?:\/\//i.test(url)) return setMsg({ type: "err", text: "Link ảnh phải bắt đầu bằng https://" });
    try {
      const group = form.group ?? (await typeGroup(form.grp, groups)).id;
      const name = form.name.trim() || autoName(form.grp, form.group, form.tags);
      const { error } = await createClient().from("scrapbook_assets").insert({ name, grp: form.grp, asset_type: form.grp, group_id: group, tags: form.tags, tone: form.tone, url, thumb_url: thumb, sort_order: Math.max(0, ...list.map((a) => a.sort_order)) + 1 });
      if (error) throw new Error(/group_id|asset_type|tags|thumb_url/.test(error.message) ? GROUP_MIGRATE : error.message);
      setForm({ ...form, name: "", url: "" });
      await after(`Đã thêm “${name}”.`);
    } catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Thêm thất bại" }); }
  }
  async function upload(f: File) {
    setBusy(true);
    try {
      if (f.type === "image/jpeg" && form.grp !== "texture") toast("Ảnh JPG không có nền trong suốt — nên dùng PNG / WebP cho sticker, băng dính, mảnh giấy.", "err");
      const url = await uploadScrapbookAsset(f); // giữ nguyên định dạng file gốc (PNG / WebP giữ alpha) — không chuyển sang JPG
      const bmp = await createImageBitmap(f).catch(() => null);
      const thumb = bmp ? await uploadAssetThumb(bmp).catch(() => null) : null;
      bmp?.close();
      await add(url, thumb);
    } catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Tải ảnh thất bại" }); }
    setBusy(false);
  }

  // ---------- sửa / xoá ----------
  async function patch(ids: string[], v: Partial<ScrapAsset>, text = "Đã lưu.") {
    const row: Record<string, unknown> = { ...v };
    if (v.grp) row.asset_type = v.grp;
    const { error } = await createClient().from("scrapbook_assets").update(row).in("id", ids);
    if (error) return setMsg({ type: "err", text: /group_id|asset_type|tags/.test(error.message) ? GROUP_MIGRATE : error.message });
    await after(text);
  }
  async function patchEach(rows: { id: string; v: Partial<ScrapAsset> }[], text: string) {
    const sb = createClient();
    for (const r of rows) { const { error } = await sb.from("scrapbook_assets").update(r.v).eq("id", r.id); if (error) return setMsg({ type: "err", text: error.message }); }
    await after(text);
  }
  async function remove(ids: string[]) {
    if (!ids.length) return;
    if (!await confirmDialog({ title: ids.length === 1 ? `Xoá "${list.find((a) => a.id === ids[0])?.name}"?` : `Xoá ${ids.length} chất liệu đã chọn?`, danger: true, confirmText: "Xoá" })) return;
    const items = list.filter((a) => ids.includes(a.id));
    const { error } = await createClient().from("scrapbook_assets").delete().in("id", ids);
    if (error) return setMsg({ type: "err", text: error.message });
    await deleteFiles({ urls: items.flatMap((a) => [a.url, a.thumb_url]) }).catch(() => 0); // link ngoài tự bỏ qua
    setSel([]);
    await after(ids.length === 1 ? "Đã xoá." : `Đã xoá ${ids.length} chất liệu.`);
  }

  // ---------- lọc + tải dần ----------
  const shown = useMemo(() => {
    const f = fold(q);
    return list.filter((a) => (!gf || a.group_id === gf) && (!tf || a.grp === tf) && (!f || fold(a.name).includes(f) || (a.tags ?? []).some((t) => fold(t).includes(f))));
  }, [list, gf, tf, q]);
  useEffect(() => { setLimit(PAGE); }, [gf, tf, q]);
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setLimit((l) => l + PAGE); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown.length, limit]);
  function toggleSel(a: ScrapAsset, shift: boolean) {
    if (shift && lastSel) {
      const i0 = shown.findIndex((x) => x.id === lastSel), i1 = shown.findIndex((x) => x.id === a.id);
      if (i0 >= 0 && i1 >= 0) { const range = shown.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).map((x) => x.id); setSel((c) => [...new Set([...c, ...range])]); setLastSel(a.id); return; }
    }
    setSel((c) => (c.includes(a.id) ? c.filter((x) => x !== a.id) : [...c, a.id]));
    setLastSel(a.id);
  }
  const selected = list.filter((a) => sel.includes(a.id));
  const jpgCount = list.filter((a) => noAlpha(a.url)).length;
  const chip = (on: boolean) => cx("h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]");
  const picking = sel.length > 0;

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-6">
      <Card title="Thêm chất liệu" actions={
        <ResponsiveTabs size="sm" value={mode} onChange={setMode} tabs={[{ id: "sheet", label: "Tách từ tờ sticker" }, { id: "one", label: "Thêm từng món" }] as const} />}>
        {mode === "sheet" ? <SheetSlicer assets={list} groups={gc} onCreateGroup={createGroup} onDone={async () => { await after("Đã lưu các món đã tách."); }} /> : (
          <>
            <p className="mb-3 text-[13px] text-[#71717a]">Ảnh PNG / WebP nền trong suốt (file giữ nguyên định dạng, không chuyển sang JPG). Tải file lên hoặc dán link ảnh.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_1fr_1fr_140px]">
              <Field label="Loại"><Select value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value as AssetGroup })}>{ASSET_TYPES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
              <Field label="Nhóm"><GroupCombo groups={gc} value={form.group} onChange={(id) => setForm({ ...form, group: id })} onCreate={createGroup} /></Field>
              <Field label="Tags"><TagInput value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} suggest={tags} /></Field>
              <Field label="Tông màu"><Select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>{TONES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Tên" className="min-w-[200px] flex-1"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`Tự đặt: ${autoName(form.grp, form.group, form.tags)}`} /></Field>
              <Field label="Link ảnh" className="min-w-[240px] flex-1"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></Field>
              <Button icon={<Plus size={16} />} onClick={() => add(form.url.trim())}>Thêm từ link</Button>
              <Button variant="secondary" icon={<Upload size={16} />} loading={busy} onClick={() => fileIn.current?.click()}>Tải file lên</Button>
              <input ref={fileIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
            </div>
          </>
        )}
      </Card>

      <Card title={`Chất liệu (${list.length})`} actions={<Button size="sm" variant="secondary" icon={<Folder size={14} />} onClick={() => setManage(true)}>Nhóm</Button>}>
        {/* lọc */}
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, tag" className="h-8 w-[200px] rounded-[8px] border border-[#e5e5e7] pl-7 pr-2 text-[13px] outline-none focus:border-[#ff5fa2]" />
            </label>
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              <button type="button" onClick={() => setTf("")} className={chip(!tf)}>Mọi loại</button>
              {ASSET_TYPES.concat(list.some((a) => a.grp === "frame") ? [{ id: "frame", name: "Khung (cũ)" }] : []).map((t) => <button key={t.id} type="button" onClick={() => setTf(t.id)} className={chip(tf === t.id)}>{t.name} · {list.filter((a) => a.grp === t.id).length}</button>)}
            </div>
            <span className="flex-1" />
            {jpgCount > 0 && <button type="button" onClick={() => setSel(list.filter((a) => noAlpha(a.url)).map((a) => a.id))} className="text-[12px] text-[#b45309] hover:underline" title="File JPG không có nền trong suốt">{jpgCount} file JPG (không trong suốt) — chọn</button>}
          </div>
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            <button type="button" onClick={() => setGf("")} className={chip(!gf)}>Mọi nhóm</button>
            {gc.filter((g) => g.count > 0).map((g) => <button key={g.id} type="button" onClick={() => setGf(g.id)} className={chip(gf === g.id)}>{g.name} · {g.count}</button>)}
          </div>
        </div>
        {/* thao tác hàng loạt */}
        {picking && (
          <div className="sticky top-2 z-20 mb-3 space-y-2 rounded-[12px] border border-[#e5e5e7] bg-white p-2 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-1 text-[13px] font-semibold">Đã chọn {sel.length}</span>
              <button type="button" onClick={() => setSel(shown.map((a) => a.id))} className="text-[12px] text-[#ff5fa2]">Chọn tất cả đang lọc ({shown.length})</button>
              <span className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setRenameOpen(true)}>Đặt lại tên theo Nhóm và Tag</Button>
              <Button size="sm" variant="secondary" icon={<Wand2 size={14} />} onClick={() => setRebg(selected)}>Xoá nền lại</Button>
              <Button size="sm" variant="secondary" onClick={() => patch(sel, { is_active: true }, `Đã bật ${sel.length} chất liệu.`)}>Bật</Button>
              <Button size="sm" variant="secondary" onClick={() => patch(sel, { is_active: false }, `Đã tắt ${sel.length} chất liệu.`)}>Tắt</Button>
              <Button size="sm" variant="secondary" className="!text-[#dc2626]" icon={<Trash2 size={14} />} onClick={() => remove(sel)}>Xoá</Button>
              <button type="button" onClick={() => setSel([])} className="px-2 text-[13px] text-[#71717a] hover:text-[#18181b]">Bỏ chọn</button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="flex items-end gap-1.5"><div className="min-w-0 flex-1"><GroupCombo groups={gc} value={bulk.group} onChange={(id) => setBulk({ ...bulk, group: id })} onCreate={createGroup} placeholder="Nhóm mới cho các món" small /></div>
                <Button size="sm" variant="secondary" disabled={!bulk.group} onClick={() => patch(sel, { group_id: bulk.group }, `Đã đổi nhóm ${sel.length} chất liệu.`)}>Đổi nhóm</Button></div>
              <div className="flex items-end gap-1.5"><div className="min-w-0 flex-1"><TagInput value={bulk.tags} onChange={(v) => setBulk({ ...bulk, tags: v })} suggest={tags} small placeholder="Tag…" /></div>
                <Button size="sm" variant="secondary" disabled={!bulk.tags.length} onClick={() => patchEach(selected.map((a) => ({ id: a.id, v: { tags: [...new Set([...(a.tags ?? []), ...bulk.tags])] } })), "Đã thêm tag.")}>Thêm</Button>
                <Button size="sm" variant="secondary" disabled={!bulk.tags.length} onClick={() => patchEach(selected.map((a) => ({ id: a.id, v: { tags: (a.tags ?? []).filter((t) => !bulk.tags.includes(t)) } })), "Đã xoá tag.")}>Xoá</Button></div>
              <div className="flex items-end gap-1.5"><Select value={bulk.type} onChange={(e) => setBulk({ ...bulk, type: e.target.value as AssetGroup })} className="h-8 min-w-0 flex-1">{ASSET_TYPES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
                <Button size="sm" variant="secondary" onClick={() => patch(sel, { grp: bulk.type }, `Đã đổi loại ${sel.length} chất liệu.`)}>Đổi loại</Button></div>
            </div>
          </div>
        )}
        {shown.length ? (
          <ul className={DENSE}>
            {shown.slice(0, limit).map((a) => {
              const on = sel.includes(a.id);
              const tip = `${a.name}\nNhóm: ${gname(a.group_id) ?? "—"} · Loại: ${typeName(a.grp)}${a.tags?.length ? `\nTags: ${a.tags.join(", ")}` : ""}${a.is_active ? "" : "\n(đang tắt)"}`;
              return (
                <li key={a.id} title={tip} className={cx("group min-w-0", !a.is_active && "opacity-50")}>
                  <div className={cx("relative grid aspect-square place-items-center overflow-hidden rounded-[6px] border p-1", checker, on ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7]")}
                    onClick={(e) => { if (picking) toggleSel(a, e.shiftKey); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumb_url || a.url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" />
                    {noAlpha(a.url) && <span className="absolute bottom-0.5 left-0.5 rounded-[3px] bg-[#b45309] px-1 text-[8px] font-bold text-white" title="JPG — không có nền trong suốt">JPG</span>}
                    <input type="checkbox" checked={on} onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggleSel(a, e.shiftKey); }} aria-label="Chọn"
                      className={cx("absolute left-1 top-1 h-3.5 w-3.5 accent-[#ff5fa2]", !picking && "opacity-0 group-hover:opacity-100")} />
                    <div className={cx("absolute right-0.5 top-0.5 flex gap-0.5", !picking && "opacity-0 group-hover:opacity-100", picking && "hidden")}>
                      <button type="button" onClick={() => setEditOf(a)} aria-label="Sửa" className="grid h-5 w-5 place-items-center rounded-full bg-white shadow"><Pencil size={10} /></button>
                      {a.grp === "frame" && <button type="button" onClick={() => setRegionOf(a)} aria-label="Vùng ảnh" className="grid h-5 w-5 place-items-center rounded-full bg-white text-[#ff5fa2] shadow"><Crop size={10} /></button>}
                      <button type="button" onClick={() => remove([a.id])} aria-label="Xoá" className="grid h-5 w-5 place-items-center rounded-full bg-white text-[#dc2626] shadow"><Trash2 size={10} /></button>
                    </div>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] leading-tight text-[#3f3f46]">{a.name}</p>
                </li>
              );
            })}
          </ul>
        ) : <p className="rounded-[10px] bg-[#fafafa] p-4 text-center text-[13px] text-[#71717a]">{list.length ? "Không có chất liệu phù hợp bộ lọc." : "Chưa có — web dùng bộ mặc định vẽ bằng code."}</p>}
        {limit < shown.length && <div ref={more} className="h-10" />}
      </Card>
      <Message msg={msg} />
      {regionOf && <RegionEditor asset={regionOf} onClose={() => setRegionOf(null)} onSave={async (r) => { await patch([regionOf.id], { region: r }, "Đã lưu vùng ảnh."); setRegionOf(null); }} />}
      {editOf && <EditAsset asset={editOf} groups={gc} tags={tags} onCreateGroup={createGroup} onClose={() => setEditOf(null)} onSave={async (v) => { await patch([editOf.id], v); setEditOf(null); }} />}
      {renameOpen && <RenamePreview items={selected} all={list} groupName={(id, t) => gname(id) ?? typeName(t)} onClose={() => setRenameOpen(false)}
        onConfirm={async (rows) => { await patchEach(rows.map((r) => ({ id: r.id, v: { name: r.name } })), `Đã đổi tên ${rows.length} chất liệu.`); setRenameOpen(false); }} />}
      {rebg && <ReBgModal items={rebg} onClose={() => setRebg(null)} onDone={async (n) => { setRebg(null); await after(`Đã xoá nền lại ${n} chất liệu.`); }} />}
      {manage && <GroupManager groups={gc} onClose={() => setManage(false)} onChanged={load} />}
    </div>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx("relative max-h-[90dvh] w-full overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl", wide ? "max-w-[860px]" : "max-w-[460px]")}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

function EditAsset({ asset, groups, tags, onCreateGroup, onClose, onSave }: {
  asset: ScrapAsset; groups: (AssetGroupRow & { count: number })[]; tags: { tag: string; count: number }[]; onCreateGroup: (n: string) => Promise<AssetGroupRow | null>;
  onClose: () => void; onSave: (v: Partial<ScrapAsset>) => void;
}) {
  const [v, setV] = useState({ name: asset.name, grp: asset.grp, tone: asset.tone, group_id: asset.group_id ?? null, tags: asset.tags ?? [] });
  return (
    <Modal onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[16px] font-semibold">Sửa chất liệu</p>
        <Field label="Tên"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Loại"><Select value={v.grp} onChange={(e) => setV({ ...v, grp: e.target.value as AssetGroup })}>{ASSET_TYPES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}{asset.grp === "frame" && <option value="frame">Khung (cũ)</option>}</Select></Field>
          <Field label="Tông màu"><Select value={v.tone} onChange={(e) => setV({ ...v, tone: e.target.value })}>{TONES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        </div>
        <Field label="Nhóm"><GroupCombo groups={groups} value={v.group_id} onChange={(id) => setV({ ...v, group_id: id })} onCreate={onCreateGroup} /></Field>
        <Field label="Tags"><TagInput value={v.tags} onChange={(t) => setV({ ...v, tags: t })} suggest={tags} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button onClick={() => onSave({ ...v, name: v.name.trim() || asset.name })}>Lưu</Button></div>
      </div>
    </Modal>
  );
}

/** "Đặt lại tên theo Nhóm và Tag": xem trước tên cũ → tên mới, xác nhận thì đổi */
function RenamePreview({ items, all, groupName, onClose, onConfirm }: {
  items: ScrapAsset[]; all: ScrapAsset[]; groupName: (id: string | null | undefined, type: string) => string; onClose: () => void; onConfirm: (rows: { id: string; name: string }[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const ids = new Set(items.map((a) => a.id));
  const rows = useMemo(() => {
    const names = autoNames(items.map((a) => ({ prefix: namePrefix(groupName(a.group_id, a.grp), a.tags) })), all.filter((a) => !ids.has(a.id)).map((a) => a.name));
    return items.map((a, i) => ({ id: a.id, old: a.name, name: names[i] }));
  }, [items, all]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = rows.filter((r) => r.old !== r.name);
  return (
    <Modal onClose={onClose} wide>
      <p className="mb-1 text-[16px] font-semibold">Đặt lại tên theo Nhóm và Tag</p>
      <p className="mb-3 text-[13px] text-[#71717a]">{changed.length} / {rows.length} món sẽ đổi tên (số thứ tự nối tiếp tên đang có của cùng tiền tố).</p>
      <div className="max-h-[55vh] overflow-y-auto rounded-[8px] border border-[#e5e5e7]">
        <table className="w-full text-[13px]"><tbody>
          {rows.map((r) => <tr key={r.id} className="border-b border-[#efeff1] last:border-0"><td className="px-3 py-1.5 text-[#71717a]">{r.old}</td><td className="px-1 text-[#a1a1aa]">→</td><td className={cx("px-3 py-1.5", r.old !== r.name && "font-medium text-[#18181b]")}>{r.name}</td></tr>)}
        </tbody></table>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button loading={busy} disabled={!changed.length} onClick={async () => { setBusy(true); await onConfirm(changed); setBusy(false); }}>Đổi tên {changed.length} món</Button></div>
    </Modal>
  );
}

/** "Xoá nền lại" (Nền trơn) cho chất liệu đã lỡ lưu mất nền trong suốt: xem trước → lưu PNG mới, giữ id / tên / nhóm / tags */
function ReBgModal({ items, onClose, onDone }: { items: ScrapAsset[]; onClose: () => void; onDone: (n: number) => void }) {
  const [tol, setTol] = useState(24);
  const [out, setOut] = useState<Record<string, { canvas: HTMLCanvasElement | null; err?: string }>>({});
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let stop = false;
    const t = setTimeout(async () => {
      const res: Record<string, { canvas: HTMLCanvasElement | null; err?: string }> = {};
      for (const a of items) {
        if (stop) return;
        try {
          const im = await loadImg(a.url);
          const k = Math.min(1, 2048 / Math.max(im.naturalWidth, im.naturalHeight));
          const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const x = c.getContext("2d", { willReadFrequently: true })!; x.drawImage(im, 0, 0, w, h);
          const img = { w, h, data: x.getImageData(0, 0, w, h).data };
          const r = await flatAlpha(img, tol, true);
          if (!r.found) { res[a.id] = { canvas: null, err: "Không tách được nền" }; continue; }
          const d = new ImageData(new Uint8ClampedArray(r.color), w, h);
          for (let i = 0; i < w * h; i++) d.data[i * 4 + 3] = r.alpha[i];
          // cắt sát phần có màu
          let x0 = w, y0 = h, x1 = -1, y1 = -1;
          for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (r.alpha[y * w + xx] > 10) { if (xx < x0) x0 = xx; if (y < y0) y0 = y; if (xx > x1) x1 = xx; if (y > y1) y1 = y; }
          const full = document.createElement("canvas"); full.width = w; full.height = h; full.getContext("2d")!.putImageData(d, 0, 0);
          const cut = document.createElement("canvas"); cut.width = Math.max(1, x1 - x0 + 1); cut.height = Math.max(1, y1 - y0 + 1);
          cut.getContext("2d")!.drawImage(full, -x0, -y0);
          res[a.id] = { canvas: cut };
        } catch { res[a.id] = { canvas: null, err: "Không đọc được ảnh" }; }
        if (!stop) setOut({ ...res });
      }
    }, 250);
    return () => { stop = true; clearTimeout(t); };
  }, [items, tol]);
  async function save() {
    let n = 0;
    const sb = createClient();
    for (const [i, a] of items.entries()) {
      const c = out[a.id]?.canvas;
      if (!c) continue;
      setBusy(`${i + 1}/${items.length}`);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) continue;
      try {
        const up = await uploadFile("scrapbook", blob, { folder: a.grp, contentType: "image/png" });
        const thumb = await uploadAssetThumb(c).catch(() => null);
        const { error } = await sb.from("scrapbook_assets").update({ url: up.url, thumb_url: thumb }).eq("id", a.id);
        if (error) throw new Error(error.message);
        await deleteFiles({ urls: [a.url, a.thumb_url] }).catch(() => 0);
        n++;
      } catch (e) { toast(`${a.name}: ${e instanceof Error ? e.message : "lưu thất bại"}`, "err"); }
    }
    setBusy("");
    onDone(n);
  }
  return (
    <Modal onClose={onClose} wide>
      <p className="mb-1 text-[16px] font-semibold">Xoá nền lại · {items.length} món</p>
      <p className="mb-3 text-[13px] text-[#71717a]">Chạy “Nền trơn” trên trình duyệt (dò màu nền đều quanh viền) rồi lưu PNG trong suốt. Giữ nguyên tên, nhóm, tags.</p>
      <label className="mb-3 flex items-center gap-2 text-[12px]">Độ nhạy nền <input type="range" min={6} max={80} value={tol} onChange={(e) => setTol(Number(e.target.value))} className="w-40 accent-[#ff5fa2]" /> {tol}</label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {items.map((a) => (
          <div key={a.id} className="min-w-0">
            <div className="grid grid-cols-2 gap-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className={cx("grid aspect-square place-items-center overflow-hidden rounded-[4px] border border-[#e5e5e7] p-0.5", checker)}><img src={a.thumb_url || a.url} alt="Trước" className="max-h-full max-w-full object-contain" /></span>
              <span className={cx("grid aspect-square place-items-center overflow-hidden rounded-[4px] border border-[#e5e5e7] p-0.5", checker)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {out[a.id]?.canvas ? <img src={out[a.id]!.canvas!.toDataURL("image/png")} alt="Sau" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] text-[#a1a1aa]">{out[a.id]?.err ?? "…"}</span>}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px]" title={a.name}>{a.name}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button loading={!!busy} onClick={save}>{busy ? `Đang lưu ${busy}` : "Lưu PNG trong suốt"}</Button></div>
    </Modal>
  );
}

/** Quản lý nhóm: đổi tên, gộp 2 nhóm, xoá nhóm rỗng, kéo thả thứ tự (thứ tự chip phía khách) */
function GroupManager({ groups, onClose, onChanged }: { groups: (AssetGroupRow & { count: number })[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [list, setList] = useState(() => groups.slice().sort((a, b) => a.sort_order - b.sort_order || b.count - a.count));
  const [drag, setDrag] = useState<string | null>(null);
  const [merge, setMerge] = useState<{ from: string; to: string } | null>(null);
  const sb = () => createClient();
  useEffect(() => { setList(groups.slice().sort((a, b) => a.sort_order - b.sort_order || b.count - a.count)); }, [groups]);
  async function rename(g: AssetGroupRow) {
    const v = await promptDialog({ title: "Đổi tên nhóm", label: "Tên nhóm", defaultValue: g.name });
    if (!v?.trim() || v.trim() === g.name) return;
    const { error } = await sb().from("asset_groups").update({ name: v.trim() }).eq("id", g.id);
    if (error) return toast(error.message, "err");
    await onChanged();
  }
  async function remove(g: AssetGroupRow & { count: number }) {
    if (g.count) return toast(`Nhóm “${g.name}” còn ${g.count} chất liệu — gộp vào nhóm khác trước.`, "err");
    const { error } = await sb().from("asset_groups").delete().eq("id", g.id);
    if (error) return toast(error.message, "err");
    await onChanged();
  }
  async function doMerge() {
    if (!merge || merge.from === merge.to) return;
    const a = list.find((g) => g.id === merge.from), b = list.find((g) => g.id === merge.to);
    if (!a || !b || !(await confirmDialog({ title: `Gộp “${a.name}” vào “${b.name}”?`, message: `${a.count} chất liệu chuyển sang “${b.name}”, nhóm “${a.name}” bị xoá.`, confirmText: "Gộp" }))) return;
    const u = await sb().from("scrapbook_assets").update({ group_id: b.id }).eq("group_id", a.id);
    if (u.error) return toast(u.error.message, "err");
    await sb().from("asset_groups").delete().eq("id", a.id);
    setMerge(null); toast("Đã gộp nhóm"); await onChanged();
  }
  async function drop(t: AssetGroupRow & { count: number }) {
    const from = list.find((x) => x.id === drag); setDrag(null);
    if (!from || from.id === t.id) return;
    const a = list.filter((x) => x.id !== from.id); a.splice(a.findIndex((x) => x.id === t.id) + (list.indexOf(from) < list.indexOf(t) ? 1 : 0), 0, from);
    const next = a.map((x, i) => ({ ...x, sort_order: i + 1 }));
    setList(next);
    await Promise.all(next.map((x) => sb().from("asset_groups").update({ sort_order: x.sort_order }).eq("id", x.id)));
    await onChanged();
  }
  return (
    <Modal onClose={onClose}>
      <p className="mb-1 text-[16px] font-semibold">Nhóm chất liệu</p>
      <p className="mb-3 text-[12px] text-[#71717a]">Kéo thả để đổi thứ tự chip Nhóm phía khách.</p>
      <ul className="space-y-1">
        {list.map((g) => (
          <li key={g.id} draggable onDragStart={() => setDrag(g.id)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(g)}
            className={cx("flex items-center gap-2 rounded-[8px] border px-2 py-1.5", drag === g.id ? "border-[#ff5fa2] opacity-50" : "border-[#e5e5e7]")}>
            <GripVertical size={14} className="cursor-grab text-[#a1a1aa]" />
            <span className="min-w-0 flex-1 truncate text-[14px]">{g.name} <span className="text-[12px] text-[#a1a1aa]">· {g.count}</span></span>
            <button type="button" onClick={() => setMerge({ from: g.id, to: list.find((x) => x.id !== g.id)?.id ?? "" })} className="rounded-[6px] px-2 py-1 text-[12px] text-[#52525b] hover:bg-[#f4f4f5]">Gộp</button>
            <button type="button" onClick={() => rename(g)} title="Đổi tên" className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]"><Pencil size={13} /></button>
            <button type="button" onClick={() => remove(g)} title={g.count ? "Chỉ xoá được nhóm rỗng" : "Xoá"} className={cx("grid h-7 w-7 place-items-center rounded-[6px]", g.count ? "text-[#d4d4d8]" : "text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]")}><Trash2 size={13} /></button>
          </li>
        ))}
        {!list.length && <li className="text-[13px] text-[#71717a]">Chưa có nhóm.</li>}
      </ul>
      {merge && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[8px] bg-[#fafafa] p-2 text-[13px]">
          Gộp <b>{list.find((g) => g.id === merge.from)?.name}</b> vào
          <Select value={merge.to} onChange={(e) => setMerge({ ...merge, to: e.target.value })} className="h-8 w-48">{list.filter((g) => g.id !== merge.from).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
          <Button size="sm" onClick={doMerge} disabled={!merge.to}>Gộp</Button>
          <button type="button" onClick={() => setMerge(null)} className="text-[12px] text-[#71717a]">Huỷ</button>
        </div>
      )}
    </Modal>
  );
}

// ---------- vùng đặt ảnh của khung: kéo 4 góc hoặc tự dò vùng trong suốt ----------
function RegionEditor({ asset, onClose, onSave }: { asset: ScrapAsset; onClose: () => void; onSave: (r: Rect01) => void }) {
  const [r, setR] = useState<Rect01>(asset.region ?? { x0: 0.15, y0: 0.15, x1: 0.85, y1: 0.85 });
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const corners: [keyof Rect01, keyof Rect01][] = [["x0", "y0"], ["x1", "y0"], ["x1", "y1"], ["x0", "y1"]];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  function onMove(e: React.PointerEvent) {
    if (drag.current === null || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const [kx, ky] = corners[drag.current];
    setR((cur) => ({ ...cur, [kx]: clamp((e.clientX - b.left) / b.width), [ky]: clamp((e.clientY - b.top) / b.height) }));
  }
  async function detect() {
    setErr("");
    try {
      const img = await loadImg(asset.url);
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext("2d")!; x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
      const A = (px: number, py: number) => d[(py * W + px) * 4 + 3];
      const cx = Math.round(W / 2), cy = Math.round(H / 2);
      if (A(cx, cy) > 20) return setErr("Giữa khung không trong suốt — hãy kéo 4 góc bằng tay.");
      let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
      while (x0 > 0 && A(x0 - 1, cy) <= 20) x0--; while (x1 < W - 1 && A(x1 + 1, cy) <= 20) x1++;
      while (y0 > 0 && A(cx, y0 - 1) <= 20) y0--; while (y1 < H - 1 && A(cx, y1 + 1) <= 20) y1++;
      setR({ x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H });
    } catch { setErr("Không đọc được kênh trong suốt của ảnh (link bị chặn). Hãy kéo 4 góc bằng tay."); }
  }
  const box01 = { x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-semibold">Vùng đặt ảnh · {asset.name}</p>
        <p className="mb-3 text-[13px] text-[#71717a]">Kéo 4 góc hồng cho khớp ô trống của khung, hoặc bấm “Tự dò”.</p>
        <div ref={box} className={cx("relative mx-auto w-full max-w-[420px] touch-none select-none", checker)} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt="" className="block w-full" draggable={false} />
          <span className="pointer-events-none absolute border-2 border-[#ff5fa2] bg-[#ff5fa2]/10"
            style={{ left: `${box01.x0 * 100}%`, top: `${box01.y0 * 100}%`, width: `${(box01.x1 - box01.x0) * 100}%`, height: `${(box01.y1 - box01.y0) * 100}%` }} />
          {corners.map(([kx, ky], i) => (
            <span key={i} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = i; }}
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white bg-[#ff5fa2] shadow"
              style={{ left: `${r[kx] * 100}%`, top: `${r[ky] * 100}%` }} />
          ))}
        </div>
        {err && <p className="mt-2 text-[12px] text-[#dc2626]">{err}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon={<Wand2 size={16} />} onClick={detect}>Tự dò</Button>
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={() => onSave(box01)}>Lưu vùng ảnh</Button>
        </div>
      </div>
    </div>
  );
}
