import { PROVIDER, STORAGE_QUOTA, storageUsageRows } from "@/lib/storage";
import { readMigrationStatus } from "@/lib/storage/migrate";
import { requireAdmin } from "@/lib/admin";
import { formatBytes } from "@/lib/format";
import { CleanupList, type CleanupOrder } from "./CleanupList";
import { AdminPage, Card, PageHeader } from "@/components/admin/ui";

const QUOTA = STORAGE_QUOTA; // gói miễn phí: R2 10GB (Supabase Free 1GB khi STORAGE_PROVIDER=supabase)

type FileRow = {
  order_id: string;
  size_bytes: number;
  storage_path: string;
  orders: { code: string; customer_name: string; delivered_at: string | null } | null;
};

export default async function CleanupPage() {
  const { supabase } = await requireAdmin();
  const [{ data: usage, error: usageErr }, { data: files, error: filesErr }] = await Promise.all([
    storageUsageRows(),
    supabase
      .from("order_files")
      .select("order_id, size_bytes, storage_path, orders!inner(code, customer_name, delivered_at, status)")
      .eq("orders.status", "delivered")
      .limit(5000),
  ]);

  const mig = PROVIDER === "r2" ? await readMigrationStatus() : null;
  const migPct = mig?.total ? Math.min(100, (mig.cursor / mig.total) * 100) : 0;
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
      <PageHeader title="Dọn file" />

      <div className="space-y-6">
        {PROVIDER === "r2" && (
          <Card title="Chuyển file cũ sang Cloudflare R2" description="Tự chạy mỗi 15 phút (cùng lịch dọn link chia sẻ) cho tới khi xong. Không xoá gì trên Supabase Storage.">
            {!mig ? (
              <p className="text-[13px] text-[#71717a]">Chưa bắt đầu — sẽ tự chạy ở lần gọi lịch tiếp theo (tối đa 15 phút).</p>
            ) : (
              <>
                <p className="text-[14px] font-medium text-[#18181b]">
                  {mig.phase === "done" ? "✓ Đã chuyển xong" : mig.phase === "db" ? "Đang đổi link ảnh trong database…" : `Đang chép file: ${mig.cursor} / ${mig.total}`}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f4f4f5]">
                  <div className="h-full rounded-full bg-[#ff5fa2]" style={{ width: `${mig.phase === "files" ? migPct : 100}%` }} />
                </div>
                <p className="mt-2 text-[13px] text-[#71717a]">
                  {mig.copied} đã chép · {mig.skipped} đã có sẵn · {mig.failedKeys.length} lỗi · {mig.rows} dòng database đã đổi link · cập nhật {new Date(mig.updatedAt).toLocaleString("vi-VN")}
                </p>
                {mig.error && <p className="mt-1 text-[13px] text-[#dc2626]">Đợt gần nhất dừng: {mig.error} — lần sau tự chạy tiếp.</p>}
                {mig.failedKeys.length > 0 && <p className="mt-1 text-[12px] text-[#dc2626]">File lỗi: {mig.failedKeys.slice(0, 10).join(", ")}{mig.failedKeys.length > 10 ? "…" : ""}</p>}
                {mig.log.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[13px] text-[#52525b]">Nhật ký ({mig.log.length} dòng gần nhất)</summary>
                    <pre className="mt-2 max-h-[320px] overflow-auto rounded-[8px] bg-[#fafafa] p-3 text-[11px] leading-relaxed text-[#3f3f46]">{[...mig.log].reverse().join("\n")}</pre>
                  </details>
                )}
              </>
            )}
          </Card>
        )}
        <Card title="Dung lượng Storage đang dùng" description={`Gói miễn phí có ${formatBytes(QUOTA)}.`}>
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
                    <span className="text-[#3f3f46]">{r.bucket === "order-files" ? "File khách gửi" : r.bucket === "public-assets" ? "Ảnh trên web" : r.bucket === "scrapbook" ? "Quản lý chất liệu" : r.bucket === "mockups" ? "Ảnh mockup" : r.bucket === "design-assets" ? "Thiết kế của khách" : r.bucket === "mockup-shares" ? "Link chia sẻ" : r.bucket}</span>
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
