import { requireAdmin } from "@/lib/admin";
import { formatBytes } from "@/lib/format";
import { CleanupList, type CleanupOrder } from "./CleanupList";

const QUOTA = 1024 ** 3; // gói Supabase Free: 1GB Storage

type FileRow = {
  order_id: string;
  size_bytes: number;
  storage_path: string;
  orders: { code: string; customer_name: string; delivered_at: string | null } | null;
};

export default async function CleanupPage() {
  const { supabase } = await requireAdmin();
  const [{ data: usage, error: usageErr }, { data: files, error: filesErr }] = await Promise.all([
    supabase.rpc("storage_usage"),
    supabase
      .from("order_files")
      .select("order_id, size_bytes, storage_path, orders!inner(code, customer_name, delivered_at, status)")
      .eq("orders.status", "delivered")
      .limit(5000),
  ]);

  const rows = (usage ?? []) as { bucket: string; file_count: number; total_bytes: number }[];
  const total = rows.reduce((t, r) => t + Number(r.total_bytes), 0);
  const pct = Math.min(100, (total / QUOTA) * 100);

  const byOrder = new Map<string, CleanupOrder>();
  for (const f of (files ?? []) as unknown as FileRow[]) {
    const o = byOrder.get(f.order_id) ?? {
      id: f.order_id, code: f.orders?.code ?? "", customer_name: f.orders?.customer_name ?? "",
      delivered_at: f.orders?.delivered_at ?? null, count: 0, bytes: 0, paths: [],
    };
    o.count++;
    o.bytes += Number(f.size_bytes);
    o.paths.push(f.storage_path);
    byOrder.set(f.order_id, o);
  }
  const orders = [...byOrder.values()].sort((a, b) => (a.delivered_at ?? "").localeCompare(b.delivered_at ?? ""));

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-3xl">Dọn file</h1>

      <section className="pop mb-8 rounded-3xl bg-cream-50 p-5">
        <h2 className="text-xl">Dung lượng Storage đang dùng</h2>
        {usageErr ? (
          <p className="text-hot-500">{usageErr.message}</p>
        ) : (
          <>
            <p className="mt-1"><b className="font-display text-2xl">{formatBytes(total)}</b> <span className="text-sm text-ink-500">/ {formatBytes(QUOTA)} (gói Free)</span></p>
            <div className="mt-2 h-4 overflow-hidden rounded-full border-2 border-ink-900 bg-white">
              <div className={`h-full ${pct > 80 ? "bg-violet-500" : "bg-lime-500"}`} style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-3 text-sm text-ink-600">
              {rows.map((r) => (
                <li key={r.bucket}>
                  {r.bucket === "order-files" ? "File khách nộp" : r.bucket === "public-assets" ? "Ảnh trên web" : r.bucket}:{" "}
                  {formatBytes(Number(r.total_bytes))} ({r.file_count} file)
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <h2 className="mb-1 text-2xl">File của đơn đã giao</h2>
      <p className="mb-4 text-sm text-ink-600">Sau khi xoá, đơn hàng vẫn còn nhưng file gốc sẽ mất hẳn — hãy chắc là đã in xong.</p>
      {filesErr && <p className="text-hot-500">{filesErr.message}</p>}
      <CleanupList orders={orders} />
    </div>
  );
}
