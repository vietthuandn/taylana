"use client";

/* Phần dùng chung giữa trang Đặt đơn và Giỏ hàng.
   Quy tắc: khoảng cách chỉ 4/8/12/16/24/32px · nhãn nhóm 13px/600 nằm TRÊN nội dung, cách 8px · nhóm cách nhau 24px
   · chip & ô số lượng cao 36px · nút chính 48px · bo: chip 8, card 12, nút 10 · viền 1px #E5E5E7 · tiền căn phải, tabular-nums.
   Giá, giảm giá, phí ship chỉ là XEM TRƯỚC — server tính lại trong create_order. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brush, Check, ChevronRight, Copy, ListOrdered, Minus, Plus, ShoppingCart, Tag, Truck, Upload, X } from "lucide-react";
import type { Option, OptionGroup, Product } from "@/lib/catalog";
import { uploadHref } from "@/lib/uploadTools";
import { FEATURE_UPLOAD_FILES } from "@/lib/features";
import { formatVND } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { saveOrderCode } from "@/lib/cart";
import { discountValue, subtotalOf, toCode, valueLabel, type CartItem, type DiscountTarget, type PublicDiscount } from "@/lib/discount";
import { shippingFor, type ShippingSettings } from "@/lib/shipping";
import type { PaymentSettings } from "@/lib/payment/settings";
import { PaymentView } from "../thanh-toan/[code]/PaymentView";
import { attachPendingDisc } from "@/lib/scrapbook/pending";
import { attachPendingFiles } from "@/lib/pendingOrderFiles";
import { Button, Field, Input, Textarea } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";

export type Step = 1 | 2 | 3;
// 1 dòng = 1 sản phẩm + các lựa chọn đã chọn (mỗi lựa chọn × số lượng)
export type Sel = { opt: Option; group: OptionGroup };
export type Line = { key: string; product: Product; qty: number; sels: Sel[] };
export type Form = { name: string; phone: string; province: string; ward: string; street: string; note: string };
export const emptyForm: Form = { name: "", phone: "", province: "", ward: "", street: "", note: "" };

// Cột ảnh dính ở: header (--header-h) + thanh bước 56px + 24px. Không dùng JS khi cuộn.
export const STICKY_TOP = "top-[calc(var(--header-h)+80px)]";

export const lineUnit = (l: Line) => l.sels.reduce((t, s) => t + s.opt.price, 0);
export const lineTotal = (l: Line) => lineUnit(l) * l.qty;
// n = (số lựa chọn) × số lượng — ví dụ 1 loại + 2 mua kèm, số lượng 2 → 6
export const lineCount = (l: Line) => l.sels.length * l.qty;
const flat = (lines: Line[]): CartItem[] => lines.flatMap((l) => l.sels.map((s) => ({
  type: s.group.select_type === "multi" ? ("addon" as const) : ("package" as const), id: s.opt.id, name: s.opt.name, price: s.opt.price, qty: l.qty,
})));
// Gửi lên server: { product_id, qty, options } (sản phẩm dựng tạm từ dữ liệu cũ → gửi dạng gói + phụ kiện)
const toRpcLines = (lines: Line[]) => lines.map((l) => {
  if (l.product.id === "legacy") {
    const t = l.sels.find((s) => s.group.select_type === "single");
    return { package_id: t?.opt.id, qty: l.qty, addons: l.sels.filter((s) => s !== t).map((s) => ({ id: s.opt.id, qty: l.qty })) };
  }
  return { product_id: l.product.id, qty: l.qty, options: l.sels.map((s) => s.opt.id) };
});
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
    <div className="sticky top-[var(--header-h)] z-20 h-14 border-b border-[#e5e5e7] bg-white [transform:translateZ(0)]">
      <Wrap className="flex h-full items-center justify-center">
        <ol className="flex items-center gap-2 overflow-x-auto">
          {steps.map((t, i) => {
            const n = (i + 1) as Step;
            const done = n < step;
            const cur = n === step;
            const can = done && step !== 3;
            return (
              <li key={t} className="flex shrink-0 items-center gap-2">
                {i > 0 && <span className={cx("h-px w-4 sm:w-8", n <= step ? "bg-[var(--c-primary)]" : "bg-[#e5e5e7]")} />}
                <button type="button" disabled={!can} onClick={() => can && onGo(n)} className={cx("flex items-center gap-2", can && "hover:opacity-80")}>
                  <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                    cur ? "bg-[var(--c-primary)] text-white" : done ? "bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border border-[#d4d4d8] text-[#a1a1aa]")}>
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
        on ? "border-[var(--c-primary)] bg-[#fff5f9] text-[var(--c-primary)] shadow-[inset_0_0_0_0.5px_#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#18181b] hover:border-[#a1a1aa]")}>
      {children}
      {on && (
        <span className="pointer-events-none absolute bottom-0 right-0 h-[14px] w-[14px] bg-[var(--c-primary)] [clip-path:polygon(100%_0,100%_100%,0_100%)]">
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
      <span className="text-[var(--c-primary)]">{formatVND(now)}</span>
    </span>
  );
}

// ---------- Giảm giá + phí ship theo bậc + Tạm tính ----------
// Mỗi phạm vi (giảm tiền hàng / giảm phí ship) dùng tối đa 1 mã.
//   "auto" = tự chọn mã tốt nhất đủ điều kiện · "none" = khách đã bỏ chọn · "private" = mã riêng tư · <id> = mã công khai
type Choice = "auto" | "none" | "private" | string;
type Private = { code: string; id: string; target: DiscountTarget; amount: number; label: string };
type Applied = { target: DiscountTarget; label: string; code: string; amount: number; id: string; isPrivate: boolean };
const TARGETS: DiscountTarget[] = ["shipping", "goods"];
const TARGET_LABEL: Record<DiscountTarget, string> = { goods: "Giảm tiền hàng", shipping: "Giảm phí vận chuyển" };
const fmtDate = (s: string) => new Date(s).toLocaleDateString("vi-VN");

export function useCheckout({ lines, discounts, shipping, phone, initialCode = "", initialAutoOff = false }: {
  lines: Line[]; discounts: PublicDiscount[]; shipping: ShippingSettings; phone: string; initialCode?: string; initialAutoOff?: boolean;
}) {
  const [choice, setChoice] = useState<Record<DiscountTarget, Choice>>(initialAutoOff ? { goods: "none", shipping: "none" } : { goods: "auto", shipping: "auto" });
  const [priv, setPriv] = useState<Private | null>(null);
  const [restore, setRestore] = useState(initialCode);
  const [open, setOpen] = useState(false);

  const items = useMemo(() => flat(lines), [lines]);
  const subtotal = subtotalOf(items);
  const ship = shippingFor(shipping, subtotal);
  const hasLines = lines.length > 0;
  const shipAfter = hasLines ? ship.after : 0;
  const sets = lines.reduce((t, l) => t + lineCount(l), 0);
  const linesKey = JSON.stringify(toRpcLines(lines));

  // mã công khai: số tiền giảm + đủ điều kiện chưa
  const pubs = useMemo(() => discounts.map((d) => {
    const amount = discountValue({ ...d, target: d.target ?? "goods" }, items, shipAfter);
    const need = d.min_order && subtotal < d.min_order ? d.min_order - subtotal : 0;
    return { d: { ...d, target: (d.target ?? "goods") as DiscountTarget }, amount, need, ok: need === 0 && amount > 0 };
  }), [discounts, items, shipAfter, subtotal]);

  const resolve = useCallback((t: DiscountTarget, ch: Record<DiscountTarget, Choice>): Applied | null => {
    const c = ch[t];
    if (c === "none" || !hasLines) return null;
    const p = priv && priv.target === t && priv.amount > 0 ? { target: t, label: priv.label || priv.code, code: priv.code, amount: priv.amount, id: priv.id, isPrivate: true } : null;
    if (c === "private") return p;
    if (c !== "auto") {
      const hit = pubs.find((x) => x.d.id === c && x.d.target === t && x.ok);
      if (hit) return { target: t, label: hit.d.label, code: "", amount: hit.amount, id: hit.d.id, isPrivate: false };
    }
    if (p) return p; // mã riêng tư hợp lệ thay cho mã công khai cùng phạm vi
    const best = pubs.filter((x) => x.d.target === t && x.ok).sort((a, b) => b.amount - a.amount)[0];
    return best ? { target: t, label: best.d.label, code: "", amount: best.amount, id: best.d.id, isPrivate: false } : null;
  }, [pubs, priv, hasLines]);

  const goods = resolve("goods", choice);
  const shipD = resolve("shipping", choice);
  const goodsAmt = Math.min(goods?.amount ?? 0, subtotal);
  const shipAmt = Math.min(shipD?.amount ?? 0, shipAfter);
  const shipPay = shipAfter - shipAmt;
  const total = Math.max(0, subtotal - goodsAmt) + shipPay;
  const savings = goodsAmt + shipAmt + (hasLines ? ship.base - ship.after : 0);

  // mã riêng tư: kiểm tra ở server (chỉ trả về hợp lệ + số tiền giảm + phạm vi)
  const check = useCallback(async (raw: string): Promise<{ ok: boolean; message: string; hint?: string; target?: DiscountTarget }> => {
    const code = toCode(raw);
    if (!code) return { ok: false, message: "Nhập mã giảm giá" };
    if (!lines.length) return { ok: false, message: "Chọn sản phẩm trước khi nhập mã" };
    if (!hasSupabase) return { ok: false, message: "Web chưa kết nối database." };
    const { data, error } = await createClient().rpc("check_discount_code", { p_code: code, p_lines: toRpcLines(lines), p_phone: phone });
    const r = data?.[0] as { ok: boolean; message: string; amount: number; label: string; need: number; potential: number; target?: DiscountTarget; discount_id?: string } | undefined;
    if (error || !r) return { ok: false, message: error?.message.includes("check_discount_code") ? "Tiệm chưa mở mã giảm giá." : error?.message ?? "Không kiểm tra được mã" };
    if (!r.ok) {
      if (priv?.code === code) setPriv(null);
      return { ok: false, message: r.message, hint: r.need > 0 ? `Mua thêm ${formatVND(r.need)} để được giảm ${formatVND(r.potential)}` : "" };
    }
    const target = r.target ?? "goods";
    setPriv({ code, id: r.discount_id ?? code, target, amount: r.amount, label: r.label });
    return { ok: true, message: "", target };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, phone, priv?.code]);

  // giỏ / lựa chọn đổi → tính lại số tiền của mã riêng tư
  useEffect(() => {
    if (!priv) return;
    const t = setTimeout(() => { check(priv.code); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);
  useEffect(() => {
    if (!restore || !lines.length) return;
    setRestore("");
    check(restore).then((r) => { if (r.ok && r.target) setChoice((c) => ({ ...c, [r.target!]: "private" })); });
  }, [restore, lines.length, check]);

  const applied = [shipD, goods].filter(Boolean) as Applied[];
  const discountBox = (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#18181b]">Mã giảm giá</p>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center text-[13px] font-medium text-[var(--c-primary)] hover:text-[#e0468a]">
          Nhập mã <ChevronRight size={16} />
        </button>
      </div>
      {applied.length ? (
        <div className="flex flex-wrap gap-2">
          {applied.map((a) => (
            <span key={a.target} className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-[#ffd1e5] bg-[#fff5f9] px-3 text-[13px]">
              {a.target === "shipping" ? <Truck size={16} className="text-[var(--c-primary)]" /> : <Tag size={16} className="text-[var(--c-primary)]" />}
              <span className="font-medium text-[#18181b]">{a.code || a.label}</span>
              <span className="tabular-nums text-[var(--c-primary)]">−{formatVND(a.target === "shipping" ? shipAmt : goodsAmt)}</span>
            </span>
          ))}
        </div>
      ) : <p className="text-[13px] text-[#a1a1aa]">Chưa áp dụng mã</p>}
      {open && (
        <DiscountModal pubs={pubs} priv={priv} choice={choice} resolve={resolve} check={check}
          onClose={() => setOpen(false)} onConfirm={(c) => { setChoice(c); setOpen(false); }} />
      )}
    </section>
  );

  // Card Tạm tính (không có dòng tổng — tổng nằm ở thanh hành động)
  const row = "flex h-7 items-center justify-between gap-3";
  const summary = (
    <section>
      <Label>Tạm tính</Label>
      <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-4 text-[14px] text-[#18181b]">
        {hasLines ? lines.map((l) => (
          <div key={l.key}>
            {l.sels.map((s) => (
              <p key={s.opt.id} className={cx(row, s.group.select_type === "multi" && "text-[13px] text-[#71717a]")}>
                <span className="min-w-0 truncate">{s.opt.name} × {l.qty}</span><span className={money}>{formatVND(s.opt.price * l.qty)}</span>
              </p>
            ))}
          </div>
        )) : <p className={cx(row, "text-[13px] text-[#71717a]")}>Chưa chọn sản phẩm</p>}
        <div className="my-2 h-px bg-[#efeff1]" />
        <p className={row}><span>Tiền hàng</span><span className={money}>{formatVND(subtotal)}</span></p>
        {hasLines && (
          <>
            <p className={row}>
              <span>Phí vận chuyển</span>
              <span className={cx(money, "flex items-baseline gap-2")}>
                {ship.after < ship.base && <span className="text-[13px] text-[#a1a1aa] line-through">{formatVND(ship.base)}</span>}
                {ship.after === 0 && ship.base > 0 ? <span className="text-[var(--c-primary)]">Miễn phí</span> : <span>{formatVND(ship.after)}</span>}
              </span>
            </p>
            {ship.next && (
              <div className="pb-2">
                <p className="text-[13px] text-[#71717a]">Mua thêm <span className="tabular-nums">{formatVND(ship.next.need)}</span> để được giảm {ship.next.percent}% phí vận chuyển</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#f4f4f5]"><div className="h-full rounded-full bg-[var(--c-primary)]" style={{ width: `${Math.round(ship.next.progress * 100)}%` }} /></div>
              </div>
            )}
            {shipping.note && <p className="pb-1 text-[13px] text-[#71717a]">{shipping.note}</p>}
          </>
        )}
        {goods && goodsAmt > 0 && (
          <p className={cx(row, "text-[var(--c-primary)]")}><span className="min-w-0 truncate">Giảm tiền hàng · {goods.code || goods.label}</span><span className={money}>−{formatVND(goodsAmt)}</span></p>
        )}
        {shipD && shipAmt > 0 && (
          <p className={cx(row, "text-[var(--c-primary)]")}><span className="min-w-0 truncate">Giảm phí vận chuyển · {shipD.code || shipD.label}</span><span className={money}>−{formatVND(shipAmt)}</span></p>
        )}
        {hasLines && (
          <>
            <div className="my-2 h-px bg-[#efeff1]" />
            <p className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[15px] font-semibold text-[#18181b]">Tổng tiền</span>
              <span className="flex items-baseline gap-2">
                {savings > 0 && <span className="text-[13px] tabular-nums text-[#a1a1aa] line-through">{formatVND(total + savings)}</span>}
                <span className="text-[20px] font-bold tabular-nums text-[var(--c-primary)]">{formatVND(total)}</span>
              </span>
            </p>
          </>
        )}
      </div>
    </section>
  );

  const discountIds = [goods, shipD].filter((a): a is Applied => !!a && !a.isPrivate).map((a) => a.id);
  const privCode = [goods, shipD].find((a) => a?.isPrivate)?.code ?? "";
  return {
    subtotal, total, savings, sets, summary, discountBox,
    submit: { code: privCode, ids: discountIds },
    savedCode: priv?.code ?? "", autoOff: choice.goods === "none" && choice.shipping === "none",
  };
}

// ---------- Modal chọn mã ----------
type PubRow = { d: PublicDiscount & { target: DiscountTarget }; amount: number; need: number; ok: boolean };
function DiscountModal({ pubs, priv, choice, resolve, check, onClose, onConfirm }: {
  pubs: PubRow[]; priv: Private | null; choice: Record<DiscountTarget, Choice>;
  resolve: (t: DiscountTarget, ch: Record<DiscountTarget, Choice>) => Applied | null;
  check: (raw: string) => Promise<{ ok: boolean; message: string; hint?: string; target?: DiscountTarget }>;
  onClose: () => void; onConfirm: (c: Record<DiscountTarget, Choice>) => void;
}) {
  // bản nháp: hiện đúng mã đang được áp dụng
  const [draft, setDraft] = useState<Record<DiscountTarget, Choice>>(() => {
    const out = { ...choice };
    for (const t of TARGETS) { const a = resolve(t, choice); out[t] = a ? (a.isPrivate ? "private" : a.id) : "none"; }
    return out;
  });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ err: string; hint: string }>({ err: "", hint: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await check(code);
    setBusy(false);
    if (!r.ok) return setMsg({ err: r.message, hint: r.hint ?? "" });
    setMsg({ err: "", hint: "" });
    setCode("");
    if (r.target) setDraft((d) => ({ ...d, [r.target!]: "private" }));
  }
  const pick = (t: DiscountTarget, v: Choice) => setDraft((d) => ({ ...d, [t]: d[t] === v ? "none" : v })); // bấm lại để bỏ chọn

  const card = (on: boolean, dim: boolean) => cx("flex w-full items-start gap-3 rounded-[12px] border bg-white p-3 text-left transition-colors",
    on ? "border-[var(--c-primary)] shadow-[inset_0_0_0_0.5px_#ff5fa2]" : "border-[#e5e5e7] hover:border-[#a1a1aa]", dim && "cursor-not-allowed opacity-50 hover:border-[#e5e5e7]");
  const radio = (on: boolean) => (
    <span className={cx("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border", on ? "border-[var(--c-primary)]" : "border-[#d4d4d8]")}>
      {on && <span className="h-2 w-2 rounded-full bg-[var(--c-primary)]" />}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal onMouseDown={onClose}>
      <div className="flex max-h-[calc(100dvh-var(--header-h)-16px)] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[12px] bg-white sm:rounded-[12px]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#e5e5e7] px-4">
          <p className="text-[16px] font-semibold text-[#18181b]">Chọn mã giảm giá</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-[8px] text-[#71717a] hover:bg-[#f4f4f5]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <form className="flex gap-2" onSubmit={apply}>
            <input className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#e5e5e7] bg-white px-3 font-mono text-[14px] uppercase text-[#18181b] placeholder:font-sans placeholder:normal-case placeholder:text-[#a1a1aa] focus:border-[var(--c-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--c-primary)]/15"
              placeholder="Nhập mã riêng tư" value={code} aria-label="Mã riêng tư"
              onChange={(e) => { setCode(toCode(e.target.value)); setMsg({ err: "", hint: "" }); }} />
            <button className="h-10 shrink-0 rounded-[10px] bg-[var(--c-primary)] px-4 text-[14px] font-medium text-white hover:bg-[var(--c-primary-hover)] disabled:opacity-50" disabled={!code || busy}>
              {busy ? "Đang kiểm tra..." : "Áp dụng"}
            </button>
          </form>
          {msg.err && <p className="mt-2 text-[13px] text-[#dc2626]">{msg.err}</p>}
          {msg.hint && <p className="mt-1 text-[13px] text-[#b45309]">{msg.hint}</p>}

          {TARGETS.map((t) => {
            const list = pubs.filter((x) => x.d.target === t);
            const mine = priv && priv.target === t ? priv : null;
            return (
              <section key={t} className="mt-6">
                <p className="mb-2 text-[13px] font-semibold text-[#18181b]">{TARGET_LABEL[t]}</p>
                <div className="flex flex-col gap-2">
                  {mine && (
                    <button type="button" className={card(draft[t] === "private", false)} onClick={() => pick(t, "private")}>
                      {radio(draft[t] === "private")}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[14px] font-semibold text-[#18181b]">{mine.code}</span>
                          <span className="rounded-[4px] bg-[var(--c-secondary)] px-1.5 text-[12px] font-medium text-[var(--c-primary)]">Mã của bạn</span>
                        </span>
                        <span className="block text-[13px] text-[#71717a]">{mine.label !== mine.code ? `${mine.label} · ` : ""}−{formatVND(mine.amount)}</span>
                      </span>
                    </button>
                  )}
                  {list.map((x) => {
                    const on = draft[t] === x.d.id;
                    return (
                      <button key={x.d.id} type="button" disabled={!x.ok} className={card(on, !x.ok)} onClick={() => x.ok && pick(t, x.d.id)}>
                        {radio(on)}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-[#18181b]">{x.d.label}</span>
                          <span className="block text-[13px] text-[#3f3f46]">{valueLabel(x.d, formatVND)}{x.ok ? ` · −${formatVND(x.amount)}` : ""}</span>
                          <span className="block text-[12px] text-[#71717a]">
                            {x.d.min_order ? `Đơn từ ${formatVND(x.d.min_order)}` : "Mọi đơn hàng"}{x.d.ends_at ? ` · HSD ${fmtDate(x.d.ends_at)}` : ""}
                          </span>
                          {x.need > 0 && <span className="block text-[12px] text-[#b45309]">Mua thêm {formatVND(x.need)}</span>}
                        </span>
                      </button>
                    );
                  })}
                  {!list.length && !mine && <p className="text-[13px] text-[#a1a1aa]">Chưa có mã nào.</p>}
                </div>
              </section>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-[#e5e5e7] p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => {
            // giữ "tự chọn tốt nhất" nếu khách để nguyên mã tốt nhất → khi giỏ đổi vẫn tự chọn lại
            const out = { ...draft };
            for (const t of TARGETS) {
              const best = resolve(t, { goods: "auto", shipping: "auto" });
              if (best && (draft[t] === best.id || (draft[t] === "private" && best.isPrivate))) out[t] = "auto";
            }
            onConfirm(out);
          }} className="h-12 w-full rounded-[10px] bg-[var(--c-primary)] text-[16px] font-semibold text-white hover:bg-[var(--c-primary-hover)]">Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Thanh hành động: 1 dải ngang cố định ở đáy màn hình (render ở cấp trang) ----------
// Máy tính: cao 72px (+ safe-area), 1 hàng. Điện thoại: tổng tiền ở trên, các nút ở dưới.
export function ActionBar({ sets, total, savings, label, onPrimary, disabled, onCart, bump = 0 }: {
  sets: number; total: number; savings: number; label: string; onPrimary: () => void; disabled?: boolean;
  onCart?: () => void; bump?: number;
}) {
  // 1 cụm căn PHẢI: [tổng tiền] → 16px → [giỏ] → 8px → [Đặt đơn]. Điện thoại: tổng tiền trái, nút phải, cùng 1 hàng.
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e7] bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <Wrap className="flex min-h-[72px] items-center justify-between gap-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 lg:justify-end">
        <div className="min-w-0 lg:text-right">
          <p className="truncate text-[13px] text-[#71717a]">Tổng cộng ({sets} sản phẩm)</p>
          <p className="text-[22px] font-bold leading-tight tabular-nums text-[var(--c-primary)]">{formatVND(total)}</p>
          {savings > 0 && <p className="text-[12px] tabular-nums text-[#71717a]">Tiết kiệm: {formatVND(savings)}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onCart && (
            <button key={bump} type="button" onClick={onCart} title="Thêm vào giỏ hàng" aria-label="Thêm vào giỏ hàng"
              className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[#e5e5e7] bg-white text-[#18181b] hover:bg-[#f4f4f5]", bump > 0 && "animate-[cartBump_.45s_ease]")}>
              <ShoppingCart size={20} />
            </button>
          )}
          <button type="button" onClick={onPrimary} disabled={disabled}
            className="h-11 min-w-[120px] rounded-[10px] bg-[var(--c-primary)] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--c-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 lg:w-[180px]">
            {label}
          </button>
        </div>
      </Wrap>
    </div>
  );
}
// Chừa chỗ cho thanh hành động: chiều cao thanh + 24px (điện thoại thanh cao hơn vì xếp 2 hàng)
export const MOBILE_PAD = "pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-[calc(96px+env(safe-area-inset-bottom))]";

// ---------- Gửi đơn ----------
export async function submitOrder(lines: Line[], form: Form, opts: { code: string; ids: string[] }) {
  if (!lines.length) throw new Error("Bạn chưa chọn sản phẩm nào.");
  if (!form.name.trim()) throw new Error("Vui lòng nhập tên.");
  const phone = normalizePhone(form.phone);
  if (!phone) throw new Error(PHONE_ERROR);
  if (!hasSupabase) throw new Error("Web chưa kết nối database.");
  const { data, error } = await createClient().rpc("create_order", {
    p_customer_name: form.name, p_phone: phone, p_address: "", p_note: form.note,
    p_order_type: "cd", p_lines: toRpcLines(lines),
    p_discount_code: opts.code, p_discount_ids: opts.ids, p_auto_discount: false,
    p_province: form.province, p_ward: form.ward, p_street: form.street,
  });
  if (error || !data?.[0]) throw new Error(error?.message ?? "Gửi đơn thất bại, bạn thử lại nhé.");
  saveOrderCode(data[0].order_code);
  // CD Template: file in mặt đĩa đang chờ trên máy khách → tải lên + gắn vào đơn vừa tạo (lỗi thì bỏ qua, khách gửi sau được)
  if (data[0].order_id) { await attachPendingDisc(data[0].order_id as string); await attachPendingFiles(data[0].order_id as string); } // + Booklet Lyrics
  return { code: data[0].order_code as string, total: data[0].order_total as number };
}

// Tự điền tên + SĐT khi khách đã đăng nhập
export function useAutofill(setForm: (f: (x: Form) => Form) => void) {
  useEffect(() => {
    if (!hasSupabase) return;
    createClient().auth.getUser().then(({ data }) => {
      const m = data.user?.user_metadata;
      if (!m) return;
      // thông tin nhận hàng mặc định (trang Tài khoản) → ưu tiên; không có thì lấy tên + SĐT tài khoản
      const d = (m.ship ?? {}) as Partial<Form>;
      setForm((f) => ({ ...f,
        name: f.name || d.name || (m.display_name as string) || "", phone: f.phone || d.phone || (m.phone as string) || "",
        province: f.province || d.province || "", ward: f.ward || d.ward || "", street: f.street || d.street || "" }));
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
      </aside>
      <ActionBar sets={co.sets} total={co.total} savings={co.savings} label={sending ? "Đang gửi..." : "Đặt hàng"} onPrimary={onSubmit} disabled={sending} />
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
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--c-secondary)] text-[var(--c-primary)]"><Check size={24} /></span>
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
            {FEATURE_UPLOAD_FILES && <Button href={uploadHref(result.code)} icon={<Upload size={16} />}>Gửi file in</Button>}
            <Button href="/thiet-ke/cd" variant="secondary" icon={<Brush size={16} />}>Tự thiết kế CD</Button>
            <Button href="/don-hang-cua-toi" variant="ghost" icon={<ListOrdered size={16} />} className="sm:col-span-2">Xem đơn hàng của tôi</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
