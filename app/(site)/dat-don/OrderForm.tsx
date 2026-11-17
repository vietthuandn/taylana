"use client";

/* Trang Đặt đơn — 3 bước: 1. Chọn sản phẩm → 2. Thông tin nhận hàng → 3. Thanh toán.
   Đơn chỉ được tạo khi bấm "Đặt hàng" ở bước 2. Giá và giảm giá luôn được server tính lại (create_order).
   Bước 1–2 lưu tạm vào localStorage để refresh không mất. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Brush, Check, Copy, Disc3, Minus, Plus, Tag, Upload, X } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { bestPublic, subtotalOf, toCode, unitPrice, type CartItem, type PublicDiscount } from "@/lib/discount";
import type { PaymentSettings } from "@/lib/payment/settings";
import { PaymentView } from "../thanh-toan/[code]/PaymentView";
import { Button, Field, Input, Textarea } from "@/components/ui/kit";
import { btnClass, cx, inputClass } from "@/components/ui/styles";

type Step = 1 | 2 | 3;
type Form = { name: string; phone: string; province: string; ward: string; street: string; note: string };
type Private = { code: string; amount: number; label: string };
type Draft = { step: 1 | 2; packageId: string; pkgQty: number; addonQty: Record<string, number>; form: Form; code: string; autoOff: boolean };
const DRAFT_KEY = "taylana-dat-don";
const emptyForm: Form = { name: "", phone: "", province: "", ward: "", street: "", note: "" };

const imagesOf = (p?: Package) => {
  if (!p) return [];
  const list = (p.images ?? []).filter(Boolean);
  return list.length ? list : p.image_url ? [p.image_url] : [];
};
const summaryOf = (p: Package) => p.description || p.features.join(" · ");

// Giá: có giảm thì hiện giá cũ gạch ngang + giá mới hồng đậm
function Price({ price, now, className = "", big }: { price: number; now: number; className?: string; big?: boolean }) {
  if (now >= price) return <span className={cx("font-semibold text-[#18181b]", className)}>{formatVND(price)}</span>;
  return (
    <span className={cx("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className={cx("text-[#a1a1aa] line-through", big ? "text-[15px] font-normal" : "text-[12px]")}>{formatVND(price)}</span>
      <span className="font-semibold text-[#e0337e]">{formatVND(now)}</span>
    </span>
  );
}

function Qty({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const b = "grid h-full w-8 place-items-center text-[#3f3f46] hover:bg-[#f4f4f5] disabled:opacity-40";
  return (
    <span className="inline-flex h-8 shrink-0 items-center rounded-[8px] border border-[#e5e5e7] bg-white" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={b} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Giảm"><Minus size={14} /></button>
      <span className="w-8 text-center text-[13px] font-medium tabular-nums">{value}</span>
      <button type="button" className={b} disabled={value >= 1000} onClick={() => onChange(value + 1)} aria-label="Tăng"><Plus size={14} /></button>
    </span>
  );
}

function Progress({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
  const steps = ["Chọn sản phẩm", "Thông tin nhận hàng", "Thanh toán"];
  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-[13px] sm:gap-3">
      {steps.map((t, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const can = done && step !== 3;
        return (
          <li key={t} className="flex shrink-0 items-center gap-2 sm:gap-3">
            {i > 0 && <span className={cx("h-px w-5 sm:w-10", n <= step ? "bg-[#ff5fa2]" : "bg-[#e5e5e7]")} />}
            <button type="button" disabled={!can} onClick={() => can && onGo(n)} className={cx("flex items-center gap-2", can && "hover:opacity-80")}>
              <span className={cx("grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold",
                n === step ? "bg-[#ff5fa2] text-white" : done ? "bg-[#fff0f6] text-[#ff5fa2]" : "bg-[#f4f4f5] text-[#a1a1aa]")}>
                {done ? <Check size={13} strokeWidth={3} /> : n}
              </span>
              <span className={cx(n === step ? "font-semibold text-[#18181b]" : done ? "text-[#3f3f46]" : "text-[#a1a1aa]", n !== step && "hidden sm:inline")}>{n}. {t}</span>
            </button>
          </li>
        );
      })}
    </ol>
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
  // giảm giá
  const [autoOff, setAutoOff] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [priv, setPriv] = useState<Private | null>(null);
  const [codeErr, setCodeErr] = useState("");
  const [codeHint, setCodeHint] = useState("");
  const [checking, setChecking] = useState(false);
  // gửi đơn
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; total: number } | null>(null);
  const restored = useRef(false);
  const [restoreCode, setRestoreCode] = useState("");

  const pkg = packages.find((p) => p.id === packageId);
  const images = imagesOf(pkg);
  const list = autoOff ? [] : discounts;

  const cart = useMemo<CartItem[]>(() => [
    ...(pkg ? [{ type: "package" as const, id: pkg.id, name: pkg.name, price: pkg.price, qty: pkgQty }] : []),
    ...addons.filter((a) => (addonQty[a.id] ?? 0) > 0).map((a) => ({ type: "addon" as const, id: a.id, name: a.name, price: a.price, qty: addonQty[a.id] })),
  ], [pkg, pkgQty, addons, addonQty]);
  const subtotal = subtotalOf(cart);
  const { best: pub, hint: pubHint } = useMemo(() => bestPublic(list, cart), [list, cart]);
  // mỗi đơn 1 giảm giá: lấy cái giảm nhiều hơn
  const usePriv = !!priv && priv.amount > (pub?.amount ?? 0);
  const applied = usePriv ? { label: priv!.label || priv!.code, amount: priv!.amount, code: priv!.code } : pub ? { label: pub.d.label, amount: pub.amount, code: "" } : null;
  const discount = applied?.amount ?? 0;
  const total = Math.max(0, subtotal - discount);

  // ---------- khôi phục / lưu tạm ----------
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null;
      if (d) {
        if (!pre && packages.some((p) => p.id === d.packageId)) setPackageId(d.packageId);
        setPkgQty(Math.max(1, d.pkgQty || 1));
        setAddonQty(Object.fromEntries(Object.entries(d.addonQty || {}).filter(([id]) => addons.some((a) => a.id === id))));
        setForm({ ...emptyForm, ...d.form });
        setAutoOff(!!d.autoOff);
        if (d.code) setRestoreCode(d.code);
        if (d.step === 2) setStep(2);
      }
    } catch { /* bỏ qua */ }
    restored.current = true;
    // khách đã đăng nhập → tự điền tên và SĐT
    if (hasSupabase) {
      createClient().auth.getUser().then(({ data }) => {
        const m = data.user?.user_metadata;
        if (m) setForm((f) => ({ ...f, name: f.name || (m.display_name as string) || "", phone: f.phone || (m.phone as string) || "" }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored.current || step === 3) return;
    try {
      const d: Draft = { step, packageId, pkgQty, addonQty, form, code: priv?.code ?? "", autoOff };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* bỏ qua */ }
  }, [step, packageId, pkgQty, addonQty, form, priv, autoOff]);

  // ---------- mã riêng tư: kiểm tra ở server (chỉ trả về hợp lệ + số tiền giảm) ----------
  const check = useCallback(async (raw: string, silent = false) => {
    const code = toCode(raw);
    if (!code) return;
    if (!hasSupabase) return setCodeErr("Web chưa kết nối database.");
    setChecking(true);
    const { data, error } = await createClient().rpc("check_discount_code", {
      p_code: code, p_package_id: packageId || null, p_quantity: pkgQty,
      p_addons: Object.entries(addonQty).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })),
      p_phone: form.phone,
    });
    setChecking(false);
    const r = data?.[0] as { ok: boolean; message: string; amount: number; label: string; need: number; potential: number } | undefined;
    if (error || !r) { setPriv(null); return setCodeErr(error?.message.includes("check_discount_code") ? "Tiệm chưa mở mã giảm giá." : error?.message ?? "Không kiểm tra được mã"); }
    if (!r.ok) {
      setPriv(null);
      setCodeHint(r.need > 0 ? `Mua thêm ${formatVND(r.need)} để được giảm ${formatVND(r.potential)} với mã ${code}` : "");
      if (!silent || !r.need) setCodeErr(r.message);
      else setCodeErr("");
      return;
    }
    setCodeErr(""); setCodeHint("");
    setPriv({ code, amount: r.amount, label: r.label });
    setCodeInput("");
  }, [packageId, pkgQty, addonQty, form.phone]);

  // giỏ hàng đổi → kiểm tra lại mã đang áp dụng (hoặc mã đang chờ đủ điều kiện)
  const pendingCode = priv?.code ?? (codeHint ? toCode(codeInput) : "");
  useEffect(() => {
    if (!pendingCode) return;
    const t = setTimeout(() => check(pendingCode, true), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId, pkgQty, addonQty]);
  // mã lưu tạm từ lần trước → áp dụng lại (sau khi giỏ hàng đã được khôi phục)
  useEffect(() => {
    if (!restoreCode) return;
    setRestoreCode("");
    check(restoreCode, true);
  }, [restoreCode, check]);

  const replacedNote = usePriv && pub ? `Mã ${priv!.code} giảm nhiều hơn nên đã thay cho “${pub.d.label}”.`
    : priv && pub && !usePriv ? `“${pub.d.label}” đang giảm nhiều hơn mã ${priv.code} nên vẫn được giữ.` : "";

  function go(s: Step) {
    setError("");
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function next() {
    if (!pkg) return setError("Bạn chưa chọn gói sản phẩm.");
    go(2);
  }

  async function submit() {
    setError("");
    if (!pkg) return go(1);
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 8) return setError("Vui lòng nhập tên và số điện thoại/Zalo hợp lệ.");
    if (!hasSupabase) return setError("Web chưa kết nối database.");
    setSending(true);
    const { data, error } = await createClient().rpc("create_order", {
      p_customer_name: form.name,
      p_phone: form.phone,
      p_address: "",
      p_note: form.note,
      p_package_id: pkg.id,
      p_quantity: pkgQty,
      p_addons: Object.entries(addonQty).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })),
      p_order_type: "cd",
      p_discount_code: usePriv ? priv!.code : "",
      p_auto_discount: !autoOff,
      p_province: form.province,
      p_ward: form.ward,
      p_street: form.street,
    });
    setSending(false);
    if (error || !data?.[0]) return setError(error?.message ?? "Gửi đơn thất bại, bạn thử lại nhé.");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ }
    setResult({ code: data[0].order_code, total: data[0].order_total });
    go(3);
  }

  if (!packages.length) {
    return <p className="mx-auto max-w-md px-4 py-16 text-center text-[#71717a]">Tiệm đang cập nhật bảng giá, bạn quay lại sau hoặc nhắn tiệm qua Zalo nhé!</p>;
  }

  const label = "mb-2.5 text-[15px] font-semibold text-[#18181b]";
  const card = "rounded-[12px] border border-[#e5e5e7] bg-white p-4";

  // ---------- Tóm tắt (dùng ở bước 1 và 2) ----------
  const summary = (compact = false) => (
    <section className={cx(card, "text-[14px]")}>
      <p className="mb-3 text-[15px] font-semibold text-[#18181b]">{compact ? "Đơn hàng của bạn" : "Tóm tắt"}</p>
      <div className="space-y-1.5 text-[#3f3f46]">
        {cart.map((it) => (
          <p key={it.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{it.name} × {it.qty}</span><span className="shrink-0">{formatVND(it.price * it.qty)}</span></p>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-[#efeff1] pt-3">
        <p className="flex justify-between text-[#3f3f46]"><span>Tạm tính</span><span>{formatVND(subtotal)}</span></p>
        {applied && (
          <p className="flex justify-between gap-3 text-[#e0337e]"><span className="min-w-0 truncate">Giảm giá · {applied.code || applied.label}</span><span className="shrink-0">−{formatVND(discount)}</span></p>
        )}
        <p className="flex items-baseline justify-between pt-1">
          <span className="font-medium text-[#18181b]">Tổng thanh toán</span>
          <span className="flex items-baseline gap-2">
            {discount > 0 && <span className="text-[13px] text-[#a1a1aa] line-through">{formatVND(subtotal)}</span>}
            <span className="text-[20px] font-bold text-[#18181b]">{formatVND(total)}</span>
          </span>
        </p>
      </div>
      {!compact && <p className="mt-1 text-[12px] text-[#71717a]">Chưa gồm phí ship — tiệm sẽ báo khi xác nhận đơn.</p>}
    </section>
  );

  // ---------- Ô mã giảm giá ----------
  const discountBox = (
    <section className={card}>
      <p className="mb-2 text-[14px] font-semibold text-[#18181b]">Mã giảm giá</p>
      {applied && (
        <div className="mb-2 flex items-center gap-2 rounded-[8px] border border-[#ffd1e5] bg-[#fff0f6] px-3 py-2 text-[13px]">
          <Tag size={14} className="shrink-0 text-[#ff5fa2]" />
          <span className="min-w-0 flex-1 text-[#18181b]">Đã áp dụng: <b className="font-semibold">{applied.label}</b> <span className="text-[#e0337e]">−{formatVND(discount)}</span></span>
          <button type="button" aria-label="Gỡ giảm giá" className="grid h-6 w-6 place-items-center rounded-[6px] text-[#71717a] hover:bg-white"
            onClick={() => { if (usePriv) { setPriv(null); } else setAutoOff(true); }}><X size={14} /></button>
        </div>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); check(codeInput); }}>
        <input className={cx(inputClass, "font-mono uppercase")} placeholder="Nhập mã giảm giá" value={codeInput}
          onChange={(e) => { setCodeInput(toCode(e.target.value)); setCodeErr(""); setCodeHint(""); }} aria-label="Mã giảm giá" />
        <button className={btnClass("secondary")} disabled={!codeInput || checking}>{checking ? "Đang kiểm tra..." : "Áp dụng"}</button>
      </form>
      {codeErr && <p className="mt-1.5 text-[12px] text-[#dc2626]">{codeErr}</p>}
      {codeHint && <p className="mt-1.5 text-[12px] text-[#b45309]">{codeHint}</p>}
      {!applied && pubHint && <p className="mt-1.5 text-[12px] text-[#b45309]">Mua thêm {formatVND(pubHint.need)} để được giảm {formatVND(pubHint.amount)}</p>}
      {replacedNote && <p className="mt-1.5 text-[12px] text-[#71717a]">{replacedNote}</p>}
      {autoOff && discounts.length > 0 && !usePriv && (
        <button type="button" className="mt-1.5 text-[12px] font-medium text-[#ff5fa2] hover:underline" onClick={() => setAutoOff(false)}>Dùng lại ưu đãi toàn shop</button>
      )}
    </section>
  );

  const bottomBar = (btn: React.ReactNode) => (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5e7] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 leading-tight">
          <span className="block text-[12px] text-[#71717a]">Tổng tiền{discount > 0 && <span className="ml-1 line-through">{formatVND(subtotal)}</span>}</span>
          <span className="block text-[18px] font-bold text-[#18181b]">{formatVND(total)}</span>
        </div>
        {btn}
      </div>
    </div>
  );
  const errBox = error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:pb-12 md:pt-6">
      <div className="mb-5 md:mb-7"><Progress step={step} onGo={go} /></div>

      {/* ================= BƯỚC 1: CHỌN SẢN PHẨM ================= */}
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
            {/* thông tin gói: chỉ máy tính, ngay dưới ảnh */}
            {pkg && (
              <div key={pkg.id} className="mt-5 hidden animate-[fadeIn_.35s_ease] md:block">
                <h1 className="font-sans text-[24px] font-bold normal-case leading-tight tracking-[-0.02em] text-[#18181b]">{pkg.name}</h1>
                <p className="mt-1 text-[20px]"><Price price={pkg.price} now={unitPrice(list, { type: "package", id: pkg.id, price: pkg.price })} big /></p>
                {summaryOf(pkg) && <p className="mt-2 text-[15px] text-[#71717a]">{summaryOf(pkg)}</p>}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-7">
            <section>
              <p className={label}>Chọn gói</p>
              <div className="space-y-2" role="radiogroup">
                {packages.map((p) => {
                  const on = p.id === packageId;
                  return (
                    <div key={p.id} role="radio" aria-checked={on} tabIndex={0}
                      onClick={() => { if (!on) { setPackageId(p.id); setImgIdx(0); setPkgQty(1); } }}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !on) { e.preventDefault(); setPackageId(p.id); setImgIdx(0); setPkgQty(1); } }}
                      className={cx("flex w-full cursor-pointer items-center gap-3 rounded-[10px] border bg-white px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#ff5fa2]/25",
                        on ? "border-[#ff5fa2] ring-[3px] ring-[#ff5fa2]/15" : "border-[#e5e5e7] hover:border-[#d4d4d8]")}>
                      <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-[#ff5fa2] bg-[#ff5fa2] text-white" : "border-[#d4d4d8]")}>
                        {on && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[#18181b]">{p.name}</span>
                        {summaryOf(p) && <span className="block truncate text-[12px] text-[#71717a]">{summaryOf(p)}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5 text-[14px]">
                        <Price price={p.price} now={unitPrice(list, { type: "package", id: p.id, price: p.price })} />
                        {on && <Qty value={pkgQty} min={1} onChange={setPkgQty} />}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {addons.length > 0 && (
              <section>
                <p className={label}>Phụ kiện mua kèm <span className="text-[13px] font-normal text-[#71717a]">· không bắt buộc</span></p>
                <div className="space-y-2">
                  {addons.map((a) => {
                    const q = addonQty[a.id] ?? 0;
                    const setQ = (v: number) => setAddonQty((cur) => ({ ...cur, [a.id]: v }));
                    return (
                      <div key={a.id} onClick={() => { if (!q) setQ(1); }}
                        className={cx("flex cursor-pointer items-center gap-3 rounded-[10px] border bg-white px-3.5 py-3 transition-colors",
                          q ? "border-[#ff5fa2] ring-[3px] ring-[#ff5fa2]/15" : "border-[#e5e5e7] hover:border-[#d4d4d8]")}>
                        <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border", q ? "border-[#ff5fa2] bg-[#ff5fa2] text-white" : "border-[#d4d4d8]")}>
                          {q > 0 && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] text-[#18181b]">{a.name}</span>
                          <span className="block text-[12px]"><Price price={a.price} now={unitPrice(list, { type: "addon", id: a.id, price: a.price })} className="!font-normal" /></span>
                        </span>
                        <Qty value={q} onChange={setQ} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {summary()}
            {discountBox}
            {errBox}
            <button type="button" onClick={next} className={cx(btnClass("primary"), "hidden h-12 w-full text-[16px] font-semibold md:inline-flex")}>Tiếp tục</button>
          </div>
          {bottomBar(<button type="button" onClick={next} className={cx(btnClass("primary"), "h-11 flex-1 text-[15px] font-semibold")}>Tiếp tục</button>)}
        </div>
      )}

      {/* ================= BƯỚC 2: THÔNG TIN NHẬN HÀNG ================= */}
      {step === 2 && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:gap-10">
          <section className="min-w-0">
            <p className={label}>Thông tin nhận hàng</p>
            <div className="grid gap-4 rounded-[12px] border border-[#e5e5e7] bg-white p-4 sm:grid-cols-2 sm:p-5">
              <Field label="Tên của bạn *">
                <Input required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Số điện thoại / Zalo *">
                <Input required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Tỉnh / Thành phố">
                <Input maxLength={100} autoComplete="address-level1" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="Ví dụ: TP. Hồ Chí Minh" />
              </Field>
              <Field label="Phường / Xã">
                <Input maxLength={100} autoComplete="address-level3" value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} />
              </Field>
              <Field label="Số nhà và đường" className="sm:col-span-2">
                <Input maxLength={300} autoComplete="street-address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </Field>
              <Field label="Ghi chú cho tiệm" className="sm:col-span-2">
                <Textarea rows={3} maxLength={2000} placeholder="Ví dụ: tên album, màu sắc mong muốn, ngày cần nhận..."
                  value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </Field>
            </div>
          </section>
          <aside className="space-y-4 md:sticky md:top-24 md:self-start">
            {summary(true)}
            {errBox}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => go(1)} className="h-12 shrink-0">← Quay lại</Button>
              <button type="button" onClick={submit} disabled={sending} className={cx(btnClass("primary"), "hidden h-12 flex-1 text-[16px] font-semibold md:inline-flex")}>
                {sending ? "Đang gửi..." : "Đặt hàng"}
              </button>
            </div>
          </aside>
          {bottomBar(<button type="button" onClick={submit} disabled={sending} className={cx(btnClass("primary"), "h-11 flex-1 text-[15px] font-semibold")}>{sending ? "Đang gửi..." : "Đặt hàng"}</button>)}
        </div>
      )}

      {/* ================= BƯỚC 3: THANH TOÁN ================= */}
      {step === 3 && result && (payment
        ? <div className="-mx-4 -mt-8 sm:-mt-12"><PaymentView code={result.code} settings={payment} /></div>
        : <Success result={result} />)}
    </div>
  );
}

function Success({ result }: { result: { code: string; total: number } }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="mx-auto w-full max-w-lg py-4">
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
        <p className="mt-4 text-[14px] text-[#3f3f46]">Tổng thanh toán: <b>{formatVND(result.total)}</b></p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-[#71717a]">Lưu lại mã đơn nhé. Tiệm sẽ liên hệ qua Zalo/SĐT để xác nhận và báo phí ship.</p>
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
