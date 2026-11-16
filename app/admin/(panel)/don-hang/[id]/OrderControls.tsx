"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { statusLabels } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Message } from "@/components/admin/ui";

export function OrderControls({ order, fileCount, paths }: { order: Order; fileCount: number; paths: string[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [adminNote, setAdminNote] = useState(order.admin_note);
  const [total, setTotal] = useState(order.total);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: Partial<Order>) {
    setBusy(true);
    const { error } = await createClient().from("orders").update(next).eq("id", order.id);
    setBusy(false);
    if (error) return setMsg({ type: "err", text: error.message });
    setMsg({ type: "ok", text: "✓ Đã lưu" });
    router.refresh();
  }

  async function del() {
    if (!confirm(`Xoá hẳn đơn ${order.code}${fileCount ? ` và ${fileCount} file` : ""}? Không thể hoàn tác.`)) return;
    setBusy(true);
    const sb = createClient();
    if (paths.length) {
      const { error } = await sb.storage.from("order-files").remove(paths);
      if (error) { setBusy(false); return setMsg({ type: "err", text: error.message }); }
    }
    const { error } = await sb.from("orders").delete().eq("id", order.id);
    setBusy(false);
    if (error) return setMsg({ type: "err", text: error.message });
    router.replace("/admin/don-hang");
    router.refresh();
  }

  return (
    <section className="pop mt-5 rounded-3xl bg-lime-100 p-4">
      <h2 className="mb-3 text-xl">Trạng thái</h2>
      <div className="flex flex-wrap gap-2">
        {(["new", "in_progress", "delivered"] as const).map((s) => (
          <button key={s} disabled={busy}
            onClick={() => { setStatus(s); save({ status: s }); }}
            className={`pop-sm rounded-full px-4 py-2 font-display ${status === s ? "bg-lime-500" : "bg-white"}`}>
            {statusLabels[s]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Ghi chú nội bộ (khách không thấy)</span>
          <textarea className="field" rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tổng tiền (đồng)</span>
          <input className="field" type="number" min={0} step={1000} value={total} onChange={(e) => setTotal(Number(e.target.value))} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn btn-sm" disabled={busy} onClick={() => save({ admin_note: adminNote, total: Math.max(0, Math.round(total)) })}>
          Lưu ghi chú & giá
        </button>
        <button className="ml-auto text-sm text-hot-500 underline" disabled={busy} onClick={del}>Xoá đơn</button>
      </div>
      <div className="mt-3"><Message msg={msg} /></div>
    </section>
  );
}
