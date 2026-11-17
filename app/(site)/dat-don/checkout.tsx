"use client";

/* Phần dùng chung giữa trang Đặt đơn và Giỏ hàng:
   tóm tắt, mã giảm giá, bước 2 (thông tin nhận hàng), bước 3 (thanh toán / cảm ơn).
   Giá và giảm giá chỉ là XEM TRƯỚC — server tính lại trong create_order. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brush, Check, Copy, ListOrdered, Minus, Plus, Tag, Upload, X } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { saveOrderCode } from "@/lib/cart";
import { bestPublic, subtotalOf, toCode, type CartItem, type PublicDiscount } from "@/lib/discount";
import type { PaymentSettings } from "@/lib/payment/settings";
import { PaymentView } from "../thanh-toan/[code]/PaymentView";
import { Button, Field, Input, Textarea } from "@/components/ui/kit";
import { btnClass, cx, inputClass } from "@/components/ui/styles";

export type Step = 1 | 2 | 3;
export type Line = { key: string; pkg: Package; qty: number; addons: { addon: Addon; qty: number }[] };
export type Form = { name: string; phone: string; province: string; ward: string; street: string; note: string };
export const emptyForm: Form = { name: "", phone: "", province: "", ward: "", street: "", note: "" };

export const lineTotal = (l: Line) => l.pkg.price * l.qty + l.addons.reduce((t, a) => t + a.addon.price * a.qty, 0);
const flat = (lines: Line[]): CartItem[] => lines.flatMap((l) => [
  { type: "package" as const, id: l.pkg.id, name: l.pkg.name, price: l.pkg.price, qty: l.qty },
  ...l.addons.filter((a) => a.qty > 0).map((a) => ({ type: "addon" as const, id: a.addon.id, name: a.addon.name, price: a.addon.price, qty: a.qty })),
]);
const toRpcLines = (lines: Line[]) => lines.map((l) => ({ package_id: l.pkg.id, qty: l.qty, addons: l.addons.filter((a) => a.qty > 0).map((a) => ({ id: a.addon.id, qty: a.qty })) }));

// ---------- Giá có gạch ----------
export function Price({ price, now, className = "" }: { price: number; now: number; className?: string }) {
  if (now >= price) return <span className={cx("font-semibold text-[#18181b]", className)}>{formatVND(price)}</span>;
  return (
    <span className={cx("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className="text-[12px] font-normal text-[#a1a1aa] line-through">{formatVND(price)}</span>
      <span className="font-semibold text-[#ff5fa2]">{formatVND(now)}</span>
    </span>
  );
}

export function Qty({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const b = "grid h-full w-8 place-items-center text-[#3f3f46] hover:bg-[#f4f4f5] disabled:opacity-40";
  return (
    <span className="inline-flex h-8 shrink-0 items-center rounded-[6px] border border-[#e5e5e7] bg-white" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={b} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Giảm"><Minus size={14} /></button>
      <span className="w-9 border-x border-[#e5e5e7] text-center text-[13px] font-medium tabular-nums leading-8">{value}</span>
      <button type="button" className={b} disabled={value >= 1000} onClick={() => onChange(value + 1)} aria-label="Tăng"><Plus size={14} /></button>
    </span>
  );
}

export function Progress({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
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

// ---------- Giảm giá + tóm tắt ----------
type Private = { code: string; amount: number; label: string };

export function useCheckout({ lines, discounts, phone, initialCode = "", initialAutoOff = false }: {
  lines: Line[]; discounts: PublicDiscount[]; phone: string; initialCode?: string; initialAutoOff?: boolean;
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
  const total = Math.max(0, subtotal - discount);
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

  // giỏ đổi → kiểm tra lại mã đang dùng / mã đang chờ đủ điều kiện
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

  const summary = (compact = false) => (
    <section className="rounded-[12px] border border-[#e5e5e7] bg-white p-4 text-[14px]">
      <p className="mb-3 text-[15px] font-semibold text-[#18181b]">{compact ? "Đơn hàng của bạn" : "Tóm tắt"}</p>
      <div className="space-y-1.5 text-[#3f3f46]">
        {items.map((it, i) => (
          <p key={`${it.id}-${i}`} className="flex justify-between gap-3"><span className="min-w-0 truncate">{it.type === "addon" ? "+ " : ""}{it.name} × {it.qty}</span><span className="shrink-0">{formatVND(it.price * it.qty)}</span></p>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-[#efeff1] pt-3">
        <p className="flex justify-between text-[#3f3f46]"><span>Tạm tính</span><span>{formatVND(subtotal)}</span></p>
        {applied && (
          <p className="flex justify-between gap-3 text-[#ff5fa2]"><span className="min-w-0 truncate">Giảm giá · {applied.code || applied.label}</span><span className="shrink-0">−{formatVND(discount)}</span></p>
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

  const discountBox = (
    <section className="rounded-[12px] border border-[#e5e5e7] bg-white p-4">
      <p className="mb-2 text-[14px] font-semibold text-[#18181b]">Mã giảm giá</p>
      {applied && (
        <div className="mb-2 flex items-center gap-2 rounded-[8px] border border-[#ffd1e5] bg-[#fff0f6] px-3 py-2 text-[13px]">
          <Tag size={14} className="shrink-0 text-[#ff5fa2]" />
          <span className="min-w-0 flex-1 text-[#18181b]">Đã áp dụng: <b className="font-semibold">{applied.label}</b> <span className="text-[#ff5fa2]">−{formatVND(discount)}</span></span>
          <button type="button" aria-label="Gỡ giảm giá" className="grid h-6 w-6 place-items-center rounded-[6px] text-[#71717a] hover:bg-white"
            onClick={() => { if (usePriv) setPriv(null); else setAutoOff(true); }}><X size={14} /></button>
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

  return { list, subtotal, discount, total, summary, discountBox, privCode: usePriv ? priv!.code : "", savedCode: priv?.code ?? "", autoOff };
}

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
export function InfoStep({ form, setForm, summary, error, sending, onBack, onSubmit, bottomBar }: {
  form: Form; setForm: (f: Form) => void; summary: React.ReactNode; error: string; sending: boolean;
  onBack: () => void; onSubmit: () => void; bottomBar: (btn: React.ReactNode) => React.ReactNode;
}) {
  const btn = (cls: string) => <button type="button" onClick={onSubmit} disabled={sending} className={cx(btnClass("primary"), cls)}>{sending ? "Đang gửi..." : "Đặt hàng"}</button>;
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:gap-10">
      <section className="min-w-0">
        <p className="mb-2.5 text-[15px] font-semibold text-[#18181b]">Thông tin nhận hàng</p>
        <div className="grid gap-4 rounded-[12px] border border-[#e5e5e7] bg-white p-4 sm:grid-cols-2 sm:p-5">
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
      <aside className="space-y-4 md:sticky md:top-24 md:self-start">
        {summary}
        {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} className="h-12 shrink-0">← Quay lại</Button>
          {btn("hidden h-12 flex-1 text-[16px] font-semibold md:inline-flex")}
        </div>
      </aside>
      {bottomBar(btn("h-11 flex-1 text-[15px] font-semibold"))}
    </div>
  );
}

export function BottomBar({ total, subtotal, children }: { total: number; subtotal: number; children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5e7] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 leading-tight">
          <span className="block text-[12px] text-[#71717a]">Tổng tiền{subtotal > total && <span className="ml-1 line-through">{formatVND(subtotal)}</span>}</span>
          <span className="block text-[18px] font-bold text-[#18181b]">{formatVND(total)}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Bước 3 ----------
export function DoneStep({ result, payment }: { result: { code: string; total: number }; payment: PaymentSettings | null }) {
  if (payment) return <div className="-mx-4 -mt-8 sm:-mt-12"><PaymentView code={result.code} settings={payment} /></div>;
  return <Success result={result} />;
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
            <Button href={`/gui-file-in?don=${encodeURIComponent(result.code)}`} icon={<Upload size={16} />}>Gửi file in</Button>
            <Button href="/custom-cd" variant="secondary" icon={<Brush size={16} />}>Tự thiết kế CD</Button>
            <Button href="/don-hang-cua-toi" variant="ghost" icon={<ListOrdered size={16} />} className="sm:col-span-2">Xem đơn hàng của tôi</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
