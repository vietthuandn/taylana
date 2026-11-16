import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import type { Order, OrderFile } from "@/lib/types";
import { formatBytes, formatDate, formatVND, orderTypeLabels } from "@/lib/format";
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
  const { data: filesData } = await supabase.from("order_files").select("*").eq("order_id", id).order("kind").order("page");
  const files = (filesData ?? []) as OrderFile[];

  // Link tải tạm thời (hết hạn sau 1 giờ) cho file trong bucket riêng tư
  const signed = new Map<string, string>();
  if (files.length) {
    const { data } = await supabase.storage.from("order-files").createSignedUrls(files.map((f) => f.storage_path), 3600);
    data?.forEach((d) => d.path && d.signedUrl && signed.set(d.path, d.signedUrl));
  }

  return (
    <div className="max-w-3xl">
      <Link href="/admin/don-hang" className="text-sm underline">← Danh sách đơn</Link>
      <h1 className="mt-2 text-3xl">Đơn {order.code}</h1>
      <p className="text-sm text-cocoa-400">{orderTypeLabels[order.order_type]} · đặt lúc {formatDate(order.created_at)}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="pop-sm rounded-3xl bg-cream-50 p-4">
          <h2 className="mb-2 text-xl">Khách hàng</h2>
          <p><b>{order.customer_name}</b></p>
          <p>
            <a className="underline" href={`tel:${order.phone}`}>{order.phone}</a> ·{" "}
            <a className="underline" href={`https://zalo.me/${order.phone.replace(/^\+84/, "0")}`} target="_blank" rel="noreferrer">Zalo</a>
          </p>
          {order.address && <p className="mt-1 whitespace-pre-line text-sm">{order.address}</p>}
          {order.note && (
            <p className="mt-3 whitespace-pre-line rounded-xl bg-butter-100 p-2 text-sm"><b>Ghi chú:</b> {order.note}</p>
          )}
        </div>

        <div className="pop-sm rounded-3xl bg-cream-50 p-4">
          <h2 className="mb-2 text-xl">Sản phẩm</h2>
          <ul className="space-y-1 text-sm">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{it.type === "addon" ? "+ " : ""}{it.name} × {it.qty}</span>
                <span>{formatVND(it.price * it.qty)}</span>
              </li>
            ))}
            {!order.items.length && <li className="text-cocoa-400">(không có)</li>}
          </ul>
          <p className="mt-2 flex justify-between border-t-2 border-dashed border-cocoa-300 pt-2 font-bold">
            <span>Tạm tính</span><span className="text-pink-500">{formatVND(order.total)}</span>
          </p>
        </div>
      </div>

      <OrderControls order={order} fileCount={files.length} paths={files.map((f) => f.storage_path)} />

      <section className="mt-6">
        <h2 className="mb-2 text-xl">File của khách ({files.length})</h2>
        {order.music_link && (
          <p className="mb-3 text-sm">
            🎵 File nhạc: <a className="break-all underline" href={order.music_link} target="_blank" rel="noreferrer">{order.music_link}</a>
          </p>
        )}
        {order.files_cleaned_at && <p className="mb-3 text-sm text-cocoa-400">File đã được dọn lúc {formatDate(order.files_cleaned_at)}.</p>}
        {files.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {files.map((f) => {
              const url = signed.get(f.storage_path);
              const isImg = f.mime_type.startsWith("image/");
              return (
                <li key={f.id} className="pop-sm overflow-hidden rounded-2xl bg-white">
                  <div className="grid aspect-square place-items-center bg-cream-200">
                    {isImg && url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={f.file_name} className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="font-display text-2xl">PDF</span>
                    )}
                  </div>
                  <div className="p-2 text-xs">
                    <p className="font-bold">{kindLabels[f.kind] ?? f.kind}{f.page ? ` · trang ${f.page}` : ""}</p>
                    <p className="truncate">{f.file_name}</p>
                    <p className="text-cocoa-400">
                      {formatBytes(f.size_bytes)}{f.width_px ? ` · ${f.width_px}×${f.height_px}px` : ""}
                    </p>
                    {url && <a className="mt-1 inline-block underline" href={`${url}&download=${encodeURIComponent(f.file_name)}`}>Tải file gốc</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-cocoa-400">Khách chưa nộp file nào.</p>
        )}
      </section>
    </div>
  );
}
