"use client";

/* Trang Đặt đơn — 1 trang: ảnh gói (trái, dính khi cuộn) | chọn gói, phụ kiện, số lượng, thông tin, tóm tắt (phải). */
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Disc3, Minus, Plus, Upload, Brush } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { Button, Field, Input, Textarea } from "@/components/ui/kit";
import { btnClass, cx } from "@/components/ui/styles";

type Result = { code: string; total: number };

// ảnh của gói: danh sách images (ảnh đầu là ảnh chính), không có thì dùng image_url cũ
const imagesOf = (p?: Package) => {
  if (!p) return [];
  const list = (p.images ?? []).filter(Boolean);
  return list.length ? list : p.image_url ? [p.image_url] : [];
};
// mô tả ngắn những gì có trong gói
const summaryOf = (p: Package) => p.description || p.features.join(" · ");

export function OrderForm({ packages, addons, payment = false }: { packages: Package[]; addons: Addon[]; payment?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pre = params.get("goi");
  const [packageId, setPackageId] = useState<string>(packages.some((p) => p.id === pre) ? pre! : packages[0]?.id ?? "");
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const pkg = packages.find((p) => p.id === packageId);
  const images = imagesOf(pkg);
  const chosenAddons = addons.filter((a) => picked.has(a.id));
  const total = useMemo(() => (pkg ? pkg.price * qty : 0) + chosenAddons.reduce((t, a) => t + a.price, 0), [pkg, qty, chosenAddons]);

  // khách đã đăng nhập → tự điền tên và SĐT
  useEffect(() => {
    if (!hasSupabase) return;
    createClient().auth.getUser().then(({ data }) => {
      const m = data.user?.user_metadata;
      if (!m) return;
      setForm((f) => ({ ...f, name: f.name || (m.display_name as string) || "", phone: f.phone || (m.phone as string) || "" }));
    });
  }, []);

  function choose(id: string) { setPackageId(id); setImgIdx(0); }
  function toggleAddon(id: string) {
    setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pkg) return setError("Bạn chưa chọn gói sản phẩm.");
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 8) {
      setError("Vui lòng nhập tên và số điện thoại/Zalo hợp lệ.");
      document.getElementById("thong-tin")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!hasSupabase) return setError("Web chưa kết nối database.");
    setSending(true);
    const { data, error } = await createClient().rpc("create_order", {
      p_customer_name: form.name,
      p_phone: form.phone,
      p_address: form.address,
      p_note: form.note,
      p_package_id: pkg.id,
      p_quantity: qty,
      p_addons: [...picked].map((id) => ({ id, qty: 1 })),
      p_order_type: "cd",
    });
    setSending(false);
    if (error || !data?.[0]) return setError(error?.message ?? "Gửi đơn thất bại, bạn thử lại nhé.");
    // thanh toán QR đang bật → sang trang thanh toán của đơn
    if (payment) { setSending(true); router.push(`/thanh-toan/${encodeURIComponent(data[0].order_code)}`); return; }
    setResult({ code: data[0].order_code, total: data[0].order_total });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) return <Success result={result} />;

  if (!packages.length) {
    return <p className="mx-auto max-w-md px-4 py-16 text-center text-[#71717a]">Tiệm đang cập nhật bảng giá, bạn quay lại sau hoặc nhắn tiệm qua Zalo nhé!</p>;
  }

  const label = "mb-2.5 text-[15px] font-semibold text-[#18181b]";
  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-28 pt-4 md:grid-cols-[55fr_45fr] md:gap-10 md:pb-12 md:pt-8">
      {/* ---------- Ảnh gói ---------- */}
      <div className="md:sticky md:top-24 md:self-start">
        <div className="relative aspect-square w-full overflow-hidden rounded-[16px] border border-[#e5e5e7] bg-white">
          {images[imgIdx] ? (
            <Image key={`${packageId}-${imgIdx}`} src={images[imgIdx]} alt={pkg?.name ?? ""} fill priority
              sizes="(min-width:768px) 600px, 100vw" className="animate-[fadeIn_.35s_ease] object-cover" />
          ) : (
            <div key={packageId} className="grid h-full animate-[fadeIn_.35s_ease] place-items-center bg-[#f4f4f5]">
              <Disc3 size={96} strokeWidth={1} className="text-[#d4d4d8]" />
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button key={src + i} type="button" onClick={() => setImgIdx(i)} aria-label={`Ảnh ${i + 1}`}
                className={cx("relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border-2 bg-white transition", i === imgIdx ? "border-[#ff5fa2]" : "border-transparent opacity-70 hover:opacity-100")}>
                <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Thông tin đặt ---------- */}
      <div className="min-w-0 space-y-7">
        <div>
          <h1 className="font-sans text-[22px] font-bold normal-case leading-tight tracking-[-0.02em] text-[#18181b] sm:text-[28px]">{pkg?.name ?? "Đặt đơn"}</h1>
          {pkg && <p className="mt-1 text-[20px] font-semibold text-[#ff5fa2]">{formatVND(pkg.price)}</p>}
          {pkg && summaryOf(pkg) && <p className="mt-2 text-[15px] text-[#71717a]">{summaryOf(pkg)}</p>}
        </div>

        <section>
          <p className={label}>Chọn gói</p>
          <div className="space-y-2" role="radiogroup">
            {packages.map((p) => {
              const on = p.id === packageId;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => choose(p.id)}
                  className={cx("flex w-full items-center gap-3 rounded-[10px] border bg-white px-3.5 py-3 text-left transition-colors",
                    on ? "border-[#ff5fa2] ring-[3px] ring-[#ff5fa2]/15" : "border-[#e5e5e7] hover:border-[#d4d4d8]")}>
                  <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-[#ff5fa2] bg-[#ff5fa2] text-white" : "border-[#d4d4d8]")}>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#18181b]">{p.name}</span>
                    {summaryOf(p) && <span className="block truncate text-[12px] text-[#71717a]">{summaryOf(p)}</span>}
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold text-[#18181b]">{formatVND(p.price)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {addons.length > 0 && (
          <section>
            <p className={label}>Phụ kiện mua kèm <span className="text-[13px] font-normal text-[#71717a]">· không bắt buộc</span></p>
            <div className="divide-y divide-[#efeff1] overflow-hidden rounded-[10px] border border-[#e5e5e7] bg-white">
              {addons.map((a) => {
                const on = picked.has(a.id);
                return (
                  <label key={a.id} className="flex cursor-pointer items-center gap-3 px-3.5 py-3 hover:bg-[#fafafa]">
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#ff5fa2]" checked={on} onChange={() => toggleAddon(a.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-[#18181b]">{a.name}</span>
                      {a.description && <span className="block truncate text-[12px] text-[#71717a]">{a.description}</span>}
                    </span>
                    <span className="shrink-0 text-[14px] text-[#3f3f46]">+{formatVND(a.price)}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <p className={label}>Số lượng</p>
          <div className="inline-flex h-9 items-center rounded-[8px] border border-[#e5e5e7] bg-white">
            <button type="button" className="grid h-full w-9 place-items-center text-[#3f3f46] hover:bg-[#f4f4f5] disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Giảm"><Minus size={16} /></button>
            <span className="w-10 text-center text-[14px] font-medium tabular-nums">{qty}</span>
            <button type="button" className="grid h-full w-9 place-items-center text-[#3f3f46] hover:bg-[#f4f4f5] disabled:opacity-40" disabled={qty >= 1000} onClick={() => setQty(qty + 1)} aria-label="Tăng"><Plus size={16} /></button>
          </div>
        </section>

        <section id="thong-tin" className="scroll-mt-24">
          <p className={label}>Thông tin nhận hàng</p>
          <div className="grid gap-4 rounded-[12px] border border-[#e5e5e7] bg-white p-4 sm:grid-cols-2">
            <Field label="Tên của bạn *">
              <Input required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Số điện thoại / Zalo *">
              <Input required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Địa chỉ nhận hàng" className="sm:col-span-2">
              <Textarea rows={2} maxLength={500} autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Ghi chú cho tiệm" className="sm:col-span-2">
              <Textarea rows={3} maxLength={2000} placeholder="Ví dụ: tên album, màu sắc mong muốn, ngày cần nhận..."
                value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="rounded-[12px] border border-[#e5e5e7] bg-white p-4 text-[14px]">
          <p className="mb-3 text-[15px] font-semibold text-[#18181b]">Tóm tắt</p>
          <div className="space-y-1.5 text-[#3f3f46]">
            {pkg && <p className="flex justify-between gap-3"><span className="min-w-0 truncate">{pkg.name} × {qty}</span><span>{formatVND(pkg.price * qty)}</span></p>}
            {chosenAddons.map((a) => (
              <p key={a.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">+ {a.name}</span><span>{formatVND(a.price)}</span></p>
            ))}
          </div>
          <p className="mt-3 flex items-baseline justify-between border-t border-[#efeff1] pt-3">
            <span className="font-medium text-[#18181b]">Tổng tiền</span>
            <span className="text-[20px] font-bold text-[#18181b]">{formatVND(total)}</span>
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">Chưa gồm phí ship — tiệm sẽ báo khi xác nhận đơn qua Zalo/SĐT.</p>
        </section>

        {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}

        <button type="submit" disabled={sending} className={cx(btnClass("primary"), "hidden h-12 w-full text-[16px] font-semibold md:inline-flex")}>
          {sending ? "Đang gửi..." : "Đặt hàng"}
        </button>
      </div>

      {/* ---------- Điện thoại: thanh tổng tiền cố định ở đáy ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5e7] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 leading-tight">
            <span className="block text-[12px] text-[#71717a]">Tổng tiền</span>
            <span className="block text-[18px] font-bold text-[#18181b]">{formatVND(total)}</span>
          </div>
          <button type="submit" disabled={sending} className={cx(btnClass("primary"), "h-11 flex-1 text-[15px] font-semibold")}>
            {sending ? "Đang gửi..." : "Đặt hàng"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Success({ result }: { result: Result }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="mx-auto w-full max-w-lg px-4 py-12">
      <div className="rounded-[16px] border border-[#e5e5e7] bg-white p-6 text-center sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#fff0f6] text-[#ff5fa2]"><Check size={24} /></span>
        <h1 className="mt-4 font-sans text-[22px] font-bold normal-case tracking-[-0.02em] text-[#18181b] sm:text-[28px]">Cảm ơn bạn đã đặt hàng!</h1>
        <p className="mt-1 text-[15px] text-[#71717a]">Mã đơn của bạn</p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] py-2 pl-4 pr-2">
          <span className="text-[22px] font-semibold tracking-wide text-[#18181b]">{result.code}</span>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Sao chép mã đơn"
            onClick={() => { navigator.clipboard?.writeText(result.code); setCopied(true); }}>
            {copied ? <Check size={16} className="text-[#16a34a]" /> : <Copy size={16} />}
          </button>
        </div>
        <p className="mt-4 text-[14px] text-[#3f3f46]">Tạm tính: <b>{formatVND(result.total)}</b></p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-[#71717a]">
          Lưu lại mã đơn nhé. Tiệm sẽ liên hệ qua Zalo/SĐT để xác nhận và báo phí ship.
        </p>
        <div className="mt-6 border-t border-[#efeff1] pt-5">
          <p className="mb-3 text-[13px] font-medium text-[#18181b]">Bước tiếp theo</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button href={`/gui-file-in?ma=${encodeURIComponent(result.code)}`} icon={<Upload size={16} />}>Gửi file in</Button>
            <Button href="/custom-cd" variant="secondary" icon={<Brush size={16} />}>Tự thiết kế CD</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
