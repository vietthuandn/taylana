"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, formatDate } from "@/lib/format";
import { Button, Input, Message, Table, confirmDialog } from "@/components/admin/ui";

export type CleanupOrder = {
  id: string; code: string; customer_name: string; delivered_at: string | null;
  count: number; bytes: number; paths: string[];
};

export function CleanupList({ orders }: { orders: CleanupOrder[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  async function cleanup(list: CleanupOrder[]) {
    if (!list.length) return setMsg({ type: "err", text: "Không có đơn nào để xoá" });
    const files = list.reduce((t, o) => t + o.count, 0);
    const bytes = list.reduce((t, o) => t + o.bytes, 0);
    if (!await confirmDialog(`Xoá ${files} file (${formatBytes(bytes)}) của ${list.length} đơn?\n\n${list.map((o) => o.code).join(", ")}\n\nKhông thể hoàn tác!`)) return;

    const sb = createClient();
    const paths = list.flatMap((o) => o.paths);
    try {
      for (let i = 0; i < paths.length; i += 100) {
        setBusy(`Đang xoá ${Math.min(i + 100, paths.length)}/${paths.length} file...`);
        const { error } = await sb.storage.from("order-files").remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
      const ids = list.map((o) => o.id);
      const del = await sb.from("order_files").delete().in("order_id", ids);
      if (del.error) throw del.error;
      const upd = await sb.from("orders").update({ files_cleaned_at: new Date().toISOString() }).in("id", ids);
      if (upd.error) throw upd.error;
      setMsg({ type: "ok", text: `✓ Đã xoá ${files} file, giải phóng ${formatBytes(bytes)}` });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: "Lỗi: " + (e instanceof Error ? e.message : String(e)) });
    }
    setBusy("");
  }

  const cutoff = Date.now() - days * 86400000;
  const old = orders.filter((o) => o.delivered_at && new Date(o.delivered_at).getTime() < cutoff);
  const picked = orders.filter((o) => selected.has(o.id));

  if (!orders.length) return <p className="text-[14px] text-[#71717a]">Không có đơn đã giao nào còn file.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[8px] bg-[#fafafa] p-3 text-[14px]">
        <span>Xoá file của đơn đã giao quá</span>
        <Input type="number" min={0} className="!w-20 text-center" value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value)))} />
        <span>ngày</span>
        <Button variant="danger" size="sm" disabled={!!busy} onClick={() => cleanup(old)}>Xoá ({old.length} đơn)</Button>
      </div>
      {busy && <p className="mb-3 text-[13px] text-[#71717a]">{busy}</p>}
      <Message msg={msg} />

      <Table head={[
        <input key="all" type="checkbox" className="h-4 w-4 align-middle" aria-label="Chọn tất cả" checked={selected.size === orders.length}
          onChange={(e) => setSelected(e.target.checked ? new Set(orders.map((o) => o.id)) : new Set())} />,
        "Mã đơn", "Khách hàng", "Ngày giao", "Số file", "Dung lượng",
      ]}>
        {orders.map((o) => (
          <tr key={o.id} className={selected.has(o.id) ? "bg-[#fff0f6]" : ""}>
            <td className="w-10"><input type="checkbox" className="h-4 w-4 align-middle" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Chọn ${o.code}`} /></td>
            <td><Link href={`/admin/don-hang/${o.id}`} className="font-medium text-[#18181b] hover:text-[#ff5fa2]">{o.code}</Link></td>
            <td className="max-w-[220px] truncate text-[#3f3f46]">{o.customer_name}</td>
            <td className="text-[13px] text-[#71717a]">{formatDate(o.delivered_at, false)}</td>
            <td className="text-[13px] text-[#71717a]">{o.count}</td>
            <td className="text-right font-medium">{formatBytes(o.bytes)}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-4 flex justify-end">
        <Button variant="danger" disabled={!picked.length || !!busy} onClick={() => cleanup(picked)}>Xoá file đã chọn ({picked.length})</Button>
      </div>
    </div>
  );
}
