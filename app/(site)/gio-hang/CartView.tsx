"use client";

/* Giỏ hàng: chọn dòng muốn đặt → Bước 2 (thông tin) → Bước 3 (thanh toán). Tạo 1 đơn gồm nhiều dòng. */
import { useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Disc3, ShoppingCart, Trash2 } from "lucide-react";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { cart, useCart } from "@/lib/cart";
import { unitPrice, type PublicDiscount } from "@/lib/discount";
import type { PaymentSettings } from "@/lib/payment/settings";
import { Button } from "@/components/ui/kit";
import { btnClass, cx } from "@/components/ui/styles";
import { BottomBar, DoneStep, InfoStep, Price, Progress, Qty, emptyForm, lineTotal, submitOrder, useAutofill, useCheckout, type Form, type Line, type Step } from "../dat-don/checkout";

const thumb = (p: Package) => (p.images ?? []).find(Boolean) ?? p.image_url ?? null;

export function CartView({ packages, addons, discounts, payment }: { packages: Package[]; addons: Addon[]; discounts: PublicDiscount[]; payment: PaymentSettings | null }) {
  const raw = useCart();
  const [off, setOff] = useState<Set<string>>(new Set()); // dòng bỏ chọn (mặc định chọn hết)
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; total: number } | null>(null);
  useAutofill(setForm);

  // Làm mới giá theo database; gói bị ẩn / phụ kiện ngừng bán thì báo
  const rows = useMemo(() => raw.map((c) => {
    const pkg = packages.find((p) => p.id === c.package_id);
    const ad = c.addons.filter((a) => a.qty > 0).map((a) => ({ addon: addons.find((x) => x.id === a.id), qty: a.qty }));
    const line: Line | null = pkg ? { key: c.id, pkg, qty: c.quantity, addons: ad.filter((a) => a.addon).map((a) => ({ addon: a.addon!, qty: a.qty })) } : null;
    const notes: string[] = [];
    if (!pkg) notes.push("Gói này đã ngừng bán — hãy xoá khỏi giỏ.");
    else if (c.unit_price && c.unit_price !== pkg.price) notes.push(`Giá gói đã đổi từ ${formatVND(c.unit_price)} thành ${formatVND(pkg.price)}.`);
    if (ad.some((a) => !a.addon)) notes.push("Một số phụ kiện đã ngừng bán và được bỏ ra.");
    return { c, line, notes };
  }), [raw, packages, addons]);
  const chosen = rows.filter((r) => r.line && !off.has(r.c.id)).map((r) => r.line!);
  const co = useCheckout({ lines: chosen, discounts, phone: form.phone });

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
  const bar = (btn: React.ReactNode) => <BottomBar total={co.total} subtotal={co.subtotal}>{btn}</BottomBar>;

  if (step === 3 && result) {
    return <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6"><div className="mb-6"><Progress step={3} onGo={go} /></div><DoneStep result={result} payment={payment} /></div>;
  }

  if (!raw.length) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f4f4f5] text-[#a1a1aa]"><ShoppingCart size={24} /></span>
        <h1 className="mt-4 font-sans text-[22px] font-bold normal-case tracking-[-0.02em] text-[#18181b]">Giỏ hàng trống</h1>
        <p className="mt-1 text-[15px] text-[#71717a]">Chọn gói CD bạn thích rồi bấm “Thêm vào giỏ” nhé.</p>
        <Button href="/dat-don" className="mt-5">Đặt đơn ngay</Button>
      </div>
    );
  }

  const allOn = rows.every((r) => !r.line || !off.has(r.c.id));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:pb-12 md:pt-6">
      <div className="mb-5 md:mb-7"><Progress step={step} onGo={go} /></div>

      {step === 1 && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:gap-10">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="font-sans text-[22px] font-bold normal-case tracking-[-0.02em] text-[#18181b]">Giỏ hàng <span className="text-[15px] font-normal text-[#71717a]">({raw.length})</span></h1>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#3f3f46]">
                <input type="checkbox" className="h-4 w-4 accent-[#ff5fa2]" checked={allOn}
                  onChange={(e) => setOff(e.target.checked ? new Set() : new Set(rows.map((r) => r.c.id)))} /> Chọn tất cả
              </label>
            </div>
            <ul className="divide-y divide-[#efeff1] overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
              {rows.map(({ c, line, notes }) => {
                const on = !!line && !off.has(c.id);
                const img = line ? thumb(line.pkg) : null;
                return (
                  <li key={c.id} className="flex gap-3 p-3 sm:p-4">
                    <input type="checkbox" className="mt-6 h-4 w-4 shrink-0 accent-[#ff5fa2]" disabled={!line} checked={on} aria-label="Chọn dòng này"
                      onChange={() => setOff((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border border-[#e5e5e7] bg-[#f4f4f5]">
                      {img ? <Image src={img} alt="" fill sizes="64px" className="object-cover" /> : <Disc3 size={28} strokeWidth={1.2} className="absolute inset-0 m-auto text-[#d4d4d8]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cx("truncate text-[14px] font-medium", line ? "text-[#18181b]" : "text-[#a1a1aa] line-through")}>{line?.pkg.name ?? "Gói đã ngừng bán"}</p>
                      {line && line.addons.length > 0 && (
                        <p className="truncate text-[12px] text-[#71717a]">+ {line.addons.map((a) => `${a.addon.name} × ${a.qty}`).join(", ")}</p>
                      )}
                      {line && <p className="mt-0.5 text-[13px]"><Price price={line.pkg.price} now={unitPrice(co.list, { type: "package", id: line.pkg.id, price: line.pkg.price })} /> <span className="text-[12px] text-[#a1a1aa]">/ gói</span></p>}
                      {notes.map((n) => <p key={n} className="mt-1 flex items-center gap-1 text-[12px] text-[#b45309]"><AlertTriangle size={12} /> {n}</p>)}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {line ? <Qty value={c.quantity} min={1} onChange={(v) => cart.update(c.id, { quantity: v })} /> : <span />}
                        <div className="flex items-center gap-2">
                          {line && <span className="text-[14px] font-semibold text-[#18181b]">{formatVND(lineTotal(line))}</span>}
                          <button type="button" aria-label="Xoá" onClick={() => cart.remove([c.id])}
                            className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="space-y-4 md:sticky md:top-24 md:self-start">
            {co.summary()}
            {co.discountBox}
            {error && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p>}
            <button type="button" disabled={!chosen.length} onClick={() => go(2)} className={cx(btnClass("primary"), "hidden h-12 w-full text-[16px] font-semibold md:inline-flex")}>
              <Check size={16} /> Đặt hàng ({chosen.length})
            </button>
          </aside>
          {bar(<button type="button" disabled={!chosen.length} onClick={() => go(2)} className={cx(btnClass("primary"), "h-11 flex-1 text-[15px] font-semibold")}>Đặt hàng ({chosen.length})</button>)}
        </div>
      )}

      {step === 2 && (
        <InfoStep form={form} setForm={setForm} summary={co.summary(true)} error={error} sending={sending}
          onBack={() => go(1)} onSubmit={submit} bottomBar={bar} />
      )}
    </div>
  );
}
