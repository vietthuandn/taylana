"use client";
/* Bàn in → "Thêm đơn": (a) file Excel / CSV Shopee — tự nhận cột, chọn lại được, gộp dòng cùng mã đơn · (b) ảnh chụp màn hình
   danh sách đơn — OCR trên trình duyệt, bảng kết quả sửa được, ô kém tin cậy tô vàng · (c) nhập tay (username, gói, món lẻ).
   Chống trùng: username + sản phẩm + phân loại đã có trong phiên → hỏi trước khi thêm. */
import { useState } from "react";
import { FileSpreadsheet, ImageIcon, Keyboard, Plus, Trash2, X } from "lucide-react";
import { COLS, guessCols, ocrImage, readSheet, rowKey, rowsFromOcr, rowsFromSheet, type Col, type ImportRow, type Sheet } from "@/lib/printShop/importers";
import { fold, type Addon, type Order, type Pack } from "@/lib/printShop/types";
import { confirmDialog } from "@/components/ui/dialog";
import { Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

export type NewOrder = { row: ImportRow; manual?: { package_id: string | null; addons: string[]; music: boolean; qty: number } };
const inp = "h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2 text-[13px] outline-none focus:border-[#ff5fa2]";

export function ImportModal({ packs, addons, existing, onAdd, onClose }: {
  packs: Pack[]; addons: Addon[]; existing: Order[]; onAdd: (rows: NewOrder[]) => Promise<void>; onClose: () => void;
}) {
  const [tab, setTab] = useState<"excel" | "ocr" | "manual">("excel");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<Record<Col, number> | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState("");
  const [man, setMan] = useState({ username: "", order_code: "", package_id: "" as string, addons: [] as string[], music: false, qty: 1 });

  async function pickExcel(f: File) {
    setBusy("Đang đọc file...");
    try { const s = await readSheet(f); const m = guessCols(s.headers); setSheet(s); setMap(m); setRows(rowsFromSheet(s, m)); }
    catch (e) { toast(e instanceof Error ? e.message : "Không đọc được file", "err"); }
    setBusy("");
  }
  async function pickImages(fs: File[]) {
    const out: ImportRow[] = [];
    for (const [i, f] of fs.entries()) {
      setBusy(`Đang nhận diện chữ ${i + 1}/${fs.length}... (lần đầu tải dữ liệu tiếng Việt ~ vài MB)`);
      try { out.push(...rowsFromOcr(await ocrImage(f, (p) => setBusy(`Đang nhận diện chữ ${i + 1}/${fs.length} · ${Math.round(p * 100)}%`)))); }
      catch (e) { toast(e instanceof Error ? e.message : "Nhận diện thất bại", "err"); }
    }
    setRows((c) => [...c, ...out]); setBusy("");
    if (!out.length) toast("Không tách được đơn nào từ ảnh — thử ảnh rõ hơn hoặc nhập tay.", "err");
  }
  const setRow = (k: string, v: Partial<ImportRow>) => setRows((c) => c.map((r) => (r.key === k ? { ...r, ...v } : r)));
  const setLine = (k: string, i: number, v: Partial<ImportRow["lines"][number]>) => setRows((c) => c.map((r) => (r.key === k ? { ...r, lines: r.lines.map((l, j) => (j === i ? { ...l, ...v } : l)) } : r)));
  const low = (r: ImportRow, f: string) => r.low?.includes(f) && "bg-[#fef9c3]";

  async function submit(list: NewOrder[]) {
    // chống trùng: username + sản phẩm + phân loại trong cùng phiên
    const sig = (u: string, lines: { product: string; variation: string }[]) => `${fold(u)}|${lines.map((l) => `${fold(l.product)}~${fold(l.variation)}`).sort().join("|")}`;
    const have = new Set(existing.map((o) => sig(o.username, o.lines?.length ? o.lines : [{ product: o.product, variation: o.variation }])));
    const dup = list.filter((n) => n.row.lines.length && have.has(sig(n.row.username, n.row.lines)));
    let use = list;
    if (dup.length) {
      const keep = await confirmDialog({ title: `${dup.length} đơn có thể bị trùng`, message: `Đã có trong phiên (cùng username + sản phẩm + phân loại): ${dup.map((d) => d.row.username || d.row.order_code).join(", ")}. Vẫn thêm các đơn này?`, confirmText: "Vẫn thêm", cancelText: "Bỏ qua đơn trùng" });
      if (!keep) use = list.filter((n) => !dup.includes(n));
    }
    if (!use.length) return toast("Không có đơn nào để thêm", "err");
    setBusy("Đang thêm...");
    await onAdd(use);
    setBusy("");
  }

  const tabBtn = (k: typeof tab, label: string, icon: React.ReactNode) => (
    <button type="button" onClick={() => setTab(k)} className={cx("inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium", tab === k ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:bg-[#f4f4f5]")}>{icon}{label}</button>
  );
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative flex max-h-[92dvh] w-full max-w-[980px] flex-col rounded-[14px] bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-[#efeff1] px-5 py-3">
          <p className="text-[16px] font-semibold">Thêm đơn</p>
          <div className="ml-3 flex gap-1">{tabBtn("excel", "File Excel / CSV", <FileSpreadsheet size={15} />)}{tabBtn("ocr", "Ảnh chụp màn hình", <ImageIcon size={15} />)}{tabBtn("manual", "Nhập tay", <Keyboard size={15} />)}</div>
          <button type="button" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {tab === "excel" && (
            <>
              <label className="block cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] p-5 text-center text-[13px] hover:border-[#ff5fa2]">
                <FileSpreadsheet className="mx-auto mb-1 text-[#a1a1aa]" />
                Chọn file Excel (.xlsx, .xls) hoặc CSV xuất từ Shopee — đọc ngay trên trình duyệt
                <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickExcel(f); }} />
              </label>
              {sheet && map && (
                <div className="rounded-[10px] border border-[#e5e5e7] p-3">
                  <p className="mb-2 text-[13px] font-semibold">Cột trong file {COLS.some((c) => map[c.id] < 0) && <span className="font-normal text-[#b45309]">— có cột chưa nhận được, chọn lại bên dưới</span>}</p>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {COLS.map((c) => (
                      <label key={c.id} className="text-[12px] text-[#52525b]">{c.name}
                        <select value={map[c.id]} onChange={(e) => { const m = { ...map, [c.id]: Number(e.target.value) }; setMap(m); setRows(rowsFromSheet(sheet, m)); }} className={cx(inp, map[c.id] < 0 && "border-[#f59e0b] bg-[#fffbeb]")}>
                          <option value={-1}>— không có —</option>
                          {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Cột ${i + 1}`}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-[#71717a]">{sheet.rows.length} dòng → {rows.length} đơn (gộp các dòng cùng mã đơn).</p>
                </div>
              )}
            </>
          )}
          {tab === "ocr" && (
            <label className="block cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] p-5 text-center text-[13px] hover:border-[#ff5fa2]">
              <ImageIcon className="mx-auto mb-1 text-[#a1a1aa]" />
              Chọn 1 hoặc nhiều ảnh chụp màn hình danh sách đơn (trang Sản phẩm của Shopee) — nhận diện chữ ngay trên trình duyệt
              <input type="file" multiple accept="image/*" className="sr-only" onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) pickImages(fs); }} />
            </label>
          )}
          {busy && <p className="rounded-[8px] bg-[#eff6ff] px-3 py-2 text-[13px] text-[#1d4ed8]">{busy}</p>}
          {tab !== "manual" && rows.length > 0 && (
            <div className="overflow-x-auto rounded-[10px] border border-[#e5e5e7]">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead><tr className="bg-[#fafafa] text-left text-[12px] text-[#71717a]"><th className="w-8 p-2">#</th><th className="w-[150px] p-2">Username</th><th className="w-[130px] p-2">Mã đơn</th><th className="p-2">Sản phẩm · Phân loại · SL</th><th className="w-8" /></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} className="border-t border-[#efeff1] align-top">
                      <td className="p-2 text-[#a1a1aa]">{i + 1}</td>
                      <td className="p-1.5"><input value={r.username} onChange={(e) => setRow(r.key, { username: e.target.value })} className={cx(inp, low(r, "username"))} /></td>
                      <td className="p-1.5"><input value={r.order_code} onChange={(e) => setRow(r.key, { order_code: e.target.value })} className={inp} placeholder="(không bắt buộc)" /></td>
                      <td className="space-y-1 p-1.5">
                        {r.lines.map((l, j) => (
                          <div key={j} className="flex gap-1">
                            <input value={l.product} onChange={(e) => setLine(r.key, j, { product: e.target.value })} placeholder="Tên sản phẩm" className={cx(inp, "flex-[2]", low(r, `l${j}.product`))} />
                            <input value={l.variation} onChange={(e) => setLine(r.key, j, { variation: e.target.value })} placeholder="Phân loại" className={cx(inp, "flex-[2]", low(r, `l${j}.variation`))} />
                            <input type="number" min={1} value={l.qty} onChange={(e) => setLine(r.key, j, { qty: Math.max(1, Number(e.target.value) || 1) })} className={cx(inp, "w-14 flex-none")} aria-label="Số lượng" />
                            <button type="button" onClick={() => setRow(r.key, { lines: r.lines.filter((_, k) => k !== j) })} className="grid w-7 place-items-center text-[#a1a1aa] hover:text-[#dc2626]" aria-label="Xoá dòng"><X size={13} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setRow(r.key, { lines: [...r.lines, { product: "", variation: "", qty: 1 }] })} className="text-[12px] text-[#ff5fa2]">+ dòng sản phẩm</button>
                      </td>
                      <td className="p-1.5"><button type="button" onClick={() => setRows((c) => c.filter((x) => x.key !== r.key))} className="grid h-8 w-7 place-items-center text-[#a1a1aa] hover:text-[#dc2626]" aria-label="Xoá đơn"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tab === "ocr" && <p className="border-t border-[#efeff1] px-3 py-2 text-[12px] text-[#71717a]">Ô tô vàng: nhận diện kém tin cậy — kiểm tra lại trước khi thêm.</p>}
            </div>
          )}
          {tab === "manual" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[13px]">Username<input value={man.username} onChange={(e) => setMan({ ...man, username: e.target.value })} className={inp} autoFocus /></label>
              <label className="text-[13px]">Mã đơn (không bắt buộc)<input value={man.order_code} onChange={(e) => setMan({ ...man, order_code: e.target.value })} className={inp} /></label>
              <label className="text-[13px]">Gói
                <select value={man.package_id} onChange={(e) => setMan({ ...man, package_id: e.target.value })} className={inp}>
                  <option value="">— Không có gói —</option>
                  {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="text-[13px]">Số lượng<input type="number" min={1} value={man.qty} onChange={(e) => setMan({ ...man, qty: Math.max(1, Number(e.target.value) || 1) })} className={inp} /></label>
              <div className="sm:col-span-2">
                <p className="mb-1 text-[13px]">Món in lẻ</p>
                <div className="flex flex-wrap gap-2">
                  {addons.filter((a) => a.is_active).map((a) => {
                    const n = man.addons.filter((x) => x === a.id).length;
                    return (
                      <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e7] px-2 py-1 text-[12px]">
                        {a.name}
                        <button type="button" onClick={() => { const i = man.addons.indexOf(a.id); if (i >= 0) setMan({ ...man, addons: man.addons.filter((_, k) => k !== i) }); }} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#f4f4f5]">−</button>
                        <span className="w-4 text-center tabular-nums">{n}</span>
                        <button type="button" onClick={() => setMan({ ...man, addons: [...man.addons, a.id] })} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[#f4f4f5]">+</button>
                      </span>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={man.music} onChange={(e) => setMan({ ...man, music: e.target.checked })} className="accent-[#ff5fa2]" /> Ghi nhạc</label>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#efeff1] px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          {tab === "manual"
            ? <Button icon={<Plus size={15} />} loading={!!busy} disabled={!man.username.trim()} onClick={() => submit([{ row: { key: rowKey(), username: man.username.trim(), order_code: man.order_code.trim(), lines: [] }, manual: { package_id: man.package_id || null, addons: man.addons, music: man.music, qty: man.qty } }])}>Thêm đơn</Button>
            : <Button icon={<Plus size={15} />} loading={!!busy} disabled={!rows.length} onClick={() => submit(rows.map((row) => ({ row })))}>Thêm {rows.length} đơn</Button>}
        </div>
      </div>
    </div>
  );
}
