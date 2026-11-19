"use client";
/* Bàn in → thanh in cố định ở đáy: "Đã chọn N đơn · a đủ ảnh · b thiếu", cách xếp (Theo nhóm / Theo từng đơn), gộp nhiều đơn
   trên 1 tờ, nút "In" (đơn thiếu ảnh bị bỏ qua, có liệt kê) → mở Hàng đợi in. Hàng đợi đang chạy lưu ở print_batches.progress. */
import { useState } from "react";
import { ListChecks, Printer } from "lucide-react";
import { saveProgress } from "@/lib/printShop/db";
import type { Addon, Batch, Item, Order, Pack, Slot } from "@/lib/printShop/types";
import { confirmDialog } from "@/components/ui/dialog";
import { Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { Queue } from "./Queue";

export function PrintBar({ batch, orders, selected, packs, addons, items, stat, slotsFor, onBatch, onOrders }: {
  batch: Batch | null; orders: Order[]; selected: Order[]; packs: Pack[]; addons: Addon[]; items: Item[];
  stat: (o: Order) => { total: number; n: number; full: boolean }; slotsFor: (o: Order) => Slot[]; onBatch: (b: Batch) => void; onOrders: (ids: string[], v: Partial<Order>) => void;
}) {
  const [mode, setMode] = useState<"group" | "order">(batch?.progress?.run?.mode ?? "group");
  const [merge, setMerge] = useState(batch?.progress?.run?.merge ?? true);
  const [open, setOpen] = useState(false);
  const full = selected.filter((o) => stat(o).full), miss = selected.filter((o) => !stat(o).full);
  const run = batch?.progress?.run;
  async function start() {
    if (!batch) return;
    if (!full.length) return toast("Chưa có đơn nào đủ ảnh trong các đơn đã chọn", "err");
    if (miss.length && !(await confirmDialog({ title: `Bỏ qua ${miss.length} đơn thiếu ảnh?`, message: `Các đơn sau chưa đủ ảnh nên không in: ${miss.map((o) => `#${o.seq} ${o.username || o.order_code}`).join(", ")}.`, confirmText: `In ${full.length} đơn đủ ảnh`, cancelText: "Huỷ" }))) return;
    const progress = { run: { orderIds: full.map((o) => o.id), mode, merge, at: new Date().toISOString() }, done: {}, flipped: {} };
    try { await saveProgress(batch.id, progress); onBatch({ ...batch, progress }); setOpen(true); } catch (e) { toast(e instanceof Error ? e.message : "Lỗi", "err"); }
  }
  const seg = (on: boolean) => cx("rounded-[6px] px-2.5 py-1 text-[12px] font-medium", on ? "bg-white text-[#18181b] shadow-sm" : "text-[#52525b]");
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5e7] bg-white/95 backdrop-blur md:left-[240px]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
          <p className="text-[13px]"><b>Đã chọn {selected.length} đơn</b> · <span className="text-[#15803d]">{full.length} đủ ảnh</span> · <span className={miss.length ? "text-[#c2410c]" : "text-[#a1a1aa]"}>{miss.length} thiếu</span></p>
          <span className="flex-1" />
          <div className="inline-flex rounded-[8px] bg-[#f4f4f5] p-0.5" title="Cách xếp hàng đợi in">
            <button type="button" onClick={() => setMode("group")} className={seg(mode === "group")}>Theo nhóm</button>
            <button type="button" onClick={() => setMode("order")} className={seg(mode === "order")}>Theo từng đơn</button>
          </div>
          <label className="inline-flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} className="accent-[#ff5fa2]" /> Gộp nhiều đơn trên 1 tờ</label>
          {run && <Button variant="secondary" icon={<ListChecks size={15} />} onClick={() => setOpen(true)}>Hàng đợi đang in ({run.orderIds.length})</Button>}
          <Button icon={<Printer size={16} />} onClick={start} disabled={!selected.length}>In</Button>
        </div>
      </div>
      {open && batch?.progress?.run && <Queue batch={batch} orders={orders} packs={packs} addons={addons} items={items} slotsFor={slotsFor} onBatch={onBatch} onOrders={onOrders} onClose={() => setOpen(false)} />}
    </>
  );
}
