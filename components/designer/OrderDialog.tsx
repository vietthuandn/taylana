"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { formatVND } from "@/lib/format";
import type { Package } from "@/lib/types";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { saveOrderCode } from "@/lib/cart";

export type DesignFile = { kind: string; blob: Blob; name: string; page?: number | null };

// Hộp thoại gửi đơn kèm file thiết kế (Custom CD / Photostrip)
export function OrderDialog({ orderType, title, packages = [], quantityLabel, getFiles, onClose, initialPackageId }: {
  orderType: "custom_cd" | "photostrip";
  title: string;
  packages?: Package[];
  quantityLabel?: string; // ví dụ "Số bản in"
  getFiles: () => Promise<DesignFile[]>;
  onClose: () => void;
  initialPackageId?: string; // chọn sẵn gói
}) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [packageId, setPackageId] = useState(initialPackageId ?? "");
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ code: string; files: number } | null>(null);
  const pkg = packages.find((p) => p.id === packageId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Vui lòng nhập tên.");
    if (!normalizePhone(form.phone)) return setError(PHONE_ERROR);
    if (!hasSupabase) return setError("Web chưa kết nối database.");
    try {
      setStep("Đang xuất file 300 DPI...");
      const files = await getFiles();
      if (!files.length) throw new Error("Bạn chưa thiết kế gì cả.");

      setStep("Đang tạo đơn...");
      const sb = createClient();
      const note = [quantityLabel && !pkg ? `${quantityLabel}: ${qty}` : "", form.note].filter(Boolean).join("\n");
      const { data, error } = await sb.rpc("create_order", {
        p_customer_name: form.name, p_phone: normalizePhone(form.phone), p_address: form.address, p_note: note,
        p_package_id: pkg?.id ?? null, p_quantity: qty, p_addons: [], p_order_type: orderType,
      });
      if (error || !data?.[0]) throw new Error(error?.message ?? "Không tạo được đơn");
      const { order_id, order_code } = data[0];
      saveOrderCode(order_code); // để xem trong "Đơn hàng của tôi" và gửi thêm file

      let n = 0;
      for (const f of files) {
        n++;
        setStep(`Đang gửi file ${n}/${files.length}...`);
        const path = `${order_id}/${f.kind}-thiet-ke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
        const up = await sb.storage.from("order-files").upload(path, f.blob, { contentType: "image/png", upsert: false });
        if (up.error) throw new Error("Gửi file thất bại: " + up.error.message);
        const bmp = await createImageBitmap(f.blob);
        const reg = await sb.rpc("register_order_file", {
          p_order_id: order_id, p_kind: f.kind, p_storage_path: path, p_file_name: f.name,
          p_mime_type: "image/png", p_size_bytes: f.blob.size, p_page: f.page ?? null, p_width_px: bmp.width, p_height_px: bmp.height,
        });
        bmp.close();
        if (reg.error) throw new Error(reg.error.message);
      }
      setDone({ code: order_code, files: files.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi, bạn thử lại nhé.");
    }
    setStep("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink-900/50 sm:place-items-center" role="dialog" aria-modal>
      <div className="pop max-h-[92dvh] w-full overflow-auto rounded-t-[2rem] bg-cream-50 p-5 sm:max-w-lg sm:rounded-[2rem]">
        {done ? (
          <div className="py-4 text-center">
            <h2 className="text-3xl">Tiệm đã nhận đơn! ✿</h2>
            <p className="mt-2 text-ink-600">Mã đơn của bạn:</p>
            <p className="pop-sm mx-auto mt-2 inline-block rounded-2xl bg-white px-5 py-2 font-display text-3xl">{done.code}</p>
            <p className="mt-3 text-sm text-ink-600">Đã gửi {done.files} file thiết kế. Tiệm sẽ nhắn bạn qua Zalo/SĐT để xác nhận và báo giá.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {orderType === "custom_cd" && (
                <Link href={`/gui-file?don=${encodeURIComponent(done.code)}`} className="btn !text-base">Gửi link nhạc / file khác →</Link>
              )}
              <Link href="/don-hang-cua-toi" className="btn btn-ghost !text-base">Xem đơn hàng của tôi</Link>
              <button className="btn btn-ghost !text-base" onClick={onClose}>Đóng</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl">{title}</h2>
              <button type="button" className="text-2xl leading-none" onClick={onClose} aria-label="Đóng">✕</button>
            </div>

            {packages.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Gói sản phẩm</span>
                <select className="field" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  <option value="">Chưa chọn — tiệm tư vấn sau</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatVND(p.price)}</option>)}
                </select>
              </label>
            )}
            {(pkg || quantityLabel) && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{pkg ? "Số lượng" : quantityLabel}</span>
                <input className="field" type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
              </label>
            )}
            {pkg && <p className="text-sm">Tạm tính: <b className="text-hot-500">{formatVND(pkg.price * qty)}</b></p>}

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Tên của bạn *</span>
              <input className="field" required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Số điện thoại / Zalo *</span>
              <input className="field" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Địa chỉ nhận hàng</span>
              <textarea className="field" rows={2} maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Ghi chú</span>
              <textarea className="field" rows={2} maxLength={1800} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>

            {error && <p className="rounded-xl bg-hot-100 px-3 py-2 text-sm text-hot-500">{error}</p>}
            <button type="submit" className="btn w-full" disabled={!!step}>{step || "Gửi đơn ♡"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
