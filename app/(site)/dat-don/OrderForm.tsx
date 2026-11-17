"use client";

/* Trang Đặt đơn — sản phẩm "In CD theo yêu cầu" với các nhóm tuỳ chọn (Chọn 1 / Chọn nhiều).
   3 bước: 1. Chọn sản phẩm → 2. Thông tin nhận hàng → 3. Thanh toán. Đơn chỉ tạo khi bấm "Đặt hàng" ở bước 2.
   Bước 1–2 lưu tạm vào localStorage. Link mở lại đúng lựa chọn: /dat-don?sp=<slug>&chon=<id,id>&sl=<số lượng> (?goi=<id> vẫn nhận). */
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Disc3 } from "lucide-react";
import { formatVND } from "@/lib/format";
import { cart } from "@/lib/cart";
import { fromPrice, type Product } from "@/lib/catalog";
import type { PublicDiscount } from "@/lib/discount";
import type { ShippingSettings } from "@/lib/shipping";
import type { PaymentSettings } from "@/lib/payment/settings";
import { RichText } from "@/components/site/RichText";
import { toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { ActionBar, Chip, DoneStep, InfoStep, Label, MOBILE_PAD, Qty, STICKY_TOP, Stepper, Wrap, emptyForm, lineUnit, submitOrder, useAutofill, useCheckout, type Form, type Line, type Step } from "./checkout";

type Draft = { step: 1 | 2; productId: string; optionIds: string[]; qty: number; form: Form; code: string; autoOff: boolean };
const DRAFT_KEY = "taylana-dat-don-v2";

type Props = { products: Product[]; discounts: PublicDiscount[]; shipping: ShippingSettings; payment: PaymentSettings | null };

export function OrderForm(props: Props) {
  const { products } = props;
  const params = useSearchParams();
  const [init, setInit] = useState<{ draft: Draft | null; productId: string; optionIds: string[]; qty: number } | null>(null);
  useEffect(() => {
    let d: Draft | null = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null; } catch { /* bỏ qua */ }
    // lựa chọn từ link (giỏ hàng / Custom CD) được ưu tiên hơn bản lưu tạm
    const sp = params.get("sp"), chon = params.get("chon"), goi = params.get("goi"), sl = Number(params.get("sl"));
    const pFrom = (id?: string | null) => products.find((p) => p.groups.some((g) => g.options.some((o) => o.id === id)));
    let product = products.find((p) => p.slug === sp) ?? pFrom(goi) ?? pFrom(chon?.split(",")[0]);
    let ids = chon ? chon.split(",") : goi ? [goi] : [];
    let qty = sl > 0 ? Math.min(1000, Math.round(sl)) : 1;
    if (!product && d) { product = products.find((p) => p.id === d!.productId); ids = d.optionIds ?? []; qty = d.qty || 1; }
    product = product ?? products[0];
    const valid = new Set(product?.groups.flatMap((g) => g.options.map((o) => o.id)) ?? []);
    setInit({ draft: d, productId: product?.id ?? "", optionIds: ids.filter((x) => valid.has(x)), qty });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!init) return <div className="min-h-[60vh]" />;
  return <Inner {...props} {...init} />;
}

function Inner({ products, discounts, shipping, payment, draft, productId, optionIds, qty: qty0 }: Props & { draft: Draft | null; productId: string; optionIds: string[]; qty: number }) {
  const [step, setStep] = useState<Step>(draft?.step === 2 && draft.productId === productId ? 2 : 1);
  const [pid] = useState(productId);
  const [ids, setIds] = useState<string[]>(optionIds);
  const [qty, setQty] = useState(Math.max(1, qty0));
  const [form, setForm] = useState<Form>({ ...emptyForm, ...(draft?.form ?? {}) });
  const [imgIdx, setImgIdx] = useState(0);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; total: number } | null>(null);
  const [bump, setBump] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const first = useRef(true);
  useAutofill(setForm);

  const product = products.find((p) => p.id === pid);
  const sels = useMemo(() => (product?.groups ?? []).flatMap((g) => g.options.filter((o) => ids.includes(o.id)).map((o) => ({ opt: o, group: g }))), [product, ids]);
  const missing = (product?.groups ?? []).filter((g) => g.required && !g.options.some((o) => ids.includes(o.id)));
  const lines = useMemo<Line[]>(() => (product && !missing.length && sels.length ? [{ key: "now", product, qty, sels }] : []), [product, missing.length, sels, qty]);
  const co = useCheckout({ lines, discounts, shipping, phone: form.phone, initialCode: draft?.code ?? "", initialAutoOff: draft?.autoOff ?? false });

  // ảnh: ảnh riêng của lựa chọn đang chọn (nếu có) rồi đến ảnh sản phẩm
  const images = useMemo(() => [...new Set([...sels.map((s) => s.opt.image_url).filter(Boolean) as string[], ...(product?.images ?? [])])], [sels, product]);
  useEffect(() => { setImgIdx(0); }, [images.length, images[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (step === 3) return;
    try {
      const d: Draft = { step, productId: pid, optionIds: ids, qty, form, code: co.savedCode, autoOff: co.autoOff };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* bỏ qua */ }
  }, [step, pid, ids, qty, form, co.savedCode, co.autoOff]);

  function go(s: Step) { setError(""); setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const needMsg = () => (missing.length ? `Vui lòng chọn ${missing.map((g) => g.name.toLowerCase()).join(", ")}.` : "");
  function orderNow() { const m = needMsg(); if (m) return setError(m); go(2); }
  function addToCart() {
    const m = needMsg(); if (m || !product) return setError(m || "Chưa có sản phẩm.");
    cart.add({ product_id: product.id === "legacy" ? null : product.id, options: ids, quantity: qty, unit_price: lineUnit(lines[0]) });
    setBump((n) => n + 1);
    toast("Đã thêm vào giỏ", "ok", { label: "Xem giỏ", href: "/gio-hang" });
  }
  async function submit() {
    setError(""); setSending(true);
    try {
      const r = await submitOrder(lines, form, co.submit);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ }
      setResult(r); go(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Gửi đơn thất bại"); }
    setSending(false);
  }
  function pick(groupId: string, optId: string) {
    setError("");
    const g = product?.groups.find((x) => x.id === groupId);
    if (!g) return;
    setIds((cur) => {
      const inGroup = g.options.map((o) => o.id);
      if (g.select_type === "multi") return cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId];
      if (cur.includes(optId)) return g.required ? cur : cur.filter((x) => x !== optId); // Chọn 1 không bắt buộc: bấm lại để bỏ
      return [...cur.filter((x) => !inGroup.includes(x)), optId];
    });
  }

  if (!product) return <Wrap className="py-16 text-center text-[14px] text-[#71717a]">Tiệm đang cập nhật sản phẩm, bạn quay lại sau hoặc nhắn tiệm qua Zalo nhé!</Wrap>;

  const unit = sels.reduce((t, s) => t + s.opt.price, 0);
  const priceText = missing.length ? `Từ ${formatVND(fromPrice(product))}` : formatVND(unit);
  const desc = product.description?.trim() && (
    <section>
      <button type="button" onClick={() => setDescOpen(!descOpen)} className="flex w-full items-center justify-between">
        <span className="text-[13px] font-semibold text-[#18181b]">Mô tả sản phẩm</span>
        <ChevronDown size={16} className={cx("text-[#71717a]", descOpen && "rotate-180")} />
      </button>
      <div className={cx("mt-2 overflow-hidden text-[14px] leading-relaxed text-[#3f3f46]", !descOpen && "line-clamp-3")}>
        <RichText text={product.description} />
      </div>
      {!descOpen && <button type="button" onClick={() => setDescOpen(true)} className="mt-1 text-[13px] font-medium text-[#ff5fa2]">Xem thêm</button>}
    </section>
  );

  return (
    <div className="flex flex-1 flex-col bg-[#f7f7f8]">
      <Stepper step={step} onGo={go} />
      <Wrap className={cx("pt-6", step !== 3 ? MOBILE_PAD : "pb-8")}>
        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Cột trái: ảnh (dính bằng CSS thuần) */}
            <div className={cx("lg:col-span-7 lg:sticky lg:self-start lg:[transform:translateZ(0)]", STICKY_TOP)}>
              <div className="relative aspect-square w-full overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
                {images[imgIdx] ? (
                  <Image key={images[imgIdx]} src={images[imgIdx]} alt={product.name} fill priority
                    sizes="(min-width:1024px) 680px, 100vw" className="animate-[fadeIn_.35s_ease] object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-[#f4f4f5]"><Disc3 size={96} strokeWidth={1} className="text-[#d4d4d8]" /></div>
                )}
              </div>
              {images.length > 1 && (
                <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                  {images.map((src, i) => (
                    <button key={src} type="button" onClick={() => setImgIdx(i)} aria-label={`Ảnh ${i + 1}`}
                      className={cx("relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border bg-white", i === imgIdx ? "border-[#ff5fa2] shadow-[inset_0_0_0_1px_#ff5fa2]" : "border-[#e5e5e7] opacity-70 hover:opacity-100")}>
                      <Image src={src} alt="" width={64} height={64} className="h-16 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {desc && <div className="mt-6 hidden lg:block">{desc}</div>}
            </div>

            {/* Cột phải */}
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
              <div>
                <h1 className="font-sans text-[22px] font-bold normal-case leading-tight tracking-[-0.02em] text-[#18181b]">{product.name}</h1>
                <p className="mt-2 text-[22px] font-bold tabular-nums text-[#ff5fa2]">{priceText}</p>
              </div>
              {product.groups.map((g) => g.options.length > 0 && (
                <section key={g.id}>
                  <Label>{g.name}{g.select_type === "multi" && <span className="font-normal text-[#71717a]"> · chọn nhiều</span>}</Label>
                  <div className="flex flex-wrap gap-2" role={g.select_type === "multi" ? "group" : "radiogroup"} aria-label={g.name}>
                    {g.options.map((o) => (
                      <Chip key={o.id} role={g.select_type === "multi" ? "checkbox" : "radio"} on={ids.includes(o.id)} onClick={() => pick(g.id, o.id)}>{o.name}</Chip>
                    ))}
                  </div>
                </section>
              ))}
              <section>
                <Label>Số lượng</Label>
                <Qty value={qty} min={1} onChange={setQty} />
              </section>
              {desc && <div className="lg:hidden">{desc}</div>}
              {co.discountBox}
              {co.summary}
              {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}
            </div>
          </div>
        )}
        {step === 1 && <ActionBar sets={co.sets} total={co.total} savings={co.savings} label="Đặt đơn" onPrimary={orderNow} onCart={addToCart} bump={bump} />}

        {step === 2 && <InfoStep form={form} setForm={setForm} co={co} error={error} sending={sending} onBack={() => go(1)} onSubmit={submit} />}

        {step === 3 && result && <DoneStep result={result} payment={payment} />}
      </Wrap>
    </div>
  );
}
