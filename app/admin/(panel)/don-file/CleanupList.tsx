"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, formatDate } from "@/lib/format";
import { Message } from "@/components/admin/ui";

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
    if (!confirm(`Xoá ${files} file (${formatBytes(bytes)}) của ${list.length} đơn?\n\n${list.map((o) => o.code).join(", ")}\n\nKhông thể hoàn tác!`)) return;

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

  if (!orders.length) return <p className="text-ink-500">Không có đơn đã giao nào còn file. Gọn gàng quá! ✿</p>;

  return (
    <div>
      <div className="pop-sm mb-4 flex flex-wrap items-center gap-2 rounded-3xl bg-violet-100 p-4">
        <span>Xoá file của đơn đã giao quá</span>
        <input type="number" min={0} className="field !w-20 !min-h-10 text-center" value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value)))} />
        <span>ngày</span>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => cleanup(old)}>
          Xoá ({old.length} đơn)
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={selected.size === orders.length}
            onChange={(e) => setSelected(e.target.checked ? new Set(orders.map((o) => o.id)) : new Set())} />
          Chọn tất cả
        </label>
        <button className="btn btn-sm" disabled={!picked.length || !!busy} onClick={() => cleanup(picked)}>
          Xoá file đã chọn ({picked.length})
        </button>
      </div>
      {busy && <p className="mb-3 text-sm">{busy}</p>}
      <div className="mb-3"><Message msg={msg} /></div>

      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id}>
            <label className={`pop-sm flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ${selected.has(o.id) ? "bg-hot-100" : "bg-cream-50"}`}>
              <input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
              <span className="min-w-0 flex-1">
                <Link href={`/admin/don-hang/${o.id}`} className="font-display text-lg underline-offset-2 hover:underline">{o.code}</Link>
                <span className="block truncate text-xs text-ink-500">{o.customer_name} · giao {formatDate(o.delivered_at, false)}</span>
              </span>
              <span className="shrink-0 text-right text-sm">{o.count} file<br /><b>{formatBytes(o.bytes)}</b></span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
