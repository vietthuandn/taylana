"use client";

/* Phần dùng chung giữa trang Đặt đơn và Giỏ hàng.
   Quy tắc: khoảng cách chỉ 4/8/12/16/24/32px · nhãn nhóm 13px/600 nằm TRÊN nội dung, cách 8px · nhóm cách nhau 24px
   · chip & ô số lượng cao 36px · nút chính 48px · bo: chip 8, card 12, nút 10 · viền 1px #E5E5E7 · tiền căn phải, tabular-nums.
   Giá, giảm giá, phí ship chỉ là XEM TRƯỚC — server tính lại trong create_order. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brush, Check, Copy, ListOrdered, Minus, Plus, ShoppingCart, Tag, Upload, X } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { saveOrderCode } from "@/lib/cart";
import { bestPublic, subtotalOf, toCode, type CartItem, type PublicDiscount } from "@/lib/discount";
import { shippingFor, type ShippingSettings } from "@/lib/shipping";
import type { PaymentSettings } from "@/lib/payment/settings";
import { PaymentView } from "../thanh-toan/[code]/PaymentView";
import { Button, Field, Input, Textarea } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";

export type Step = 1 | 2 | 3;
export type Line = { key: string; pkg: Package; qty: number; addons: { addon: Addon; qty: number }[] };
export type Form = { name: string; phone: string; province: string; ward: string; street: string; note: string };
export const emptyForm: Form = { name: "", phone: "", province: "", ward: "", street: "", note: "" };

// Header cao 57px (56 + viền) · thanh bước 56px → cột ảnh dính ở 57 + 56 + 24 = 137px
export const STICKY_TOP = "top-[137px]";

export const lineTotal = (l: Line) => l.pkg.price * l.qty + l.addons.reduce((t, a) => t + a.addon.price * a.qty, 0);
const flat = (lines: Line[]): CartItem[] => lines.flatMap((l) => [
  { type: "package" as const, id: l.pkg.id, name: l.pkg.name, price: l.pkg.price, qty: l.qty },
  ...l.addons.filter((a) => a.qty > 0).map((a) => ({ type: "addon" as const, id: a.addon.id, name: a.addon.name, price: a.addon.price, qty: a.qty })),
]);
const toRpcLines = (lines: Line[]) => lines.map((l) => ({ package_id: l.pkg.id, qty: l.qty, addons: l.addons.filter((a) => a.qty > 0).map((a) => ({ id: a.addon.id, qty: a.qty })) }));
const money = "tabular-nums text-right";

// ---------- Khung trang 1200px ----------
export const Wrap = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={cx("mx-auto w-full max-w-[1200px] px-4 lg:px-6", className)}>{children}</div>
);
export const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 text-[13px] font-semibold text-[#18181b]">{children}</p>
);

// ---------- Thanh 3 bước: dính ngay dưới header, cao 56px ----------
export function Stepper({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
  const steps = ["Chọn sản phẩm", "Thông tin nhận hàng", "Thanh toán"];
  return (
    <div className="sticky top-[57px] z-20 border-b border-[#e5e5e7] bg-white">
      <Wrap className="flex h-14 items-center justify-center">
        <ol className="flex items-center gap-2 overflow-x-auto">
          {steps.map((t, i) => {
            const n = (i + 1) as Step;
            const done = n < step;
            const cur = n === step;
            const can = done && step !== 3;
            return (
              <li key={t} className="flex shrink-0 items-center gap-2">
                {i > 0 && <span className={cx("h-px w-4 sm:w-8", n <= step ? "bg-[#ff5fa2]" : "bg-[#e5e5e7]")} />}
                <button type="button" disabled={!can} onClick={() => can && onGo(n)} className={cx("flex items-center gap-2", can && "hover:opacity-80")}>
                  <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                    cur ? "bg-[#ff5fa2] text-white" : done ? "bg-[#fff0f6] text-[#ff5fa2]" : "border border-[#d4d4d8] text-[#a1a1aa]")}>
                    {done ? <Check size={12} strokeWidth={3} /> : n}
                  </span>
                  <span className={cx("text-[14px]", cur ? "font-semibold text-[#18181b]" : done ? "text-[#3f3f46]" : "text-[#a1a1aa]", !cur && "hidden sm:inline")}>{t}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Wrap>
    </div>
  );
}

// ---------- Chip chọn (cao 36px, có tam giác dấu tích khi chọn) ----------
export function Chip({ on, onClick, children, role = "radio" }: { on: boolean; onClick: () => void; children: React.ReactNode; role?: "radio" | "checkbox" }) {
  return (
    <button type="button" role={role} aria-checked={on} onClick={onClick}
      className={cx("relative inline-flex h-9 shrink-0 items-center overflow-hidden whitespace-nowrap rounded-[8px] border px-[14px] text-[14px] leading-none transition-colors",
        on ? "border-[#ff5fa2] bg-[#fff5f9] text-[#ff5fa2] shadow-[inset_0_0_0_0.5px_#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#18181b] hover:border-[#a1a1aa]")}>
      {children}
      {on && (
        <span className="pointer-events-none absolute bottom-0 right-0 h-[14px] w-[14px] bg-[#ff5fa2] [clip-path:polygon(100%_0,100%_100%,0_100%)]">
          <Check size={7} strokeWidth={4} className="absolute bottom-[1px] right-[1px] text-white" />
        </span>
      )}
    </button>
  );
}

// ---------- Bộ số lượng 120 × 36, 3 phần bằng nhau, 1 viền ngoài ----------
export function Qty({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const b = "grid h-full place-items-center text-[#3f3f46] hover:bg-[#f4f4f5] disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <span className="grid h-9 w-[120px] shrink-0 grid-cols-3 overflow-hidden rounded-[8px] border border-[#e5e5e7] bg-white" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={b} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Giảm"><Minus size={16} /></button>
      <span className="grid place-items-center text-[14px] font-medium tabular-nums text-[#18181b]">{value}</span>
      <button type="button" className={b} disabled={value >= 1000} onClick={() => onChange(Math.min(1000, value + 1))} aria-label="Tăng"><Plus size={16} /></button>
    </span>
  );
}

// ---------- Giá có gạch (dòng giỏ hàng) ----------
export function Price({ price, now }: { price: number; now: number }) {
  if (now >= price) return <span className="tabular-nums">{formatVND(price)}</span>;
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span className="text-[13px] text-[#a1a1aa] line-through">{formatVND(price)}</span>
      <span className="text-[#ff5fa2]">{formatVND(now)}</span>
    </span>
  );
}

// ---------- Giảm giá + phí ship + Tạm tính ----------
type Private = { code: string; amount: number; label: string };

export function useCheckout({ lines, discounts, shipping, phone, initialCode = "", initialAutoOff = false }: {
  lines: Line[]; discounts: PublicDiscount[]; shipping: ShippingSettings; phone: string; initialCode?: string; initialAutoOff?: boolean;
}) {
  const [autoOff, setAutoOff] = useState(initialAutoOff);
  const [codeInput, setCodeInput] = useState("");
  const [priv, setPriv] = useState<Private | null>(null);
  const [codeErr, setCodeErr] = useState("");
  const [codeHint, setCodeHint] = useState("");
  const [checking, setChecking] = useState(false);
  const [restore, setRestore] = useState(initialCode);

  const items = useMemo(() => flat(lines), [lines]);
  const list = autoOff ? [] : discounts;
  const subtotal = subtotalOf(items);
  const { best: pub, hint: pubHint } = useMemo(() => bestPublic(list, items), [list, items]);
  const usePriv = !!priv && priv.amount > (pub?.amount ?? 0);
  const applied = usePriv ? { label: priv!.label || priv!.code, amount: priv!.amount, code: priv!.code } : pub ? { label: pub.d.label, amount: pub.amount, code: "" } : null;
  const discount = applied?.amount ?? 0;
  const ship = shippingFor(shipping, subtotal);
  const total = Math.max(0, subtotal - discount) + (lines.length ? ship.fee : 0);
  const savings = discount + (lines.length && ship.free ? ship.base : 0);
  const sets = lines.reduce((t, l) => t + l.qty, 0);
  const linesKey = JSON.stringify(toRpcLines(lines));

  const check = useCallback(async (raw: string, silent = false) => {
    const code = toCode(raw);
    if (!code || !lines.length) return;
    if (!hasSupabase) return setCodeErr("Web chưa kết nối database.");
    setChecking(true);
    const { data, error } = await createClient().rpc("check_discount_code", { p_code: code, p_lines: toRpcLines(lines), p_phone: phone });
    setChecking(false);
    const r = data?.[0] as { ok: boolean; message: string; amount: number; label: string; need: number; potential: number } | undefined;
    if (error || !r) { setPriv(null); return setCodeErr(error?.message.includes("check_discount_code") ? "Tiệm chưa mở mã giảm giá." : error?.message ?? "Không kiểm tra được mã"); }
    if (!r.ok) {
      setPriv(null);
      setCodeHint(r.need > 0 ? `Mua thêm ${formatVND(r.need)} để được giảm ${formatVND(r.potential)} với mã ${code}` : "");
      setCodeErr(silent && r.need ? "" : r.message);
      if (r.need) setCodeInput(code);
      return;
    }
    setCodeErr(""); setCodeHint("");
    setPriv({ code, amount: r.amount, label: r.label });
    setCodeInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, phone]);

  const pendingCode = priv?.code ?? (codeHint ? toCode(codeInput) : "");
  useEffect(() => {
    if (!pendingCode) return;
    const t = setTimeout(() => check(pendingCode, true), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);
  useEffect(() => {
    if (!restore || !lines.length) return;
    setRestore("");
    check(restore, true);
  }, [restore, lines.length, check]);

  const replacedNote = usePriv && pub ? `Mã ${priv!.code} giảm nhiều hơn nên đã thay cho “${pub.d.label}”.`
    : priv && pub && !usePriv ? `“${pub.d.label}” đang giảm nhiều hơn mã ${priv.code} nên vẫn được giữ.` : "";

  // Ô mã giảm giá (đặt ngay trên card Tạm tính)
  const discountBox = (
    <section>
      <Label>Mã giảm giá</Label>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); check(codeInput); }}>
        <input className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#e5e5e7] bg-white px-3 font-mono text-[14px] uppercase text-[#18181b] placeholder:font-sans placeholder:normal-case placeholder:text-[#a1a1aa] focus:border-[#ff5fa2] focus:outline-none focus:ring-[3px] focus:ring-[#ff5fa2]/15"
          placeholder="Nhập mã giảm giá" value={codeInput} aria-label="Mã giảm giá"
          onChange={(e) => { setCodeInput(toCode(e.target.value)); setCodeErr(""); setCodeHint(""); }} />
        <button className="h-10 shrink-0 rounded-[10px] border border-[#e5e5e7] bg-white px-4 text-[14px] font-medium text-[#18181b] hover:bg-[#f4f4f5] disabled:opacity-50" disabled={!codeInput || checking}>
          {checking ? "Đang kiểm tra..." : "Áp dụng"}
        </button>
      </form>
      {applied && (
        <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-[#ffd1e5] bg-[#fff5f9] px-3 py-2 text-[13px]">
          <Tag size={16} className="shrink-0 text-[#ff5fa2]" />
          <span className="min-w-0 flex-1 text-[#18181b]">Đã áp dụng: <b className="font-semibold">{applied.label}</b> <span className="tabular-nums text-[#ff5fa2]">−{formatVND(discount)}</span></span>
          <button type="button" aria-label="Gỡ giảm giá" className="grid h-6 w-6 place-items-center rounded-[4px] text-[#71717a] hover:bg-white"
            onClick={() => { if (usePriv) setPriv(null); else setAutoOff(true); }}><X size={16} /></button>
        </div>
      )}
      {codeErr && <p className="mt-2 text-[13px] text-[#dc2626]">{codeErr}</p>}
      {codeHint && <p className="mt-2 text-[13px] text-[#b45309]">{codeHint}</p>}
      {!applied && pubHint && <p className="mt-2 text-[13px] text-[#b45309]">Mua thêm {formatVND(pubHint.need)} để được giảm {formatVND(pubHint.amount)}</p>}
      {replacedNote && <p className="mt-2 text-[13px] text-[#71717a]">{replacedNote}</p>}
      {autoOff && discounts.length > 0 && !usePriv && (
        <button type="button" className="mt-2 text-[13px] font-medium text-[#ff5fa2] hover:underline" onClick={() => setAutoOff(false)}>Dùng lại ưu đãi toàn shop</button>
      )}
    </section>
  );

  // Card Tạm tính (không có dòng tổng — tổng nằm ở thanh hành động)
  const row = "flex h-7 items-center justify-between gap-3";
  const summary = (
    <section>
      <Label>Tạm tính</Label>
      <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-4 text-[14px] text-[#18181b]">
        {lines.length ? lines.map((l) => (
          <div key={l.key}>
            <p className={row}><span className="min-w-0 truncate">{l.pkg.name} × {l.qty}</span><span className={money}>{formatVND(l.pkg.price * l.qty)}</span></p>
            {l.addons.filter((a) => a.qty > 0).map((a) => (
              <p key={a.addon.id} className={cx(row, "text-[13px] text-[#71717a]")}><span className="min-w-0 truncate">{a.addon.name} × {a.qty}</span><span className={money}>{formatVND(a.addon.price * a.qty)}</span></p>
            ))}
          </div>
        )) : <p className={cx(row, "text-[13px] text-[#71717a]")}>Chưa chọn sản phẩm</p>}
        <div className="my-2 h-px bg-[#efeff1]" />
        <p className={row}><span>Tiền hàng</span><span className={money}>{formatVND(subtotal)}</span></p>
        {lines.length > 0 && (
          <>
            <p className={row}>
              <span>Phí vận chuyển</span>
              {ship.free
                ? <span className={cx(money, "flex items-baseline gap-2")}>{ship.base > 0 && <span className="text-[13px] text-[#a1a1aa] line-through">{formatVND(ship.base)}</span>}<span className="text-[#ff5fa2]">Miễn phí</span></span>
                : <span className={money}>{formatVND(ship.fee)}</span>}
            </p>
            {ship.need > 0 && ship.fee > 0 && (
              <div className="pb-2">
                <p className="text-[13px] text-[#71717a]">Mua thêm <span className="tabular-nums">{formatVND(ship.need)}</span> để được miễn phí vận chuyển</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#f4f4f5]"><div className="h-full rounded-full bg-[#ff5fa2]" style={{ width: `${Math.round(ship.progress * 100)}%` }} /></div>
              </div>
            )}
            {shipping.note && <p className="pb-1 text-[13px] text-[#71717a]">{shipping.note}</p>}
          </>
        )}
        {applied && (
          <p className={cx(row, "text-[#ff5fa2]")}><span className="min-w-0 truncate">Giảm giá · {applied.code || applied.label}</span><span className={money}>−{formatVND(discount)}</span></p>
        )}
      </div>
    </section>
  );

  return { list, subtotal, discount, total, savings, sets, summary, discountBox, privCode: usePriv ? priv!.code : "", savedCode: priv?.code ?? "", autoOff };
}

// ---------- Thanh hành động: máy tính dính cuối cột phải, điện thoại cố định đáy ----------
export function ActionBar({ sets, total, savings, label, onPrimary, disabled, onCart, bump = 0 }: {
  sets: number; total: number; savings: number; label: string; onPrimary: () => void; disabled?: boolean;
  onCart?: () => void; bump?: number;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] text-[#71717a]">Tổng cộng ({sets} sản phẩm)</p>
        <p className="text-[22px] font-bold leading-tight tabular-nums text-[#ff5fa2]">{formatVND(total)}</p>
        {savings > 0 && <p className="text-[12px] tabular-nums text-[#71717a]">Tiết kiệm: {formatVND(savings)}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onPrimary} disabled={disabled}
          className="h-12 min-w-[160px] rounded-[10px] bg-[#ff5fa2] px-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#f0468f] disabled:cursor-not-allowed disabled:opacity-50">
          {label}
        </button>
        {onCart && (
          <button key={bump} type="button" onClick={onCart} title="Thêm vào giỏ hàng" aria-label="Thêm vào giỏ hàng"
            className={cx("grid h-12 w-12 place-items-center rounded-[10px] border border-[#e5e5e7] bg-white text-[#18181b] hover:bg-[#f4f4f5]", bump > 0 && "animate-[cartBump_.45s_ease]")}>
            <ShoppingCart size={20} />
          </button>
        )}
      </div>
    </div>
  );
  return (
    <>
      <div className="sticky bottom-0 z-10 hidden border-t border-[#e5e5e7] bg-white py-4 lg:block">{inner}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5e7] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 lg:hidden">{inner}</div>
    </>
  );
}
// Chừa chỗ cho thanh hành động cố định trên điện thoại
export const MOBILE_PAD = "pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-8";

// ---------- Gửi đơn ----------
export async function submitOrder(lines: Line[], form: Form, opts: { code: string; autoOff: boolean }) {
  if (!lines.length) throw new Error("Bạn chưa chọn sản phẩm nào.");
  if (!form.name.trim()) throw new Error("Vui lòng nhập tên.");
  const phone = normalizePhone(form.phone);
  if (!phone) throw new Error(PHONE_ERROR);
  if (!hasSupabase) throw new Error("Web chưa kết nối database.");
  const { data, error } = await createClient().rpc("create_order", {
    p_customer_name: form.name, p_phone: phone, p_address: "", p_note: form.note,
    p_order_type: "cd", p_lines: toRpcLines(lines),
    p_discount_code: opts.code, p_auto_discount: !opts.autoOff,
    p_province: form.province, p_ward: form.ward, p_street: form.street,
  });
  if (error || !data?.[0]) throw new Error(error?.message ?? "Gửi đơn thất bại, bạn thử lại nhé.");
  saveOrderCode(data[0].order_code);
  return { code: data[0].order_code as string, total: data[0].order_total as number };
}

// Tự điền tên + SĐT khi khách đã đăng nhập
export function useAutofill(setForm: (f: (x: Form) => Form) => void) {
  useEffect(() => {
    if (!hasSupabase) return;
    createClient().auth.getUser().then(({ data }) => {
      const m = data.user?.user_metadata;
      if (m) setForm((f) => ({ ...f, name: f.name || (m.display_name as string) || "", phone: f.phone || (m.phone as string) || "" }));
    });
  }, [setForm]);
}

// ---------- Bước 2: thông tin nhận hàng ----------
export function InfoStep({ form, setForm, co, error, sending, onBack, onSubmit }: {
  form: Form; setForm: (f: Form) => void; co: ReturnType<typeof useCheckout>; error: string; sending: boolean;
  onBack: () => void; onSubmit: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
      <section className="min-w-0 lg:col-span-7">
        <button type="button" onClick={onBack} className="mb-4 text-[14px] text-[#71717a] hover:text-[#18181b]">← Quay lại</button>
        <Label>Thông tin nhận hàng</Label>
        <div className="grid gap-4 rounded-[12px] border border-[#e5e5e7] bg-white p-4 sm:grid-cols-2">
          <Field label="Tên của bạn *"><Input required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Số điện thoại / Zalo *"><Input required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Tỉnh / Thành phố"><Input maxLength={100} autoComplete="address-level1" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="Ví dụ: TP. Hồ Chí Minh" /></Field>
          <Field label="Phường / Xã"><Input maxLength={100} autoComplete="address-level3" value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} /></Field>
          <Field label="Số nhà và đường" className="sm:col-span-2"><Input maxLength={300} autoComplete="street-address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></Field>
          <Field label="Ghi chú cho tiệm" className="sm:col-span-2">
            <Textarea rows={3} maxLength={2000} placeholder="Ví dụ: tên album, màu sắc mong muốn, ngày cần nhận..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </section>
      <aside className="flex flex-col gap-6 lg:col-span-5">
        {co.summary}
        {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}
        <ActionBar sets={co.sets} total={co.total} savings={co.savings} label={sending ? "Đang gửi..." : "Đặt hàng"} onPrimary={onSubmit} disabled={sending} />
      </aside>
    </div>
  );
}

// ---------- Bước 3 ----------
export function DoneStep({ result, payment }: { result: { code: string; total: number }; payment: PaymentSettings | null }) {
  if (payment) return <div className="-mx-4 lg:-mx-6"><PaymentView code={result.code} settings={payment} /></div>;
  return <Success result={result} />;
}

function Success({ result }: { result: { code: string; total: number } }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="mx-auto w-full max-w-lg py-4">
      <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-6 text-center sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#fff0f6] text-[#ff5fa2]"><Check size={24} /></span>
        <h1 className="mt-4 font-sans text-[22px] font-bold normal-case tracking-[-0.02em] text-[#18181b] sm:text-[28px]">Cảm ơn bạn đã đặt hàng!</h1>
        <p className="mt-1 text-[14px] text-[#71717a]">Mã đơn của bạn</p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] py-2 pl-4 pr-2">
          <span className="text-[22px] font-semibold tracking-wide text-[#18181b]">{result.code}</span>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-[8px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Sao chép mã đơn"
            onClick={() => { navigator.clipboard?.writeText(result.code); setCopied(true); }}>
            {copied ? <Check size={16} className="text-[#16a34a]" /> : <Copy size={16} />}
          </button>
        </div>
        <p className="mt-4 text-[14px] text-[#3f3f46]">Tổng thanh toán: <b className="tabular-nums">{formatVND(result.total)}</b></p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-[#71717a]">Lưu lại mã đơn nhé. Tiệm sẽ liên hệ qua Zalo/SĐT để xác nhận đơn.</p>
        <div className="mt-6 border-t border-[#efeff1] pt-6">
          <p className="mb-3 text-[13px] font-semibold text-[#18181b]">Bước tiếp theo</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button href={`/gui-file-in?don=${encodeURIComponent(result.code)}`} icon={<Upload size={16} />}>Gửi file in</Button>
            <Button href="/custom-cd" variant="secondary" icon={<Brush size={16} />}>Tự thiết kế CD</Button>
            <Button href="/don-hang-cua-toi" variant="ghost" icon={<ListOrdered size={16} />} className="sm:col-span-2">Xem đơn hàng của tôi</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
