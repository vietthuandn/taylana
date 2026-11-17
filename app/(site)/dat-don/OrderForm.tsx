"use client";

/* Trang Đặt đơn — 3 bước: 1. Chọn sản phẩm → 2. Thông tin nhận hàng → 3. Thanh toán.
   Máy tính: trái 7/12 (ảnh) · phải 5/12 (Loại → Mua kèm → Số lượng → Mã giảm giá → Tạm tính → thanh hành động).
   Mỗi phụ kiện được chọn tính 1 cái cho mỗi bộ sản phẩm (nhân theo Số lượng).
   Đơn chỉ được tạo khi bấm "Đặt hàng" ở bước 2. Bước 1–2 lưu tạm vào localStorage. */
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Disc3 } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { cart } from "@/lib/cart";
import type { PublicDiscount } from "@/lib/discount";
import type { ShippingSettings } from "@/lib/shipping";
import type { PaymentSettings } from "@/lib/payment/settings";
import { toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { ActionBar, Chip, DoneStep, InfoStep, Label, MOBILE_PAD, Qty, STICKY_TOP, Stepper, Wrap, emptyForm, submitOrder, useAutofill, useCheckout, type Form, type Line, type Step } from "./checkout";

type Draft = { step: 1 | 2; packageId: string; pkgQty: number; addonIds: string[]; form: Form; code: string; autoOff: boolean };
const DRAFT_KEY = "taylana-dat-don";

const imagesOf = (p?: Package) => {
  if (!p) return [];
  const list = (p.images ?? []).filter(Boolean);
  return list.length ? list : p.image_url ? [p.image_url] : [];
};

type Props = { packages: Package[]; addons: Addon[]; discounts: PublicDiscount[]; shipping: ShippingSettings; payment: PaymentSettings | null };

export function OrderForm(props: Props) {
  const { packages, addons } = props;
  const params = useSearchParams();
  const pre = params.get("goi");
  const [init, setInit] = useState<{ draft: Draft | null } | null>(null);
  useEffect(() => {
    let d: Draft | null = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null; } catch { /* bỏ qua */ }
    if (d) {
      if (pre || !packages.some((p) => p.id === d!.packageId)) d.packageId = packages.some((p) => p.id === pre) ? pre! : packages[0]?.id ?? "";
      d.addonIds = (d.addonIds ?? []).filter((id) => addons.some((a) => a.id === id));
    }
    setInit({ draft: d });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!init) return <div className="min-h-[60vh]" />;
  return <Inner {...props} draft={init.draft} pre={pre} />;
}

function Inner({ packages, addons, discounts, shipping, payment, draft, pre }: Props & { draft: Draft | null; pre: string | null }) {
  const [step, setStep] = useState<Step>(draft?.step === 2 ? 2 : 1);
  const [packageId, setPackageId] = useState<string>(draft?.packageId ?? (packages.some((p) => p.id === pre) ? pre! : packages[0]?.id ?? ""));
  const [pkgQty, setPkgQty] = useState(Math.max(1, draft?.pkgQty || 1));
  const [addonIds, setAddonIds] = useState<string[]>(draft?.addonIds ?? []);
  const [form, setForm] = useState<Form>({ ...emptyForm, ...(draft?.form ?? {}) });
  const [imgIdx, setImgIdx] = useState(0);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; total: number } | null>(null);
  const [bump, setBump] = useState(0);
  const first = useRef(true);
  useAutofill(setForm);

  const pkg = packages.find((p) => p.id === packageId);
  const images = imagesOf(pkg);
  const lines = useMemo<Line[]>(() => (pkg ? [{
    key: "now", pkg, qty: pkgQty,
    addons: addons.filter((a) => addonIds.includes(a.id)).map((a) => ({ addon: a, qty: pkgQty })), // 1 phụ kiện / bộ
  }] : []), [pkg, pkgQty, addons, addonIds]);
  const co = useCheckout({ lines, discounts, shipping, phone: form.phone, initialCode: draft?.code ?? "", initialAutoOff: draft?.autoOff ?? false });

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (step === 3) return;
    try {
      const d: Draft = { step, packageId, pkgQty, addonIds, form, code: co.savedCode, autoOff: co.autoOff };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* bỏ qua */ }
  }, [step, packageId, pkgQty, addonIds, form, co.savedCode, co.autoOff]);

  function go(s: Step) { setError(""); setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function orderNow() { if (!pkg) return setError("Bạn chưa chọn gói sản phẩm."); go(2); }
  function addToCart() {
    if (!pkg) return setError("Bạn chưa chọn gói sản phẩm.");
    cart.add({ package_id: pkg.id, quantity: pkgQty, unit_price: pkg.price, addons: addonIds.map((id) => ({ id, qty: 1 })) });
    setBump((n) => n + 1);
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
  const toggleAddon = (id: string) => setAddonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const choose = (id: string) => { if (id !== packageId) { setPackageId(id); setImgIdx(0); } };

  return (
    <div className="flex flex-1 flex-col">
      <Stepper step={step} onGo={go} />
      <Wrap className={cx("pt-6", step !== 3 && MOBILE_PAD, step === 3 && "pb-8")}>
        {!packages.length && <p className="py-16 text-center text-[14px] text-[#71717a]">Tiệm đang cập nhật bảng giá, bạn quay lại sau hoặc nhắn tiệm qua Zalo nhé!</p>}

        {step === 1 && packages.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Cột trái: chỉ ảnh + thumbnail */}
            <div className={cx("lg:col-span-7 lg:sticky lg:self-start", STICKY_TOP)}>
              <div className="relative aspect-square w-full overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
                {images[imgIdx] ? (
                  <Image key={`${packageId}-${imgIdx}`} src={images[imgIdx]} alt={pkg?.name ?? ""} fill priority
                    sizes="(min-width:1024px) 680px, 100vw" className="animate-[fadeIn_.35s_ease] object-cover" />
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
                      className={cx("relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border bg-white", i === imgIdx ? "border-[#ff5fa2] shadow-[inset_0_0_0_1px_#ff5fa2]" : "border-[#e5e5e7] opacity-70 hover:opacity-100")}>
                      <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cột phải */}
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
              <section>
                <Label>Loại</Label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Loại">
                  {packages.map((x) => <Chip key={x.id} on={x.id === packageId} onClick={() => choose(x.id)}>{x.name}</Chip>)}
                </div>
              </section>

              {addons.length > 0 && (
                <section>
                  <Label>Mua kèm <span className="font-normal text-[#71717a]">· chọn nhiều</span></Label>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Mua kèm">
                    {addons.map((a) => <Chip key={a.id} role="checkbox" on={addonIds.includes(a.id)} onClick={() => toggleAddon(a.id)}>{a.name}</Chip>)}
                  </div>
                </section>
              )}

              <section>
                <Label>Số lượng</Label>
                <Qty value={pkgQty} min={1} onChange={setPkgQty} />
              </section>

              {co.discountBox}
              {co.summary}
              {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}
              <ActionBar sets={co.sets} total={co.total} savings={co.savings} label="Đặt đơn" onPrimary={orderNow} onCart={addToCart} bump={bump} />
            </div>
          </div>
        )}

        {step === 2 && (
          <InfoStep form={form} setForm={setForm} co={co} error={error} sending={sending} onBack={() => go(1)} onSubmit={submit} />
        )}

        {step === 3 && result && <DoneStep result={result} payment={payment} />}
      </Wrap>
    </div>
  );
}
