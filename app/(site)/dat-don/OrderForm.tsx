"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { Stepper } from "@/components/site/Stepper";
import { Button } from "@/components/ui/Button";
import { CdDisc, Sparkle, WavyFrame } from "@/components/ui/Shapes";

type Result = { code: string; total: number };
const tints = ["bg-violet-100", "bg-lime-100", "bg-hot-100"];

function StepHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-500 font-display text-2xl text-white">{n}</span>
      <div>
        <h2 className="text-3xl sm:text-4xl">{title}</h2>
        {hint && <p className="text-sm text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

export function OrderForm({ packages, addons }: { packages: Package[]; addons: Addon[] }) {
  const params = useSearchParams();
  const pre = params.get("goi");
  const [packageId, setPackageId] = useState<string>(packages.some((p) => p.id === pre) ? pre! : "");
  const [qty, setQty] = useState(1);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const pkg = packages.find((p) => p.id === packageId);
  const total = useMemo(() => {
    let t = pkg ? pkg.price * qty : 0;
    for (const a of addons) t += (addonQty[a.id] ?? 0) * a.price;
    return t;
  }, [pkg, qty, addons, addonQty]);

  function toggleAddon(id: string) {
    setAddonQty((cur) => {
      const next = { ...cur };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pkg) {
      setError("Bạn chưa chọn gói sản phẩm.");
      document.getElementById("buoc-1")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 8) {
      setError("Vui lòng nhập tên và số điện thoại/Zalo hợp lệ.");
      return;
    }
    if (!hasSupabase) {
      setError("Web chưa kết nối database.");
      return;
    }
    setSending(true);
    const { data, error } = await createClient().rpc("create_order", {
      p_customer_name: form.name,
      p_phone: form.phone,
      p_address: form.address,
      p_note: form.note,
      p_package_id: pkg.id,
      p_quantity: qty,
      p_addons: Object.entries(addonQty).map(([id, q]) => ({ id, qty: q })),
      p_order_type: "cd",
    });
    setSending(false);
    if (error || !data?.[0]) {
      setError(error?.message ?? "Gửi đơn thất bại, bạn thử lại nhé.");
      return;
    }
    setResult({ code: data[0].order_code, total: data[0].order_total });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) return <Success result={result} />;

  if (!packages.length) {
    return <p className="mx-auto max-w-md px-4 text-center">Tiệm đang cập nhật bảng giá, bạn quay lại sau hoặc nhắn tiệm qua Zalo nhé!</p>;
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl px-4 pb-32">
      {/* ---- Bước 1: chọn gói ---- */}
      <section id="buoc-1" className="scroll-mt-24">
        <StepHeading n={1} title="Chọn gói" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p, i) => {
            const active = p.id === packageId;
            return (
              <label key={p.id}
                className={`relative flex cursor-pointer flex-col rounded-[20px] border-2 bg-white p-4 transition ${active ? "border-violet-500 ring-4 ring-violet-100" : "border-lime-500 hover:-translate-y-0.5"}`}>
                <input type="radio" name="package" value={p.id} checked={active} onChange={() => setPackageId(p.id)} className="sr-only" />
                {active && <span className="eyebrow absolute right-3 top-3 z-10 bg-violet-500 text-white">✓ Đã chọn</span>}
                <div className="flex gap-4 sm:block">
                  <WavyFrame shape="cloud" border={i % 2 ? "violet" : "lime"} className="aspect-square w-24 shrink-0 sm:mb-4 sm:w-full">
                    {p.image_url ? (
                      <Image src={p.image_url} alt={p.name} fill sizes="(min-width:640px) 360px, 96px" className="object-cover" />
                    ) : (
                      <div className={`grid h-full place-items-center ${tints[i % 3]}`}><CdDisc className="w-1/2" /></div>
                    )}
                  </WavyFrame>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-2xl">{p.name}</h3>
                    <p className="font-display text-2xl text-hot-500">{formatVND(p.price)}</p>
                    {p.description && <p className="mt-1 text-sm">{p.description}</p>}
                  </div>
                </div>
                {p.features.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {p.features.map((f) => <li key={f} className="rounded-full bg-lime-100 px-2.5 py-1 text-xs font-semibold text-ink-900">{f}</li>)}
                  </ul>
                )}
                <span className={`btn btn-sm mt-4 ${active ? "btn-lime" : "btn-ghost"}`}>{active ? "Gói đã chọn" : "Chọn gói này"}</span>
              </label>
            );
          })}
        </div>
        {pkg && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="font-semibold text-ink-900">Số lượng:</span>
            <Stepper value={qty} onChange={setQty} />
          </div>
        )}
      </section>

      {/* ---- Bước 2: phụ kiện ---- */}
      {addons.length > 0 && (
        <section className="mt-14">
          <StepHeading n={2} title="Phụ kiện mua kèm" hint="Không bắt buộc — chọn bao nhiêu tuỳ thích." />
          <div className="grid gap-3 sm:grid-cols-2">
            {addons.map((a) => {
              const q = addonQty[a.id] ?? 0;
              return (
                <div key={a.id} className={`flex items-center gap-3 rounded-full border-[1.5px] p-2 pr-3 transition ${q ? "border-lime-500 bg-lime-500" : "border-ink-900 bg-white"}`}>
                  <button type="button" onClick={() => toggleAddon(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-pressed={q > 0}>
                    <span className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full text-lg font-bold ${q ? "bg-ink-900 text-lime-500" : "bg-cream-100 text-ink-900"}`}>
                      {a.image_url ? <Image src={a.image_url} alt="" width={48} height={48} className="h-full w-full object-cover" /> : q ? "✓" : "+"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-ink-900">{a.name}</span>
                      <span className="block truncate text-xs text-ink-600">{a.description}</span>
                    </span>
                  </button>
                  {q > 0 ? <Stepper value={q} onChange={(v) => setAddonQty({ ...addonQty, [a.id]: v })} />
                    : <span className="shrink-0 font-display text-lg text-hot-500">+{formatVND(a.price)}</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Bước 3: thông tin ---- */}
      <section className="mt-14">
        <StepHeading n={addons.length ? 3 : 2} title="Thông tin nhận hàng" />
        <div className="panel grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-900">Tên của bạn *</span>
            <input className="field" required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-900">Số điện thoại / Zalo *</span>
            <input className="field" required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-ink-900">Địa chỉ nhận hàng</span>
            <textarea className="field" rows={2} maxLength={500} autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-ink-900">Ghi chú cho tiệm</span>
            <textarea className="field" rows={3} maxLength={2000} placeholder="Ví dụ: tên album, màu sắc mong muốn, ngày cần nhận..."
              value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
        </div>
      </section>

      {error && <p className="mt-6 rounded-full bg-hot-100 px-5 py-3 text-center font-semibold text-hot-700">{error}</p>}

      {/* ---- Thanh tổng tiền dính ở đáy màn hình ---- */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full bg-ink-900 py-2 pl-6 pr-2 shadow-[0_10px_30px_rgba(20,20,20,.3)]">
          <div className="min-w-0 leading-tight">
            <span className="block text-xs uppercase tracking-widest text-white/60">Tạm tính</span>
            <span className="block font-display text-2xl text-lime-500">{formatVND(total)}</span>
          </div>
          <button type="submit" disabled={sending} className="btn btn-lime shrink-0">{sending ? "Đang gửi..." : "Gửi đơn →"}</button>
        </div>
      </div>
    </form>
  );
}

function Success({ result }: { result: Result }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="mx-auto max-w-xl px-4 pb-10">
      <div className="relative overflow-hidden rounded-[32px] bg-lime-500 px-6 py-12 text-center">
        <Sparkle color="white" className="absolute left-6 top-6 h-8 w-8 animate-twinkle" />
        <Sparkle className="absolute bottom-6 right-6 h-8 w-8 animate-twinkle" />
        <h2 className="text-4xl sm:text-5xl">Tiệm đã nhận đơn!</h2>
        <p className="mt-3 text-ink-700">Mã đơn của bạn:</p>
        <p className="mx-auto mt-2 inline-block rounded-full bg-ink-900 px-6 py-2 font-display text-3xl tracking-wider text-white">{result.code}</p>
        <div>
          <button type="button" className="mt-3 text-sm font-semibold underline"
            onClick={() => { navigator.clipboard?.writeText(result.code); setCopied(true); }}>
            {copied ? "✓ Đã sao chép" : "Sao chép mã đơn"}
          </button>
        </div>
        <p className="mt-4 text-ink-900">Tạm tính: <b className="font-display text-2xl">{formatVND(result.total)}</b></p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-ink-700">
          Lưu lại mã đơn để gửi file in nhé. Tiệm sẽ liên hệ qua Zalo/SĐT để xác nhận và báo phí ship.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button href={`/gui-file-in?ma=${encodeURIComponent(result.code)}`}>Gửi file in ngay →</Button>
          <Button href="/huong-dan" variant="ghost">Hướng dẫn làm file</Button>
        </div>
      </div>
    </section>
  );
}
