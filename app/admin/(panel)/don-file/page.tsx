import { requireAdmin } from "@/lib/admin";
import { formatBytes } from "@/lib/format";
import { CleanupList, type CleanupOrder } from "./CleanupList";
import { AdminPage, Card, PageHeader } from "@/components/admin/ui";

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
    <AdminPage>
      <PageHeader title="Dọn file" description="Xoá file gốc của các đơn đã giao để giải phóng dung lượng Storage." />

      <div className="space-y-6">
        <Card title="Dung lượng Storage đang dùng" description="Gói Supabase Free có 1GB.">
          {usageErr ? (
            <p className="text-[13px] text-[#dc2626]">{usageErr.message}</p>
          ) : (
            <>
              <p><span className="text-[24px] font-semibold tracking-[-0.02em] text-[#18181b]">{formatBytes(total)}</span> <span className="text-[13px] text-[#71717a]">/ {formatBytes(QUOTA)}</span></p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f4f4f5]">
                <div className={`h-full rounded-full ${pct > 80 ? "bg-[#dc2626]" : "bg-[#ff5fa2]"}`} style={{ width: `${pct}%` }} />
              </div>
              <ul className="mt-4 divide-y divide-[#efeff1] text-[13px]">
                {rows.map((r) => (
                  <li key={r.bucket} className="flex justify-between py-2">
                    <span className="text-[#3f3f46]">{r.bucket === "order-files" ? "File khách gửi" : r.bucket === "public-assets" ? "Ảnh trên web" : r.bucket}</span>
                    <span className="text-[#71717a]">{formatBytes(Number(r.total_bytes))} · {r.file_count} file</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="File của đơn đã giao" description="Sau khi xoá, đơn hàng vẫn còn nhưng file gốc sẽ mất hẳn — hãy chắc là đã in xong.">
          {filesErr && <p className="mb-3 text-[13px] text-[#dc2626]">{filesErr.message}</p>}
          <CleanupList orders={orders} />
        </Card>
      </div>
    </AdminPage>
  );
}
