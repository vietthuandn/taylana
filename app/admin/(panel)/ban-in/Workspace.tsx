"use client";
/* Bàn in → 1 phiên: lưới thẻ đơn (2–3 cột). Mỗi thẻ: username, mã đơn, Gói, món lẻ (thêm / bớt), số lượng, trạng thái
   ảnh; các ô ảnh đúng theo gói + món, hình dạng thật, cảnh báo độ phân giải thấp / sai tỉ lệ. Kéo thả 1 file vào 1 ô · nhiều file
   lên thẻ (xếp theo tên file) · thư mục lớn / .zip lên đầu trang (thư mục con ≈ username / mã đơn) · kéo ảnh giữa các ô để đổi chỗ.
   Ảnh chỉ lưu trên máy (IndexedDB). Lọc: Tất cả / Thiếu ảnh / Đủ ảnh / Đã in / Chưa xác định · tìm username · chọn đơn để in. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Box, Check, FileText, FolderInput, Plus, RotateCw, Search, Settings, Trash2, Upload, X } from "lucide-react";
import { mmToPx } from "@/lib/print";
import { deleteItem, deleteOrder, getBatch, insertOrders, insertRule, listAddons, listItems, listOrders, listRules, patchOrder, upsertItem } from "@/lib/printShop/db";
import { delFile, fileKey, getFile, putFile } from "@/lib/printShop/files";
import { IMG_RE, dims, foldersFromDrop, similar, thumbUrl, type Folder } from "@/lib/printShop/img";
import { MockupModal } from "./MockupModal";
import { assign } from "@/lib/printShop/match";
import { resolve } from "@/lib/printShop/rules";
import { noMusic, packsOf, slotsOf, type Addon, type Batch, type Item, type Order, type Pack, type Rule, type Slot } from "@/lib/printShop/types";
import { confirmDialog } from "@/components/ui/dialog";
import { Badge, Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { ImportModal, type NewOrder } from "./ImportModal";
import { SettingsModal } from "./SettingsModal";
import { PrintBar } from "./PrintBar";
import { pickingListPdf } from "@/lib/printShop/picking";
import { openPdf } from "@/lib/printShop/pdf";

type Filter = "all" | "missing" | "full" | "printed" | "unresolved";
const DRAG = "text/ban-in-slot";
export const BLEED_MM = 2;

export function Workspace({ batchId, packs }: { batchId: string; packs: Pack[] }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [err, setErr] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [viewer, setViewer] = useState<{ order: Order; slot: Slot } | null>(null);
  const [unmatched, setUnmatched] = useState<{ orderId: string; files: File[] }[]>([]);
  const [folderMap, setFolderMap] = useState<{ folders: Folder[]; to: Record<string, string> } | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [mock, setMock] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, o, r, a] = await Promise.all([getBatch(batchId), listOrders(batchId), listRules(), listAddons()]);
      setBatch(b); setOrders(o); setRules(r); setAddons(a);
      setItems(await listItems(o.map((x) => x.id)));
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải"); }
  }, [batchId]);
  useEffect(() => { load(); }, [load]);

  // ảnh thu nhỏ từ IndexedDB
  useEffect(() => {
    let stop = false;
    (async () => {
      for (const it of items) {
        const k = fileKey(batchId, it.order_id, it.slot);
        const f = await getFile(k).catch(() => undefined);
        if (stop) return;
        if (!f) { setThumbs((m) => (m[k] === "" ? m : { ...m, [k]: "" })); continue; }
        const u = await thumbUrl(k, f.blob, f.at);
        if (!stop) setThumbs((m) => (m[k] === u ? m : { ...m, [k]: u }));
      }
    })();
    return () => { stop = true; };
  }, [items, batchId]);

  const packOf = useCallback((o: Order) => packs.find((p) => p.id === packsOf(o)[0]?.id) ?? null, [packs]);
  const slotsFor = useCallback((o: Order) => slotsOf(o, packs, addons), [packs, addons]);
  const itemOf = (o: Order, s: string) => items.find((i) => i.order_id === o.id && i.slot === s);
  /** ô có ảnh thật sự trên máy này (dữ liệu có nhưng IndexedDB bị xoá → coi như thiếu) */
  const has = (o: Order, s: string) => !!itemOf(o, s) && thumbs[fileKey(batchId, o.id, s)] !== "";
  const stat = useCallback((o: Order) => { const ss = slotsFor(o).filter((s) => !s.optional); const n = ss.filter((s) => has(o, s.key)).length; return { total: ss.length, n, full: slotsFor(o).length > 0 && n === ss.length }; }, [slotsFor, items, thumbs]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => orders.filter((o) => {
    const s = stat(o);
    if (q.trim() && !o.username.toLowerCase().includes(q.trim().toLowerCase()) && !o.order_code.includes(q.trim())) return false;
    return filter === "all" || (filter === "missing" && !s.full && !o.unresolved) || (filter === "full" && s.full) || (filter === "printed" && o.status === "printed") || (filter === "unresolved" && (o.unresolved || !s.total));
  }), [orders, filter, q, stat]);

  // ---------- thêm đơn ----------
  async function addOrders(list: NewOrder[]) {
    let seq = Math.max(0, ...orders.map((o) => o.seq));
    const rows = list.map(({ row, manual }) => {
      const r = manual ? { ...manual, packs: manual.package_id ? [{ id: manual.package_id, qty: manual.qty }] : [], qty: 1, unresolved: !manual.package_id && !manual.addons.length } : resolve(row.lines, rules, packs, addons);
      return {
        batch_id: batchId, seq: ++seq, order_code: row.order_code, username: row.username, lines: row.lines,
        product: row.lines.map((l) => l.product).filter(Boolean).join(" | "), variation: row.lines.map((l) => noMusic(l.variation)).filter(Boolean).join(" | "),
        qty: 1, package_id: r.packs[0]?.id ?? null, packs: r.packs, addons: r.addons, music: false, unresolved: r.unresolved,
      };
    });
    try { const ins = await insertOrders(rows); setOrders((c) => [...c, ...ins]); setImporting(false); toast(`Đã thêm ${ins.length} đơn${ins.some((x) => x.unresolved) ? ` · ${ins.filter((x) => x.unresolved).length} chưa xác định` : ""}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Thêm đơn thất bại", "err"); }
  }
  async function setOrder(o: Order, v: Partial<Order>, remember?: { result: "package" | "addon"; id: string }) {
    setOrders((c) => c.map((x) => (x.id === o.id ? { ...x, ...v } : x)));
    try { await patchOrder(o.id, v); } catch (e) { toast(e instanceof Error ? e.message : "Lỗi", "err"); return; }
    // sửa tay đơn "Chưa xác định" → hỏi nhớ quy tắc
    const pattern = (o.lines?.find((l) => l.variation)?.variation || o.variation.split(" | ")[0] || "").trim();
    if (remember && o.unresolved && pattern && await confirmDialog({ title: "Nhớ quy tắc này cho lần sau?", message: `Phân loại có cụm “${pattern}” → ${remember.result === "package" ? `gói ${packs.find((p) => p.id === remember.id)?.name}` : `món ${addons.find((a) => a.id === remember.id)?.name}`}.`, confirmText: "Nhớ quy tắc", cancelText: "Không" })) {
      try { const r = await insertRule({ pattern, result: remember.result, package_id: remember.result === "package" ? remember.id : null, addon_id: remember.result === "addon" ? remember.id : null, sort_order: rules.length + 1 }); setRules((c) => [...c, r]); toast("Đã lưu quy tắc"); } catch (e) { toast(e instanceof Error ? e.message : "Lỗi", "err"); }
    }
  }

  // ---------- ảnh ----------
  async function saveFile(o: Order, slot: string, f: File | Blob, name: string) {
    const k = fileKey(batchId, o.id, slot), at = Date.now();
    await putFile({ key: k, batch: batchId, blob: f, name, at });
    const d = await dims(f);
    const it = await upsertItem({ order_id: o.id, slot, file_name: name, w: d.w, h: d.h, rot: 0 });
    setItems((c) => [...c.filter((x) => !(x.order_id === o.id && x.slot === slot)), it]);
    setThumbs((m) => { const n = { ...m }; delete n[k]; return n; });
  }
  async function removeFile(o: Order, slot: string) {
    await delFile(fileKey(batchId, o.id, slot)).catch(() => undefined);
    await deleteItem(o.id, slot).catch(() => undefined);
    setItems((c) => c.filter((x) => !(x.order_id === o.id && x.slot === slot)));
  }
  async function rotate(o: Order, slot: string) {
    const it = itemOf(o, slot);
    if (!it) return;
    const n = await upsertItem({ order_id: o.id, slot, file_name: it.file_name, w: it.w, h: it.h, rot: (it.rot + 90) % 360 });
    setItems((c) => c.map((x) => (x.id === it.id ? n : x)));
  }
  /** kéo ảnh từ ô này sang ô khác (cùng / khác đơn) → đổi chỗ */
  async function swap(a: { o: string; s: string }, b: { o: string; s: string }) {
    if (a.o === b.o && a.s === b.s) return;
    const [fa, fb] = await Promise.all([getFile(fileKey(batchId, a.o, a.s)), getFile(fileKey(batchId, b.o, b.s))]);
    const ia = items.find((i) => i.order_id === a.o && i.slot === a.s), ib = items.find((i) => i.order_id === b.o && i.slot === b.s);
    const put = async (to: { o: string; s: string }, f: typeof fa, it: Item | undefined) => {
      if (f && it) { await putFile({ ...f, key: fileKey(batchId, to.o, to.s), at: Date.now() }); return upsertItem({ order_id: to.o, slot: to.s, file_name: it.file_name, w: it.w, h: it.h, rot: it.rot }); }
      await delFile(fileKey(batchId, to.o, to.s)).catch(() => undefined); await deleteItem(to.o, to.s).catch(() => undefined); return null;
    };
    const [nb, na] = [await put(b, fa, ia), await put(a, fb, ib)];
    setItems((c) => [...c.filter((x) => !((x.order_id === a.o && x.slot === a.s) || (x.order_id === b.o && x.slot === b.s))), ...(nb ? [nb] : []), ...(na ? [na] : [])]);
    setThumbs((m) => { const n = { ...m }; delete n[fileKey(batchId, a.o, a.s)]; delete n[fileKey(batchId, b.o, b.s)]; return n; });
  }
  /** nhiều file lên 1 thẻ → xếp theo tên file, còn lại chọn tay */
  async function dropFiles(o: Order, all: File[]) {
    // chỉ nhận ảnh — bỏ thẳng file nhạc / video (mp3, wav, mp4…) và file khác
    const files = all.filter((f) => f.type.startsWith("image/") || IMG_RE.test(f.name));
    if (files.length < all.length) toast(`Bỏ qua ${all.length - files.length} file không phải ảnh (nhạc / video…)`);
    if (!files.length) return;
    const { placed, left } = assign(files, slotsFor(o), packOf(o), new Set(items.filter((i) => i.order_id === o.id).map((i) => i.slot)));
    for (const p of placed) await saveFile(o, p.slot, p.file, p.file.name);
    if (left.length) setUnmatched((c) => [...c, { orderId: o.id, files: left }]);
    if (placed.length) toast(`Đã xếp ${placed.length} ảnh${left.length ? ` · ${left.length} ảnh cần chọn ô` : ""}`);
  }
  async function dropFolders(dt: DataTransfer) {
    const folders = await foldersFromDrop(dt).catch(() => [] as Folder[]);
    if (!folders.length) return toast("Không thấy thư mục con / file .zip có ảnh", "err");
    const to: Record<string, string> = {};
    for (const f of folders) {
      let best = "", score = 0;
      for (const o of orders) { const s = Math.max(similar(f.name, o.username), o.order_code ? similar(f.name, o.order_code) : 0); if (s > score) { score = s; best = o.id; } }
      to[f.name] = score >= 0.6 ? best : "";
    }
    setFolderMap({ folders, to });
  }

  const sels = orders.filter((o) => sel.has(o.id));
  const toggle = (id: string) => setSel((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[13px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]");
  const count = (f: Filter) => orders.filter((o) => { const s = stat(o); return f === "all" || (f === "missing" && !s.full && !o.unresolved) || (f === "full" && s.full) || (f === "printed" && o.status === "printed") || (f === "unresolved" && (o.unresolved || !s.total)); }).length;

  if (err) return <div className="p-6"><p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{err}</p></div>;
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-5 md:px-6"
      onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); } }}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/ban-in" className="inline-flex items-center gap-1 text-[13px] text-[#52525b] hover:text-[#ff5fa2]"><ArrowLeft size={15} /> Phiên in</Link>
        <h1 className="text-[20px] font-semibold">{batch?.name ?? "…"}</h1>
        {batch && (batch.status === "done" ? <Badge tone="green">Đã xong</Badge> : <Badge tone="amber">Đang làm</Badge>)}
        <span className="flex-1" />
        <Button variant="secondary" icon={<FileText size={15} />} disabled={!orders.length} onClick={async () => { const b = await pickingListPdf(sels.length ? sels : orders, packs, addons, [], `Danh sách soạn hàng · ${batch?.name ?? ""}`); openPdf(b); }}>In danh sách soạn hàng</Button>
        <Button variant="secondary" icon={<Settings size={15} />} onClick={() => setSettings(true)}>Quy tắc & món lẻ</Button>
        <Button icon={<Plus size={15} />} onClick={() => setImporting(true)}>Thêm đơn</Button>
      </div>
      {/* thả thư mục lớn / .zip */}
      <div onDragEnter={() => setDropOver(true)} onDragLeave={() => setDropOver(false)} onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDropOver(false); dropFolders(e.dataTransfer); }}
        className={cx("mb-4 flex items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed px-4 py-4 text-[13px]", dropOver ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#d4d4d8] bg-[#fafafa] text-[#52525b]")}>
        <FolderInput size={18} /> Thả 1 THƯ MỤC lớn (hoặc file .zip) vào đây — mỗi thư mục con trùng / gần trùng username hoặc mã đơn sẽ tự gán vào đơn đó
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([["all", "Tất cả"], ["missing", "Thiếu ảnh"], ["full", "Đủ ảnh"], ["printed", "Đã in"], ["unresolved", "Chưa xác định"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={chip(filter === k)}>{l} · {count(k)}</button>)}
        <label className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm username / mã đơn" className="h-9 w-[220px] rounded-[8px] border border-[#e5e5e7] bg-white pl-8 pr-2 text-[13px] outline-none focus:border-[#ff5fa2]" />
        </label>
        <Button size="sm" variant="secondary" icon={<Check size={14} />} onClick={() => setSel(new Set(orders.filter((o) => stat(o).full && o.status !== "printed").map((o) => o.id)))}>Chọn tất cả đơn đủ ảnh</Button>
        {sel.size > 0 && <button type="button" onClick={() => setSel(new Set())} className="text-[13px] text-[#71717a] hover:text-[#18181b]">Bỏ chọn</button>}
      </div>
      {!orders.length && <p className="rounded-[12px] border border-dashed border-[#d4d4d8] bg-white p-8 text-center text-[14px] text-[#71717a]">Chưa có đơn — bấm “Thêm đơn” (file Excel Shopee, ảnh chụp màn hình hoặc nhập tay).</p>}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map((o) => (
          <OrderCard key={o.id} o={o} packs={packs} addons={addons} slots={slotsFor(o)} stat={stat(o)} batchId={batchId} thumbs={thumbs} itemOf={(s) => itemOf(o, s)}
            selected={sel.has(o.id)} onSelect={() => toggle(o.id)} onPatch={(v, rem) => setOrder(o, v, rem)}
            onMockup={() => setMock(o)} onDropSlot={(slot, f) => saveFile(o, slot, f, f.name)} onDropFiles={(fs) => dropFiles(o, fs)} onSwap={swap} onOpen={(s) => setViewer({ order: o, slot: s })}
            onDelete={async () => { if (await confirmDialog({ title: `Xoá đơn ${o.username || o.order_code}?`, confirmText: "Xoá", danger: true })) { for (const s of slotsFor(o)) await delFile(fileKey(batchId, o.id, s.key)).catch(() => undefined); await deleteOrder(o.id); setOrders((c) => c.filter((x) => x.id !== o.id)); } }} />
        ))}
      </div>

      <PrintBar batch={batch} orders={orders} selected={sels} packs={packs} addons={addons} items={items} stat={stat} slotsFor={slotsFor}
        onBatch={setBatch} onOrders={(ids, v) => setOrders((c) => c.map((o) => (ids.includes(o.id) ? { ...o, ...v } : o)))} />

      {importing && <ImportModal packs={packs} addons={addons} rules={rules} existing={orders} onAdd={addOrders} onClose={() => setImporting(false)} />}
      {mock && <MockupModal o={mock} pack={packOf(mock)} batchId={batchId} items={items.filter((i) => i.order_id === mock.id)} onClose={() => setMock(null)} />}
      {settings && <SettingsModal packs={packs} rules={rules} addons={addons} onRules={setRules} onAddons={setAddons} onClose={() => setSettings(false)} />}
      {viewer && <Viewer o={viewer.order} slot={viewer.slot} batchId={batchId} item={itemOf(viewer.order, viewer.slot.key)} onClose={() => setViewer(null)}
        onReplace={(f) => saveFile(viewer.order, viewer.slot.key, f, f.name)} onRotate={() => rotate(viewer.order, viewer.slot.key)} onDelete={async () => { await removeFile(viewer.order, viewer.slot.key); setViewer(null); }} />}
      {unmatched[0] && (() => {
        const u = unmatched[0], o = orders.find((x) => x.id === u.orderId);
        if (!o) { setUnmatched((c) => c.slice(1)); return null; }
        return <UnmatchedModal o={o} files={u.files} slots={slotsFor(o)} filled={(s) => has(o, s)} onClose={() => setUnmatched((c) => c.slice(1))}
          onSave={async (pairs) => { for (const p of pairs) await saveFile(o, p.slot, p.file, p.file.name); setUnmatched((c) => c.slice(1)); }} />;
      })()}
      {folderMap && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
          <div className="max-h-[90dvh] w-full max-w-[640px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-xl">
            <p className="mb-1 text-[16px] font-semibold">Thư mục → đơn</p>
            <p className="mb-3 text-[12px] text-[#71717a]">Kiểm tra lại trước khi xếp ảnh. Thư mục không gán đơn sẽ bỏ qua.</p>
            <table className="w-full text-[13px]"><tbody>
              {folderMap.folders.map((f) => (
                <tr key={f.name} className="border-t border-[#efeff1]">
                  <td className="py-1.5 pr-2">{f.name} <span className="text-[11px] text-[#a1a1aa]">· {f.files.length} ảnh</span></td>
                  <td className="py-1.5"><select value={folderMap.to[f.name]} onChange={(e) => setFolderMap({ ...folderMap, to: { ...folderMap.to, [f.name]: e.target.value } })} className={cx("h-8 w-full rounded-[6px] border px-2", folderMap.to[f.name] ? "border-[#e5e5e7]" : "border-[#f59e0b] bg-[#fffbeb]")}>
                    <option value="">— bỏ qua —</option>
                    {orders.map((o) => <option key={o.id} value={o.id}>#{o.seq} {o.username}{o.order_code ? ` · ${o.order_code}` : ""}</option>)}
                  </select></td>
                </tr>
              ))}
            </tbody></table>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setFolderMap(null)}>Huỷ</Button>
              <Button onClick={async () => { const m = folderMap; setFolderMap(null); for (const f of m.folders) { const o = orders.find((x) => x.id === m.to[f.name]); if (o) await dropFiles(o, f.files); } }}>Xếp ảnh</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** khổ ô ảnh nhỏ theo hình dạng thật */
function tileStyle(s: Slot, H = 76) { return { height: H, width: Math.round((H * s.w) / s.h) }; }
function warn(s: Slot, it?: Item) {
  if (!it || !it.w) return null;
  const [w, h] = it.rot % 180 ? [it.h, it.w] : [it.w, it.h];
  const out: string[] = [];
  if (w < mmToPx(s.w) * 0.75 || h < mmToPx(s.h) * 0.75) out.push(`Độ phân giải thấp (${w}×${h}px, cần ~${mmToPx(s.w)}×${mmToPx(s.h)}px)`);
  if (Math.abs(w / h - s.w / s.h) / (s.w / s.h) > 0.03) out.push(`Sai tỉ lệ (${(w / h).toFixed(2)} ≠ ${(s.w / s.h).toFixed(2)}) — phần thừa sẽ bị cắt`);
  return out.length ? out : null;
}

function OrderCard({ o, packs, addons, slots, stat, batchId, thumbs, itemOf, selected, onSelect, onPatch, onMockup, onDropSlot, onDropFiles, onSwap, onOpen, onDelete }: {
  o: Order; packs: Pack[]; addons: Addon[]; slots: Slot[]; stat: { total: number; n: number; full: boolean }; batchId: string; thumbs: Record<string, string>;
  itemOf: (s: string) => Item | undefined; selected: boolean; onSelect: () => void; onPatch: (v: Partial<Order>, rem?: { result: "package" | "addon"; id: string }) => void; onMockup: () => void;
  onDropSlot: (slot: string, f: File) => void; onDropFiles: (fs: File[]) => void; onSwap: (a: { o: string; s: string }, b: { o: string; s: string }) => void; onOpen: (s: Slot) => void; onDelete: () => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const bad = o.unresolved || !slots.length;
  const groups = slots.reduce<Record<string, Slot[]>>((m, s) => { (m[s.piece] ??= []).push(s); return m; }, {});
  // mỗi bản (Combo 1, Combo 2, Card 1…) = 1 hàng ô ảnh riêng
  const rows = Object.values(groups).reduce<{ label: string; pieces: Slot[][] }[]>((acc, ss) => {
    const l = ss[0].instLabel ?? "", last = acc[acc.length - 1];
    if (last && last.label === l) last.pieces.push(ss); else acc.push({ label: l, pieces: [ss] });
    return acc;
  }, []);
  const setPacks = (v: { id: string; qty: number }[], rem?: { result: "package"; id: string }) => { const list = v.filter((x) => x.qty > 0); onPatch({ packs: list, package_id: list[0]?.id ?? null, qty: 1, unresolved: false }, rem); };
  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); onDropFiles([...e.dataTransfer.files]); }}
      className={cx("rounded-[14px] border-2 bg-white p-3", bad ? "border-[#fca5a5]" : selected ? "border-[#ff5fa2]" : "border-[#e5e5e7]", o.status === "printed" && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4 accent-[#ff5fa2]" aria-label="Chọn đơn" />
        <span className="text-[12px] text-[#a1a1aa]">#{o.seq}</span>
        <span className="min-w-0 truncate text-[15px] font-semibold" title={o.username}>{o.username || "(chưa có username)"}</span>
        {o.order_code && <span className="text-[12px] text-[#71717a]">{o.order_code}</span>}
        <span className="flex-1" />
        {o.status === "printed" ? <Badge tone="green">Đã in</Badge> : bad ? <Badge tone="amber">Chưa xác định</Badge> : stat.full ? <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[12px] font-semibold text-[#15803d]">Đủ ảnh {stat.n}/{stat.total}</span> : <span className="rounded-full bg-[#ffedd5] px-2 py-0.5 text-[12px] font-semibold text-[#c2410c]">Thiếu {stat.total - stat.n}</span>}
        <button type="button" onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-[6px] text-[#a1a1aa] hover:bg-[#fef2f2] hover:text-[#dc2626]" aria-label="Xoá đơn"><Trash2 size={14} /></button>
      </div>
      {(o.product || o.variation) && <p className="mt-1 line-clamp-2 text-[12px] text-[#71717a]" title={`${o.product}\n${noMusic(o.variation)}`}>{noMusic(o.variation) || o.product}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {/* nhiều gói / đơn, mỗi gói có số lượng (mỗi bản = 1 hàng ô ảnh riêng) */}
        {packsOf(o).map((pq) => (
          <span key={pq.id} className="inline-flex h-7 items-center gap-0.5 rounded-full bg-[#eff6ff] pl-2.5 pr-1 text-[12px] font-medium text-[#1d4ed8]">
            {packs.find((p) => p.id === pq.id)?.name ?? "?"}
            <button type="button" onClick={() => setPacks(packsOf(o).map((x) => (x.id === pq.id ? { ...x, qty: x.qty - 1 } : x)))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#dbeafe]" aria-label="Bớt 1">−</button>
            <span className="w-4 text-center tabular-nums">{pq.qty}</span>
            <button type="button" onClick={() => setPacks(packsOf(o).map((x) => (x.id === pq.id ? { ...x, qty: x.qty + 1 } : x)))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#dbeafe]" aria-label="Thêm 1">+</button>
            <button type="button" onClick={() => setPacks(packsOf(o).filter((x) => x.id !== pq.id))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#dbeafe]" aria-label="Bỏ gói"><X size={11} /></button>
          </span>
        ))}
        <select value="" onChange={(e) => { const id = e.target.value; if (!id) return; const cur = packsOf(o); setPacks(cur.some((x) => x.id === id) ? cur.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x)) : [...cur, { id, qty: 1 }], { result: "package", id }); }}
          className={cx("h-7 rounded-full border px-2 text-[12px]", packsOf(o).length ? "border-dashed border-[#d4d4d8] text-[#52525b]" : "border-[#fca5a5] bg-[#fef2f2]")} aria-label="Thêm gói">
          <option value="">+ Gói</option>
          {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {[...new Set(o.addons)].map((id) => {
          const n = o.addons.filter((x) => x === id).length;
          return (
            <span key={id} className="inline-flex h-7 items-center gap-0.5 rounded-full bg-[#f4f4f5] pl-2.5 pr-1 text-[12px]">{addons.find((a) => a.id === id)?.name ?? "?"}
              <button type="button" onClick={() => { const i = o.addons.lastIndexOf(id); onPatch({ addons: o.addons.filter((_, k) => k !== i) }); }} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#e4e4e7]" aria-label="Bớt 1">−</button>
              <span className="w-4 text-center tabular-nums">{n}</span>
              <button type="button" onClick={() => onPatch({ addons: [...o.addons, id] })} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#e4e4e7]" aria-label="Thêm 1">+</button>
              <button type="button" onClick={() => onPatch({ addons: o.addons.filter((x) => x !== id) })} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#e4e4e7]" aria-label="Bỏ món"><X size={11} /></button>
            </span>
          );
        })}
        {adding ? (
          <select autoFocus onBlur={() => setAdding(false)} onChange={(e) => { if (e.target.value) onPatch({ addons: [...o.addons, e.target.value], unresolved: false }, { result: "addon", id: e.target.value }); setAdding(false); }} className="h-7 rounded-[8px] border border-[#e5e5e7] text-[12px]" defaultValue="">
            <option value="">— món —</option>{addons.filter((a) => a.is_active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ) : <button type="button" onClick={() => setAdding(true)} className="h-7 rounded-full border border-dashed border-[#d4d4d8] px-2.5 text-[12px] text-[#52525b] hover:border-[#ff5fa2]">+ Món</button>}
        {packsOf(o).length > 0 && <button type="button" onClick={onMockup} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#e5e5e7] px-2.5 text-[12px] text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]" title="Xem mockup hộp CD từ ảnh của đơn"><Box size={12} /> Xem mockup</button>}
      </div>
      {slots.length > 0 ? (
        <div className="mt-3 space-y-2.5">
         {rows.map((row, ri) => (
          <div key={ri} className={cx(rows.length > 1 && "border-t border-[#f4f4f5] pt-2 first:border-0 first:pt-0")}>
          {rows.length > 1 && <p className="mb-1 text-[12px] font-semibold text-[#3f3f46]">{row.label}</p>}
          <div className="flex flex-wrap gap-3">
          {row.pieces.map((ss) => (
            <div key={ss[0].piece} className="flex flex-wrap gap-1.5">
              {ss.map((s) => {
                const k = fileKey(batchId, o.id, s.key), it = itemOf(s.key), url = thumbs[k], w = warn(s, it);
                return (
                  <figure key={s.key} className="text-center">
                    <div draggable={!!url} onDragStart={(e) => { e.dataTransfer.setData(DRAG, JSON.stringify({ o: o.id, s: s.key })); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(s.key); }} onDragLeave={() => setOver(null)}
                      onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation(); setOver(null);
                        const from = e.dataTransfer.getData(DRAG);
                        if (from) return onSwap(JSON.parse(from), { o: o.id, s: s.key });
                        const fs = [...e.dataTransfer.files];
                        if (fs.length === 1) onDropSlot(s.key, fs[0]); else if (fs.length) onDropFiles(fs);
                      }}
                      onClick={() => (url ? onOpen(s) : (document.getElementById(`up-${o.id}-${s.key}`) as HTMLInputElement | null)?.click())}
                      title={w?.join("\n") ?? s.label}
                      className={cx("relative cursor-pointer overflow-hidden border-[1.5px] bg-[#f4f4f5]", s.shape === "disc" ? "rounded-full" : s.shape === "rounded" ? "rounded-[8px]" : "rounded-[3px]", over === s.key ? "border-[#ff5fa2]" : url ? (w ? "border-[#f59e0b]" : "border-[#e5e5e7]") : "border-dashed border-[#d4d4d8]")}
                      style={tileStyle(s)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {url ? <img src={url} alt="" className="h-full w-full object-cover" style={{ transform: it?.rot ? `rotate(${it.rot}deg)` : undefined }} draggable={false} />
                        : <span className="grid h-full place-items-center text-[#a1a1aa]"><Upload size={14} /></span>}
                      {url && <span className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 0 ${Math.max(1, (BLEED_MM / s.h) * 76)}px rgba(255,255,255,0.55)` }} />}
                      {s.shape === "disc" && <span className="pointer-events-none absolute left-1/2 top-1/2 h-[13%] w-[13%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d4d4d8] bg-white" />}
                      {w && <AlertTriangle size={13} className="absolute right-0.5 top-0.5 text-[#f59e0b] drop-shadow" />}
                      <input id={`up-${o.id}-${s.key}`} type="file" accept="image/*" className="sr-only" onClick={(e) => e.stopPropagation()} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onDropSlot(s.key, f); }} />
                    </div>
                    <figcaption className="mt-0.5 max-w-[110px] truncate text-[10px] text-[#71717a]">{s.label}</figcaption>
                  </figure>
                );
              })}
            </div>
          ))}
          </div>
          </div>
         ))}
        </div>
      ) : <p className="mt-3 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]">Chưa xác định cần in gì — chọn Gói hoặc thêm Món lẻ.</p>}
    </div>
  );
}

/** xem to 1 ô: lớp phủ đường cắt + lề tràn, Thay ảnh · Xoay 90° · Xoá */
function Viewer({ o, slot, batchId, item, onClose, onReplace, onRotate, onDelete }: {
  o: Order; slot: Slot; batchId: string; item?: Item; onClose: () => void; onReplace: (f: File) => void; onRotate: () => void; onDelete: () => void;
}) {
  const [url, setUrl] = useState("");
  const inRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let u = "";
    getFile(fileKey(batchId, o.id, slot.key)).then((f) => { if (f) { u = URL.createObjectURL(f.blob); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [batchId, o.id, slot.key, item?.rot, item?.file_name]);
  const W = slot.w + BLEED_MM * 2, H = slot.h + BLEED_MM * 2, w = warn(slot, item);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[760px] rounded-[14px] bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-center gap-2"><p className="text-[15px] font-semibold">#{o.seq} {o.username} · {slot.label}</p><span className="text-[12px] text-[#a1a1aa]">{item?.file_name} · {item?.w}×{item?.h}px</span>
          <button type="button" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-[6px] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button></div>
        <div className="mx-auto max-h-[64dvh]" style={{ aspectRatio: `${W} / ${H}`, maxWidth: `min(100%, calc(64dvh * ${W / H}))` }}>
          <div className={cx("relative h-full w-full overflow-hidden bg-[#f4f4f5]", slot.shape === "disc" && "rounded-full")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url && <img src={url} alt="" className="h-full w-full object-cover" style={{ transform: item?.rot ? `rotate(${item.rot}deg)` : undefined }} />}
            {/* lề tràn (bị xén) mờ đi + đường cắt */}
            {([{ left: 0, top: 0, right: 0, height: `${(BLEED_MM / H) * 100}%` }, { left: 0, bottom: 0, right: 0, height: `${(BLEED_MM / H) * 100}%` }, { left: 0, top: 0, bottom: 0, width: `${(BLEED_MM / W) * 100}%` }, { right: 0, top: 0, bottom: 0, width: `${(BLEED_MM / W) * 100}%` }] as React.CSSProperties[]).map((st, i) => <span key={i} className="pointer-events-none absolute bg-white/60" style={st} />)}
            <span className={cx("pointer-events-none absolute border border-dashed border-[#ff5fa2]", slot.shape === "disc" ? "rounded-full" : slot.shape === "rounded" ? "rounded-[6%]" : "")} style={{ left: `${(BLEED_MM / W) * 100}%`, right: `${(BLEED_MM / W) * 100}%`, top: `${(BLEED_MM / H) * 100}%`, bottom: `${(BLEED_MM / H) * 100}%` }} />
            {slot.shape === "disc" && <span className="pointer-events-none absolute left-1/2 top-1/2 h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#ff5fa2]" />}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[#71717a]">Nét đứt hồng = đường cắt ({slot.w / 10} × {slot.h / 10} cm) · phần mờ bên ngoài = lề tràn {BLEED_MM} mm (bị xén).</p>
        {w && <p className="mt-1 text-[12px] font-medium text-[#b45309]">{w.join(" · ")}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => inRef.current?.click()}>Thay ảnh</Button>
          <Button variant="secondary" icon={<RotateCw size={14} />} onClick={onRotate}>Xoay 90°</Button>
          <Button variant="secondary" className="!text-[#dc2626]" icon={<Trash2 size={14} />} onClick={onDelete}>Xoá</Button>
          <input ref={inRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onReplace(f); }} />
        </div>
      </div>
    </div>
  );
}

/** file không nhận ra ô → chọn ô cho từng file */
function UnmatchedModal({ o, files, slots, filled, onSave, onClose }: { o: Order; files: File[]; slots: Slot[]; filled: (s: string) => boolean; onSave: (p: { file: File; slot: string }[]) => Promise<void>; onClose: () => void }) {
  const free = slots.filter((s) => !filled(s.key));
  const [pick, setPick] = useState<Record<number, string>>(() => Object.fromEntries(files.map((_, i) => [i, free[i]?.key ?? ""])));
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="max-h-[90dvh] w-full max-w-[640px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-xl">
        <p className="mb-1 text-[16px] font-semibold">Chọn ô cho {files.length} ảnh · #{o.seq} {o.username}</p>
        <p className="mb-3 text-[12px] text-[#71717a]">Tên file không nhận ra (hoặc ô đã có ảnh). Chọn ô cho từng ảnh, để trống thì bỏ qua.</p>
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[i]} alt="" className="h-12 w-12 rounded-[4px] object-cover" />
              <span className="min-w-0 flex-1 truncate text-[13px]" title={f.name}>{f.name}</span>
              <select value={pick[i]} onChange={(e) => setPick({ ...pick, [i]: e.target.value })} className="h-8 rounded-[6px] border border-[#e5e5e7] px-2 text-[13px]">
                <option value="">— bỏ qua —</option>
                {slots.map((s) => <option key={s.key} value={s.key}>{s.label}{filled(s.key) ? " (thay ảnh cũ)" : ""}</option>)}
              </select>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Bỏ qua</Button><Button onClick={() => onSave(files.map((file, i) => ({ file, slot: pick[i] })).filter((p) => p.slot))}>Xếp vào ô</Button></div>
      </div>
    </div>
  );
}
