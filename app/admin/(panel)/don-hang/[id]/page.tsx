import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import type { Order, OrderFile } from "@/lib/types";
import { formatBytes, formatDate, formatVND, orderTypeLabels, statusLabels } from "@/lib/format";
import { AdminPage, Badge, Card, PageHeader } from "@/components/admin/ui";
import { statusTone } from "@/components/admin/tones";
import { OrderControls } from "./OrderControls";

const kindLabels: Record<string, string> = {
  front: "Bìa trước", back: "Bìa sau", disc: "Mặt CD", booklet: "Booklet",
  design: "Thiết kế", photostrip: "Photostrip", other: "Khác",
};

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const { data: filesData } = await supabase.from("order_files").select("*").eq("order_id", id).order("kind").order("page").order("created_at", { ascending: false });
  const files = (filesData ?? []) as OrderFile[];
  // Khách nộp lại cùng một ô → file mới nhất là bản dùng, các file trước đánh dấu "bản cũ"
  const seen = new Set<string>();
  const outdated = new Set<string>();
  for (const f of files) {
    const k = `${f.kind}-${f.page ?? ""}`;
    if (seen.has(k) && f.kind !== "design") outdated.add(f.id);
    seen.add(k);
  }

  // Link tải tạm thời (hết hạn sau 1 giờ) cho file trong bucket riêng tư
  const signed = new Map<string, string>();
  if (files.length) {
    const { data } = await supabase.storage.from("order-files").createSignedUrls(files.map((f) => f.storage_path), 3600);
    data?.forEach((d) => d.path && d.signedUrl && signed.set(d.path, d.signedUrl));
  }

  return (
    <AdminPage>
      <Link href="/admin/don-hang" className="mb-3 inline-flex items-center gap-1 text-[13px] text-[#71717a] hover:text-[#18181b]">← Danh sách đơn</Link>
      <PageHeader title={`Đơn ${order.code}`} description={`${orderTypeLabels[order.order_type]} · đặt lúc ${formatDate(order.created_at)}`}
        actions={<Badge tone={statusTone[order.status]}>{statusLabels[order.status]}</Badge>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <Card title={`File của khách (${files.length})`} description={order.files_cleaned_at ? `File đã được dọn lúc ${formatDate(order.files_cleaned_at)}.` : "Bản mới nhất của mỗi ô được dùng để in."}>
            {order.music_link && (
              <p className="mb-4 flex items-center gap-2 rounded-[8px] bg-[#fafafa] px-3 py-2 text-[13px]">
                <span className="shrink-0 text-[#71717a]">File nhạc:</span>
                <a className="break-all text-[#ff5fa2] hover:underline" href={order.music_link} target="_blank" rel="noreferrer">{order.music_link}</a>
              </p>
            )}
            {files.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {files.map((f) => {
                  const url = signed.get(f.storage_path);
                  const isImg = f.mime_type.startsWith("image/");
                  return (
                    <li key={f.id} className={`overflow-hidden rounded-[10px] border border-[#e5e5e7] bg-white ${outdated.has(f.id) ? "opacity-50" : ""}`}>
                      <div className="grid aspect-square place-items-center bg-[#f4f4f5]">
                        {isImg && url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={f.file_name} className="h-full w-full object-contain" loading="lazy" />
                        ) : (
                          <span className="text-[13px] font-semibold text-[#71717a]">PDF</span>
                        )}
                      </div>
                      <div className="p-2.5 text-[12px]">
                        <p className="font-medium text-[#18181b]">{kindLabels[f.kind] ?? f.kind}{f.page ? ` · trang ${f.page}` : ""}{outdated.has(f.id) ? " · bản cũ" : ""}</p>
                        <p className="truncate text-[#71717a]">{f.file_name}</p>
                        <p className="text-[#a1a1aa]">{formatBytes(f.size_bytes)}{f.width_px ? ` · ${f.width_px}×${f.height_px}px` : ""}</p>
                        {url && <a className="mt-1 inline-block font-medium text-[#ff5fa2] hover:underline" href={`${url}&download=${encodeURIComponent(f.file_name)}`}>Tải file gốc</a>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-[#71717a]">Khách chưa gửi file in nào.</p>
            )}
          </Card>
          <OrderControls order={order} fileCount={files.length} paths={files.map((f) => f.storage_path)} />
        </div>

        <div className="space-y-4">
          <Card title="Khách hàng">
            <p className="font-medium text-[#18181b]">{order.customer_name}</p>
            <p className="mt-1 text-[14px]">
              <a className="text-[#ff5fa2] hover:underline" href={`tel:${order.phone}`}>{order.phone}</a>
              <span className="text-[#d4d4d8]"> · </span>
              <a className="text-[#ff5fa2] hover:underline" href={`https://zalo.me/${order.phone.replace(/^\+84/, "0")}`} target="_blank" rel="noreferrer">Zalo</a>
            </p>
            {order.address && <p className="mt-2 whitespace-pre-line text-[13px] text-[#52525b]">{order.address}</p>}
            {order.note && (
              <div className="mt-4 border-t border-[#efeff1] pt-3">
                <p className="text-[12px] font-medium text-[#71717a]">Ghi chú của khách</p>
                <p className="mt-1 whitespace-pre-line text-[13px] text-[#18181b]">{order.note}</p>
              </div>
            )}
          </Card>
          <Card title="Sản phẩm">
            <ul className="space-y-1.5 text-[14px]">
              {order.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-[#3f3f46]">{it.type === "addon" ? "+ " : ""}{it.name} × {it.qty}</span>
                  <span>{formatVND(it.price * it.qty)}</span>
                </li>
              ))}
              {!order.items.length && <li className="text-[#71717a]">(không có)</li>}
            </ul>
            <p className="mt-3 flex justify-between border-t border-[#efeff1] pt-3 font-semibold">
              <span>Tạm tính</span><span>{formatVND(order.total)}</span>
            </p>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
