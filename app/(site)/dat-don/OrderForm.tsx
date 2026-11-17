"use client";

/* Trang Đặt đơn — 3 bước: 1. Chọn sản phẩm → 2. Thông tin nhận hàng → 3. Thanh toán.
   Bước 1 có "Thêm vào giỏ" và "Mua ngay". Đơn chỉ được tạo khi bấm "Đặt hàng" ở bước 2.
   Bước 1–2 lưu tạm vào localStorage để refresh không mất. */
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Check, Disc3, ShoppingCart } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { cart } from "@/lib/cart";
import { unitPrice, type PublicDiscount } from "@/lib/discount";
import type { PaymentSettings } from "@/lib/payment/settings";
import { toast } from "@/components/ui/kit";
import { btnClass, cx } from "@/components/ui/styles";
import { BottomBar, DoneStep, InfoStep, Price, Progress, Qty, emptyForm, submitOrder, useAutofill, useCheckout, type Form, type Line, type Step } from "./checkout";

type Draft = { step: 1 | 2; packageId: string; pkgQty: number; addonQty: Record<string, number>; form: Form; code: string; autoOff: boolean };
const DRAFT_KEY = "taylana-dat-don";

const imagesOf = (p?: Package) => {
  if (!p) return [];
  const list = (p.images ?? []).filter(Boolean);
  return list.length ? list : p.image_url ? [p.image_url] : [];
};

// Giá to (khối dưới ảnh / điện thoại): giá mới hồng 28px, giá cũ gạch xám 16px + badge −x%
function BigPrice({ price, now }: { price: number; now: number }) {
  const off = now < price ? Math.round(((price - now) / price) * 100) : 0;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="text-[28px] font-bold leading-none tracking-[-0.01em] text-[#ff5fa2]">{formatVND(now)}</span>
      {off > 0 && (
        <>
          <span className="text-[16px] text-[#a1a1aa] line-through">{formatVND(price)}</span>
          <span className="rounded-[4px] bg-[#fff0f6] px-1.5 py-0.5 text-[12px] font-semibold text-[#ff5fa2]">−{off}%</span>
        </>
      )}
    </p>
  );
}

export function OrderForm({ packages, addons, discounts, payment }: { packages: Package[]; addons: Addon[]; discounts: PublicDiscount[]; payment: PaymentSettings | null }) {
  const params = useSearchParams();
  const pre = params.get("goi");
  const [step, setStep] = useState<Step>(1);
  const [packageId, setPackageId] = useState<string>(packages.some((p) => p.id === pre) ? pre! : packages[0]?.id ?? "");
  const [pkgQty, setPkgQty] = useState(1);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [form, setForm] = useState<Form>(emptyForm);
  const [imgIdx, setImgIdx] = useState(0);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; total: number } | null>(null);
  const [draft, setDraft] = useState<{ code: string; autoOff: boolean } | null>(null);
  const restored = useRef(false);

  const pkg = packages.find((p) => p.id === packageId);
  const images = imagesOf(pkg);
  const lines = useMemo<Line[]>(() => (pkg ? [{
    key: "now", pkg, qty: pkgQty,
    addons: addons.filter((a) => (addonQty[a.id] ?? 0) > 0).map((a) => ({ addon: a, qty: addonQty[a.id] })),
  }] : []), [pkg, pkgQty, addons, addonQty]);

  // ---------- khôi phục / lưu tạm ----------
  useEffect(() => {
    let code = "", autoOff = false;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null;
      if (d) {
        if (!pre && packages.some((p) => p.id === d.packageId)) setPackageId(d.packageId);
        setPkgQty(Math.max(1, d.pkgQty || 1));
        setAddonQty(Object.fromEntries(Object.entries(d.addonQty || {}).filter(([id]) => addons.some((a) => a.id === id))));
        setForm({ ...emptyForm, ...d.form });
        code = d.code || ""; autoOff = !!d.autoOff;
        if (d.step === 2) setStep(2);
      }
    } catch { /* bỏ qua */ }
    setDraft({ code, autoOff });
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useAutofill(setForm);

  if (!draft) return <div className="min-h-[60vh]" />;
  return (
    <Inner {...{ packages, addons, discounts, payment, step, setStep, packageId, setPackageId, pkgQty, setPkgQty, addonQty, setAddonQty,
      form, setForm, imgIdx, setImgIdx, error, setError, sending, setSending, result, setResult, pkg, images, lines, draft, restored }} />
  );
}

type InnerProps = {
  packages: Package[]; addons: Addon[]; discounts: PublicDiscount[]; payment: PaymentSettings | null;
  step: Step; setStep: (s: Step) => void; packageId: string; setPackageId: (s: string) => void;
  pkgQty: number; setPkgQty: (n: number) => void; addonQty: Record<string, number>; setAddonQty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  form: Form; setForm: (f: Form) => void; imgIdx: number; setImgIdx: (n: number) => void;
  error: string; setError: (s: string) => void; sending: boolean; setSending: (b: boolean) => void;
  result: { code: string; total: number } | null; setResult: (r: { code: string; total: number }) => void;
  pkg?: Package; images: string[]; lines: Line[]; draft: { code: string; autoOff: boolean }; restored: React.RefObject<boolean>;
};

function Inner(p: InnerProps) {
  const { packages, addons, discounts, payment, step, setStep, packageId, setPackageId, pkgQty, setPkgQty, addonQty, setAddonQty,
    form, setForm, imgIdx, setImgIdx, error, setError, sending, setSending, result, setResult, pkg, images, lines, draft } = p;
  const co = useCheckout({ lines, discounts, phone: form.phone, initialCode: draft.code, initialAutoOff: draft.autoOff });

  useEffect(() => {
    if (!p.restored.current || step === 3) return;
    try {
      const d: Draft = { step, packageId, pkgQty, addonQty, form, code: co.savedCode, autoOff: co.autoOff };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* bỏ qua */ }
  }, [step, packageId, pkgQty, addonQty, form, co.savedCode, co.autoOff, p.restored]);

  function go(s: Step) { setError(""); setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function buyNow() { if (!pkg) return setError("Bạn chưa chọn gói sản phẩm."); go(2); }
  function addToCart() {
    if (!pkg) return setError("Bạn chưa chọn gói sản phẩm.");
    cart.add({ package_id: pkg.id, quantity: pkgQty, unit_price: pkg.price,
      addons: Object.entries(addonQty).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })) });
    toast("Đã thêm vào giỏ", "ok", { label: "Xem giỏ", href: "/gio-hang" });
  }
  async function submit() {
    setError(""); setSending(true);
    try {
      const r = await submitOrder(lines, form, { code: co.privCode, autoOff: co.autoOff });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ }
      setResult(r); go(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Gửi đơn thất bại"); }
    setSending(false);
  }

  if (!packages.length) return <p className="mx-auto max-w-md px-4 py-16 text-center text-[#71717a]">Tiệm đang cập nhật bảng giá, bạn quay lại sau hoặc nhắn tiệm qua Zalo nhé!</p>;

  const now = pkg ? unitPrice(co.list, { type: "package", id: pkg.id, price: pkg.price }) : 0;
  const label = "w-[84px] shrink-0 pt-2 text-[14px] text-[#71717a]";
  const bar = (btn: React.ReactNode) => <BottomBar total={co.total} subtotal={co.subtotal}>{btn}</BottomBar>;
  const errBox = error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>;
  const choose = (id: string) => { if (id !== packageId) { setPackageId(id); setImgIdx(0); setPkgQty(1); } };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:pb-12 md:pt-6">
      <div className="mb-5 md:mb-7"><Progress step={step} onGo={go} /></div>

      {step === 1 && (
        <div className="grid gap-6 md:grid-cols-[55fr_45fr] md:gap-10">
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
            {/* Máy tính: tên gói + giá ngay dưới ảnh */}
            {pkg && (
              <div key={pkg.id} className="mt-5 hidden animate-[fadeIn_.35s_ease] md:block">
                <h1 className="font-sans text-[22px] font-semibold normal-case leading-tight tracking-[-0.01em] text-[#18181b]">{pkg.name}</h1>
                <div className="mt-2"><BigPrice price={pkg.price} now={now} /></div>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-5">
            {/* Điện thoại: giá ngay trên các pill */}
            {pkg && <div className="md:hidden"><p className="mb-1 text-[16px] font-semibold text-[#18181b]">{pkg.name}</p><BigPrice price={pkg.price} now={now} /></div>}

            <div className="flex gap-3">
              <span className={label}>Loại</span>
              <div className="flex flex-1 flex-wrap gap-2" role="radiogroup" aria-label="Chọn gói">
                {packages.map((x) => {
                  const on = x.id === packageId;
                  return (
                    <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => choose(x.id)}
                      className={cx("relative h-9 overflow-hidden rounded-[6px] border bg-white px-3 text-[14px] transition-colors",
                        on ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#18181b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]")}>
                      {x.name}
                      {on && (
                        <span className="absolute bottom-0 right-0 grid h-[14px] w-[16px] place-items-center rounded-tl-[6px] bg-[#ff5fa2]">
                          <Check size={9} strokeWidth={4} className="text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-[84px] shrink-0 text-[14px] text-[#71717a]">Số lượng</span>
              <Qty value={pkgQty} min={1} onChange={setPkgQty} />
            </div>

            {addons.length > 0 && (
              <div className="flex gap-3">
                <span className={label}>Mua kèm</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {addons.map((a) => {
                    const q = addonQty[a.id] ?? 0;
                    const setQ = (v: number) => setAddonQty((cur) => ({ ...cur, [a.id]: v }));
                    return (
                      <div key={a.id} onClick={() => { if (!q) setQ(1); }}
                        className={cx("flex cursor-pointer items-center gap-2.5 rounded-[6px] border bg-white py-1.5 pl-3 pr-1.5 text-[14px] transition-colors",
                          q ? "border-[#ff5fa2]" : "border-[#e5e5e7] hover:border-[#d4d4d8]")}>
                        <span className={cx("min-w-0 flex-1 truncate", q ? "text-[#ff5fa2]" : "text-[#18181b]")}>{a.name}</span>
                        <span className="shrink-0 text-[13px] text-[#71717a]">+<Price price={a.price} now={unitPrice(co.list, { type: "addon", id: a.id, price: a.price })} className="!font-normal !text-[#71717a]" /></span>
                        <Qty value={q} onChange={setQ} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {co.summary()}
            {co.discountBox}
            {errBox}
            <div className="hidden gap-2 md:flex">
              <button type="button" onClick={addToCart} className={cx(btnClass("secondary"), "h-12 flex-1 !border-[#ff5fa2] text-[15px] font-semibold !text-[#ff5fa2] hover:!bg-[#fff0f6]")}>
                <ShoppingCart size={16} /> Thêm vào giỏ
              </button>
              <button type="button" onClick={buyNow} className={cx(btnClass("primary"), "h-12 flex-1 text-[15px] font-semibold")}>Mua ngay</button>
            </div>
          </div>
          {bar(
            <div className="flex flex-1 gap-2">
              <button type="button" onClick={addToCart} aria-label="Thêm vào giỏ" className={cx(btnClass("secondary"), "h-11 !border-[#ff5fa2] !px-3 !text-[#ff5fa2]")}><ShoppingCart size={18} /></button>
              <button type="button" onClick={buyNow} className={cx(btnClass("primary"), "h-11 flex-1 text-[15px] font-semibold")}>Mua ngay</button>
            </div>,
          )}
        </div>
      )}

      {step === 2 && (
        <InfoStep form={form} setForm={setForm} summary={co.summary(true)} error={error} sending={sending}
          onBack={() => go(1)} onSubmit={submit} bottomBar={bar} />
      )}

      {step === 3 && result && <DoneStep result={result} payment={payment} />}
    </div>
  );
}
