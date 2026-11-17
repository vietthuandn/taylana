"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { statusLabels } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Trash2 } from "lucide-react";
import { Button, Card, Field, Input, Message, Textarea, confirmDialog } from "@/components/admin/ui";

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
    if (!await confirmDialog(`Xoá hẳn đơn ${order.code}${fileCount ? ` và ${fileCount} file` : ""}? Không thể hoàn tác.`)) return;
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
    <Card title="Xử lý đơn" description="Đổi trạng thái, ghi chú nội bộ và giá chốt.">
      <p className="mb-1.5 text-[13px] font-medium">Trạng thái</p>
      <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
        {(["new", "in_progress", "delivered"] as const).map((s) => (
          <button key={s} disabled={busy}
            onClick={() => { setStatus(s); save({ status: s }); }}
            className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${status === s ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:text-[#18181b]"}`}>
            {statusLabels[s]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Ghi chú nội bộ" hint="Khách không thấy">
          <Textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
        </Field>
        <Field label="Tổng tiền (đồng)">
          <Input type="number" min={0} step={1000} value={total} onChange={(e) => setTotal(Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#efeff1] pt-4">
        <Button disabled={busy} onClick={() => save({ admin_note: adminNote, total: Math.max(0, Math.round(total)) })}>
          Lưu ghi chú & giá
        </Button>
        <Button variant="danger" className="ml-auto" disabled={busy} onClick={del} icon={<Trash2 size={16} />}>Xoá đơn</Button>
      </div>
      <Message msg={msg} />
    </Card>
  );
}
