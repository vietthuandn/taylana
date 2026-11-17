"use client";

/* Giỏ hàng — cùng hệ thống với trang Đặt đơn: trái 7/12 danh sách · phải 5/12 mã giảm giá + Tạm tính + thanh hành động.
   Mỗi phụ kiện tính 1 cái cho mỗi bộ (nhân theo số lượng của dòng). Tạo 1 đơn gồm nhiều dòng. */
import { useMemo, useState } from "react";
import Image from "next/image";
import { Disc3, ShoppingCart, Trash2 } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { cart, useCart } from "@/lib/cart";
import type { PublicDiscount } from "@/lib/discount";
import type { ShippingSettings } from "@/lib/shipping";
import type { PaymentSettings } from "@/lib/payment/settings";
import { Button } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { ActionBar, DoneStep, InfoStep, Label, MOBILE_PAD, Qty, Stepper, Wrap, emptyForm, lineTotal, submitOrder, useAutofill, useCheckout, type Form, type Line, type Step } from "../dat-don/checkout";

const thumb = (p: Package) => (p.images ?? []).find(Boolean) ?? p.image_url ?? null;

export function CartView({ packages, addons, discounts, shipping, payment }: { packages: Package[]; addons: Addon[]; discounts: PublicDiscount[]; shipping: ShippingSettings; payment: PaymentSettings | null }) {
  const raw = useCart();
  const [off, setOff] = useState<Set<string>>(new Set()); // dòng bỏ chọn (mặc định chọn hết)
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; total: number } | null>(null);
  useAutofill(setForm);

  // Giá làm mới theo database; gói bị ẩn / đổi giá / phụ kiện ngừng bán thì báo
  const rows = useMemo(() => raw.map((c) => {
    const pkg = packages.find((p) => p.id === c.package_id);
    const ad = c.addons.filter((a) => a.qty > 0).map((a) => addons.find((x) => x.id === a.id));
    const line: Line | null = pkg ? { key: c.id, pkg, qty: c.quantity, addons: ad.filter(Boolean).map((a) => ({ addon: a!, qty: c.quantity })) } : null;
    let note = "";
    if (!pkg) note = "Gói này đã ngừng bán — hãy xoá khỏi giỏ.";
    else if (c.unit_price && c.unit_price !== pkg.price) note = `Giá đã đổi từ ${formatVND(c.unit_price)} thành ${formatVND(pkg.price)}`;
    else if (ad.some((a) => !a)) note = "Một số phụ kiện đã ngừng bán và được bỏ ra.";
    return { c, line, note };
  }), [raw, packages, addons]);
  const chosen = rows.filter((r) => r.line && !off.has(r.c.id)).map((r) => r.line!);
  const co = useCheckout({ lines: chosen, discounts, shipping, phone: form.phone });

  function go(s: Step) { setError(""); setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function submit() {
    setError(""); setSending(true);
    try {
      const ids = chosen.map((l) => l.key);
      const r = await submitOrder(chosen, form, { code: co.privCode, autoOff: co.autoOff });
      cart.remove(ids); // xoá các dòng đã đặt
      setResult(r); go(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Gửi đơn thất bại"); }
    setSending(false);
  }
  const toggle = (id: string) => setOff((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (!raw.length && step === 1) {
    return (
      <Wrap className="py-16 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f4f4f5] text-[#a1a1aa]"><ShoppingCart size={24} /></span>
        <h1 className="mt-4 font-sans text-[22px] font-bold normal-case tracking-[-0.02em] text-[#18181b]">Giỏ hàng trống</h1>
        <p className="mt-2 text-[14px] text-[#71717a]">Chọn gói CD bạn thích rồi bấm nút giỏ hàng để thêm vào đây nhé.</p>
        <Button href="/dat-don" className="mt-6">Đặt đơn ngay</Button>
      </Wrap>
    );
  }

  const allOn = rows.every((r) => !r.line || !off.has(r.c.id));
  return (
    <div className="flex flex-1 flex-col">
      <Stepper step={step} onGo={go} />
      <Wrap className={cx("pt-6", step !== 3 ? MOBILE_PAD : "pb-8")}>
        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            <section className="min-w-0 lg:col-span-7">
              <div className="mb-2 flex items-center justify-between">
                <Label>Giỏ hàng ({raw.length})</Label>
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-[13px] text-[#71717a]">
                  <input type="checkbox" className="h-4 w-4 accent-[#ff5fa2]" checked={allOn}
                    onChange={(e) => setOff(e.target.checked ? new Set() : new Set(rows.map((r) => r.c.id)))} /> Chọn tất cả
                </label>
              </div>
              <ul className="divide-y divide-[#efeff1] overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
                {rows.map(({ c, line, note }) => {
                  const img = line ? thumb(line.pkg) : null;
                  return (
                    <li key={c.id} className="flex items-center gap-3 p-4">
                      <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#ff5fa2]" disabled={!line} checked={!!line && !off.has(c.id)}
                        aria-label="Chọn dòng này" onChange={() => toggle(c.id)} />
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border border-[#e5e5e7] bg-[#f4f4f5]">
                        {img ? <Image src={img} alt="" fill sizes="64px" className="object-cover" /> : <Disc3 size={24} strokeWidth={1.2} className="absolute inset-0 m-auto text-[#d4d4d8]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cx("truncate text-[14px] font-semibold", line ? "text-[#18181b]" : "text-[#a1a1aa] line-through")}>{line?.pkg.name ?? "Gói đã ngừng bán"}</p>
                        {line && line.addons.length > 0 && <p className="truncate text-[13px] text-[#71717a]">+ {line.addons.map((a) => a.addon.name).join(", ")}</p>}
                        {note && <p className="truncate text-[12px] text-[#b45309]">{note}</p>}
                      </div>
                      {line ? <Qty value={c.quantity} min={1} onChange={(v) => cart.update(c.id, { quantity: v })} /> : <span className="w-[120px] shrink-0" />}
                      <span className="hidden w-24 shrink-0 text-right text-[14px] font-semibold tabular-nums text-[#18181b] sm:block">{line ? formatVND(lineTotal(line)) : "—"}</span>
                      <button type="button" aria-label="Xoá" onClick={() => cart.remove([c.id])}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <aside className="flex min-w-0 flex-col gap-6 lg:col-span-5">
              {co.discountBox}
              {co.summary}
              {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}
              <ActionBar sets={co.sets} total={co.total} savings={co.savings} label={`Đặt đơn (${co.sets})`} onPrimary={() => go(2)} disabled={!chosen.length} />
            </aside>
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
