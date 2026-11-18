import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import type { Order, OrderFile } from "@/lib/types";
import { formatBytes, formatDate, formatVND, orderTypeLabels, statusLabels } from "@/lib/format";
import { AdminPage, Badge, Card, PageHeader } from "@/components/admin/ui";
import { statusTone } from "@/components/admin/tones";
import { OrderControls } from "./OrderControls";
import { PaymentCard, type PaymentRow } from "./PaymentCard";

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
  const files = (filesData ?? []) as (OrderFile & { order_item_id?: string | null; copy_no?: number })[];
  // Dòng sản phẩm (đơn nhiều dòng từ giỏ hàng). Lỗi = chưa chạy migration → dùng orders.items như cũ.
  const { data: itemData } = await supabase.from("order_items").select("*").eq("order_id", id).order("position");
  const lines = (itemData ?? []) as { id: string; package_name: string; product_name?: string; options?: { name: string; price: number; group?: string; multi?: boolean }[]; quantity: number; unit_price: number; line_total: number; copies_mode: string; addons: { name: string; price: number; qty: number }[] }[];
  const { data: payData } = await supabase.from("payments").select("id, amount, source, bank_txn_id, paid_at, note, created_by").eq("order_id", id).order("paid_at", { ascending: false });
  const payments = (payData ?? []) as PaymentRow[];
  // Khách nộp lại cùng một ô → file mới nhất là bản dùng, các file trước đánh dấu "bản cũ"
  const seen = new Set<string>();
  const outdated = new Set<string>();
  for (const f of files) {
    const k = `${f.order_item_id ?? ""}-${f.copy_no ?? 1}-${f.kind}-${f.page ?? ""}`;
    if (seen.has(k) && f.kind !== "design") outdated.add(f.id);
    seen.add(k);
  }

  // File theo từng dòng sản phẩm (và từng bản nếu "Mỗi bản khác nhau")
  const groupKey = (f: (typeof files)[number]) => `${f.order_item_id ?? ""}|${f.copy_no ?? 1}`;
  const groups = [...new Set(files.map(groupKey))].map((key) => {
    const [itemId, copy] = key.split("|");
    const ln = lines.find((l) => l.id === itemId);
    const title = ln ? `${ln.package_name} × ${ln.quantity}${ln.copies_mode === "different" ? ` · Bản ${copy}` : ""}` : "";
    return { key, title, group: files.filter((f) => groupKey(f) === key) };
  }).sort((a, b) => a.title.localeCompare(b.title));

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
                <a className="break-all text-[#ff5fa2] hover:text-[#e0468a]" href={order.music_link} target="_blank" rel="noreferrer">{order.music_link}</a>
              </p>
            )}
            {files.length ? (
              <div className="space-y-5">
                {groups.map(({ key, title, group }) => (
                  <div key={key}>
                    {groups.length > 1 || title ? <p className="mb-2 text-[13px] font-semibold text-[#18181b]">{title || "Chưa gắn dòng sản phẩm"} <span className="font-normal text-[#71717a]">({group.length} file)</span></p> : null}
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {group.map((f) => {
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
                        {url && <a className="mt-1 inline-block font-medium text-[#ff5fa2] hover:text-[#e0468a]" href={`${url}&download=${encodeURIComponent(f.file_name)}`}>Tải file gốc</a>}
                      </div>
                    </li>
                  );
                })}
              </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-[#71717a]">Khách chưa gửi file in nào.</p>
            )}
          </Card>
          <OrderControls order={order} fileCount={files.length} paths={files.map((f) => f.storage_path)} />
        </div>

        <div className="space-y-4">
          <PaymentCard order={order} payments={payments} />
          <Card title="Khách hàng">
            <p className="font-medium text-[#18181b]">{order.customer_name}</p>
            <p className="mt-1 text-[14px]">
              <a className="text-[#ff5fa2] hover:text-[#e0468a]" href={`tel:${order.phone}`}>{order.phone}</a>
              <span className="text-[#d4d4d8]"> · </span>
              <a className="text-[#ff5fa2] hover:text-[#e0468a]" href={`https://zalo.me/${order.phone.replace(/^\+84/, "0")}`} target="_blank" rel="noreferrer">Zalo</a>
            </p>
            {order.street || order.ward || order.province ? (
              <div className="mt-2 text-[13px] text-[#52525b]">
                {order.street && <p>{order.street}</p>}
                {(order.ward || order.province) && <p>{[order.ward, order.province].filter(Boolean).join(", ")}</p>}
              </div>
            ) : order.address && <p className="mt-2 whitespace-pre-line text-[13px] text-[#52525b]">{order.address}</p>}
            {order.note && (
              <div className="mt-4 border-t border-[#efeff1] pt-3">
                <p className="text-[12px] font-medium text-[#71717a]">Ghi chú của khách</p>
                <p className="mt-1 whitespace-pre-line text-[13px] text-[#18181b]">{order.note}</p>
              </div>
            )}
          </Card>
          <Card title="Sản phẩm">
            {lines.length > 0 ? (
              <ul className="space-y-2 text-[14px]">
                {lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <span className="min-w-0 text-[#3f3f46]">
                      {l.product_name ? <><b className="font-medium text-[#18181b]">{l.product_name}</b> × {l.quantity}</> : <>{l.package_name} × {l.quantity}</>} <span className="text-[12px] text-[#a1a1aa]">({formatVND(l.unit_price)}/bộ)</span>
                      {l.product_name && (l.options ?? []).length > 0 && (
                        <span className="block text-[12px] text-[#71717a]">{(l.options ?? []).map((o) => `${o.group ? `${o.group}: ` : ""}${o.name} (${formatVND(o.price)})`).join(" · ")}</span>
                      )}
                      {!l.product_name && l.addons.length > 0 && <span className="block text-[12px] text-[#71717a]">+ {l.addons.map((a) => `${a.name} × ${a.qty} (${formatVND(a.price)})`).join(", ")}</span>}
                    </span>
                    <span className="shrink-0">{formatVND(l.line_total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
            <ul className="space-y-1.5 text-[14px]">
              {order.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-[#3f3f46]">{it.type === "addon" ? "+ " : ""}{it.name} × {it.qty}</span>
                  <span>{formatVND(it.price * it.qty)}</span>
                </li>
              ))}
              {!order.items.length && <li className="text-[#71717a]">(không có)</li>}
            </ul>
            )}
            <div className="mt-3 space-y-1 border-t border-[#efeff1] pt-3 text-[14px]">
              {((order.discount_amount ?? 0) > 0 || (order.shipping_fee ?? 0) > 0 || order.shipping_free) && (
                <>
                  <p className="flex justify-between text-[#3f3f46]"><span>Tiền hàng</span><span>{formatVND(order.subtotal ?? order.total + (order.discount_amount ?? 0))}</span></p>
                  {(order.discount_amount ?? 0) > 0 && <p className="flex justify-between gap-2 text-[#ff5fa2]">
                    <span className="min-w-0">Giảm tiền hàng{order.discount_code ? ` · mã ${order.discount_code}` : " · toàn shop"}{order.discount_label && order.discount_label !== order.discount_code ? ` (${order.discount_label})` : ""}</span>
                    <span>−{formatVND(order.discount_amount ?? 0)}</span>
                  </p>}
                </>
              )}
              {(order.shipping_fee ?? 0) > 0 || order.shipping_free || (order.shipping_base ?? 0) > 0 ? (
                <>
                  <p className="flex justify-between gap-2 text-[#3f3f46]">
                    <span>Phí vận chuyển{(order.shipping_tier_percent ?? 0) > 0 ? ` (ưu đãi ${order.shipping_tier_percent}%)` : ""}</span>
                    <span>{(order.shipping_base ?? 0) > (order.shipping_after_tier ?? order.shipping_fee ?? 0) && <span className="mr-1 text-[12px] text-[#a1a1aa] line-through">{formatVND(order.shipping_base ?? 0)}</span>}
                      {(order.shipping_after_tier ?? order.shipping_fee ?? 0) === 0 ? "Miễn phí" : formatVND(order.shipping_after_tier ?? order.shipping_fee ?? 0)}</span>
                  </p>
                  {(order.ship_discount_amount ?? 0) > 0 && (
                    <p className="flex justify-between gap-2 text-[#ff5fa2]"><span>Giảm phí vận chuyển{order.ship_discount_code ? ` · mã ${order.ship_discount_code}` : ""}{order.ship_discount_label && order.ship_discount_label !== order.ship_discount_code ? ` (${order.ship_discount_label})` : ""}</span><span>−{formatVND(order.ship_discount_amount ?? 0)}</span></p>
                  )}
                </>
              ) : null}
                            <p className="flex justify-between font-semibold"><span>Tổng</span><span>{formatVND(order.total)}</span></p>
            </div>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
