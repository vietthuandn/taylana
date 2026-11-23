"use client";
/* Tài chính → Nhập dữ liệu Shopee: kéo thả 1 hoặc nhiều file .xlsx → đọc bằng SheetJS trên trình duyệt (không gửi file lên server)
   → so với Supabase → bảng xem trước "Mới · Cập nhật · Trùng bỏ qua · Lỗi" (mở xem chi tiết) → bấm "Nhập" mới ghi → lưu lịch sử nhập. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseShopeeFile } from "@/lib/finance/shopee";
import { planImport, runImport, type Plan } from "@/lib/finance/importer";
import { Badge, Button, Card, EmptyState, Message, cx } from "@/components/admin/ui";

const KIND: Record<Plan["kind"], string> = { income: "Báo cáo Income", balance: "My Balance", orders: "File xuất đơn" };
const ST = { new: ["Mới", "green"], update: ["Cập nhật", "blue"], dup: ["Trùng bỏ qua", "gray"] } as const;
type Hist = { id: number; file_name: string; kind: string; new_count: number; update_count: number; dup_count: number; err_count: number; created_at: string };
type Item = { file: string; plan?: Plan; error?: string; done?: string };

export function ImportShopee() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState("");
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const loadHist = useCallback(async () => {
    const { data, error } = await createClient().from("finance_imports").select("*").order("created_at", { ascending: false }).limit(30);
    if (error) setMsg({ type: "err", text: error.message.includes("finance_imports") ? "Chưa có bảng Tài chính — cần chạy supabase/migration_finance_shopee.sql." : error.message });
    setHist((data ?? []) as Hist[]);
  }, []);
  useEffect(() => { loadHist(); }, [loadHist]);

  async function add(files: File[]) {
    const xs = files.filter((f) => /\.(xlsx|xls)$/i.test(f.name));
    if (!xs.length) { setMsg({ type: "err", text: "Chỉ nhận file Excel (.xlsx)." }); return; }
    setMsg(null);
    const sb = createClient();
    for (const [i, f] of xs.entries()) {
      setBusy(`Đang đọc ${i + 1} / ${xs.length}: ${f.name}`);
      try { const plan = await planImport(sb, await parseShopeeFile(f)); setItems((c) => [...c.filter((x) => x.file !== f.name), { file: f.name, plan }]); }
      catch (e) { setItems((c) => [...c.filter((x) => x.file !== f.name), { file: f.name, error: e instanceof Error ? e.message : String(e) }]); }
    }
    setBusy("");
  }
  async function importAll() {
    const sb = createClient();
    // Income trước (tạo đơn) → My Balance → file xuất đơn
    const order = { income: 0, balance: 1, orders: 2 };
    const list = items.filter((x) => x.plan && !x.done).sort((a, b) => order[a.plan!.kind] - order[b.plan!.kind]);
    for (const [i, it] of list.entries()) {
      setBusy(`Đang nhập ${i + 1} / ${list.length}: ${it.file}`);
      const r = await runImport(sb, it.plan!);
      setItems((c) => c.map((x) => (x.file === it.file ? { ...x, done: r.errors.length ? `Lỗi: ${r.errors.join(" · ")}` : `Đã ghi ${r.written} dòng` } : x)));
    }
    setBusy(""); setMsg({ type: "ok", text: "Đã nhập xong." }); await loadHist();
  }
  const pending = items.filter((x) => x.plan && !x.done);
  const total = pending.reduce((a, x) => ({ new: a.new + x.plan!.counts.new, update: a.update + x.plan!.counts.update, dup: a.dup + x.plan!.counts.dup, err: a.err + x.plan!.counts.err }), { new: 0, update: 0, dup: 0, err: 0 });

  return (
    <div className="space-y-5">
      <Card title="Chọn file" description="Báo cáo Income, My Balance (Transaction Report) hoặc file xuất đơn hàng (Order.all…). Kéo thả nhiều file cùng lúc — file được đọc ngay trên máy bạn.">
        <button type="button" onClick={() => fileIn.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add([...e.dataTransfer.files]); }}
          className={cx("grid w-full place-items-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-10 text-[14px] text-[#52525b]", drag ? "border-[#ff5fa2] bg-[#fff5f9]" : "border-[#d4d4d8] hover:border-[#ff5fa2]")}>
          <Upload size={22} className="text-[#ff5fa2]" />
          <span><b>Kéo thả file .xlsx</b> vào đây hoặc bấm để chọn</span>
          {busy && <span className="text-[12px] text-[#71717a]">{busy}</span>}
        </button>
        <input ref={fileIn} type="file" multiple accept=".xlsx,.xls" className="sr-only" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) add(f); }} />
      </Card>

      {items.length > 0 && (
        <Card title="Xem trước" description={pending.length ? `Mới: ${total.new} · Cập nhật: ${total.update} · Trùng bỏ qua: ${total.dup} · Lỗi: ${total.err}` : undefined}
          actions={<>
            <Button variant="secondary" size="sm" onClick={() => setItems([])} disabled={!!busy}>Xoá danh sách</Button>
            <Button size="sm" onClick={importAll} loading={!!busy && busy.startsWith("Đang nhập")} disabled={!pending.length || !!busy}>Nhập</Button>
          </>}>
          <ul className="space-y-2">
            {items.map((it) => {
              const p = it.plan, on = open === it.file;
              return (
                <li key={it.file} className="rounded-[10px] border border-[#e5e5e7]">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <FileSpreadsheet size={16} className="text-[#16a34a]" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={it.file}>{it.file}</span>
                    {p && <Badge tone="pink">{KIND[p.kind]}</Badge>}
                    {it.error && <Badge tone="red">Không đọc được</Badge>}
                    {it.done && <Badge tone={it.done.startsWith("Lỗi") ? "red" : "green"}>{it.done.startsWith("Lỗi") ? "Lỗi khi ghi" : "Đã nhập"}</Badge>}
                    {p && <span className="text-[12px] text-[#52525b]">Mới: {p.counts.new} · Cập nhật: {p.counts.update} · Trùng bỏ qua: {p.counts.dup} · Lỗi: {p.counts.err}</span>}
                    {p && <button type="button" onClick={() => setOpen(on ? null : it.file)} className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#ff5fa2]">Chi tiết <ChevronDown size={14} className={cx("transition-transform", on && "rotate-180")} /></button>}
                    {!it.done && <button type="button" onClick={() => setItems((c) => c.filter((x) => x.file !== it.file))} aria-label="Bỏ file" className="text-[#a1a1aa] hover:text-[#dc2626]"><X size={15} /></button>}
                  </div>
                  {it.error && <p className="border-t border-[#efeff1] px-3 py-2 text-[12px] text-[#dc2626]">{it.error}</p>}
                  {it.done?.startsWith("Lỗi") && <p className="border-t border-[#efeff1] px-3 py-2 text-[12px] text-[#dc2626]">{it.done}</p>}
                  {p && on && (
                    <div className="max-h-[360px] overflow-y-auto border-t border-[#efeff1] px-3 py-2 text-[12px]">
                      {p.errors.map((e, i) => <p key={`e${i}`} className="py-0.5 text-[#dc2626]">Lỗi · {e}</p>)}
                      {(["new", "update", "dup"] as const).map((s) => p.rows.filter((r) => r.status === s).map((r) => (
                        <p key={`${r.table}${r.key}`} className="flex items-center gap-2 py-0.5"><Badge tone={ST[s][1]}>{ST[s][0]}</Badge><span className="truncate text-[#3f3f46]">{r.label}</span></p>
                      )))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Message msg={msg} />

      <Card title="Lịch sử nhập" padded={false}>
        {hist.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-[#71717a]"><tr><th className="px-4 py-2 font-medium">Thời gian</th><th className="px-4 py-2 font-medium">File</th><th className="px-4 py-2 font-medium max-md:hidden">Loại</th><th className="px-4 py-2 font-medium">Mới · Cập nhật · Trùng · Lỗi</th></tr></thead>
              <tbody className="divide-y divide-[#efeff1]">
                {hist.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-[#52525b]">{new Date(h.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="max-w-[260px] truncate px-4 py-2" title={h.file_name}>{h.file_name}</td>
                    <td className="px-4 py-2 max-md:hidden">{KIND[h.kind as Plan["kind"]] ?? h.kind}</td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{h.new_count} · {h.update_count} · {h.dup_count} · <span className={h.err_count ? "text-[#dc2626]" : ""}>{h.err_count}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-5"><EmptyState>Chưa nhập file nào.</EmptyState></div>}
      </Card>
    </div>
  );
}
