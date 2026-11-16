"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Addon, Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { Stepper } from "@/components/site/Stepper";
import { CdIcon, FlowerIcon, HeartIcon, StarIcon } from "@/components/decor/Icons";

type Result = { code: string; total: number };

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-2xl">
      <span className="pop-sm grid h-10 w-10 shrink-0 place-items-center rounded-full bg-butter-100 text-xl">{n}</span>
      {title}
    </h2>
  );
}

export function OrderForm({ packages, addons }: { packages: Package[]; addons: Addon[] }) {
  const [packageId, setPackageId] = useState<string>("");
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
    return (
      <p className="mx-auto max-w-md px-4 text-center text-cocoa-500">
        Tiệm đang cập nhật bảng giá, bạn quay lại sau hoặc nhắn tiệm qua Zalo nhé!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl px-4 pb-32">
      {/* ---- Bước 1: chọn gói ---- */}
      <section id="buoc-1" className="scroll-mt-28">
        <StepHeading n={1} title="Chọn gói sản phẩm" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p, i) => {
            const active = p.id === packageId;
            return (
              <label
                key={p.id}
                className={`pop relative flex cursor-pointer flex-col rounded-[2rem] p-4 transition ${
                  active ? "bg-pink-200 -translate-y-1" : "bg-cream-50 hover:-translate-y-0.5"
                }`}
              >
                <input type="radio" name="package" value={p.id} checked={active}
                  onChange={() => setPackageId(p.id)} className="sr-only" />
                {active && (
                  <span className="pop-sm absolute -right-2 -top-3 z-10 rotate-6 rounded-full bg-butter-200 px-3 py-1 font-display text-sm">
                    ✓ Đã chọn
                  </span>
                )}
                <div className="flex gap-4 sm:block">
                <div className={`sticker aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-matcha-100 sm:mb-4 sm:w-full ${i % 2 ? "rotate-1" : "-rotate-1"}`}>
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <CdIcon className="h-14 w-14 sm:h-24 sm:w-24" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                  <h3 className="text-xl">{p.name}</h3>
                  <span className="shrink-0 font-display text-xl text-pink-500">{formatVND(p.price)}</span>
                </div>
                {p.description && <p className="mt-1 text-sm text-cocoa-500">{p.description}</p>}
                </div>
                </div>
                {p.features.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <FlowerIcon className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <span className={`btn mt-4 !min-h-11 !text-base ${active ? "bg-cream-50" : "bg-pink-200"}`}>
                  {active ? "Gói đã chọn ♡" : "Chọn gói này"}
                </span>
              </label>
            );
          })}
        </div>

        {pkg && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="font-medium">Số lượng:</span>
            <Stepper value={qty} onChange={setQty} />
          </div>
        )}
      </section>

      {/* ---- Bước 2: phụ kiện ---- */}
      {addons.length > 0 && (
        <section className="mt-12">
          <StepHeading n={2} title="Phụ kiện mua kèm" />
          <p className="-mt-2 mb-4 text-sm text-cocoa-500">Không bắt buộc — chọn bao nhiêu tuỳ thích.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {addons.map((a) => {
              const q = addonQty[a.id] ?? 0;
              return (
                <div key={a.id}
                  className={`pop-sm flex items-center gap-3 rounded-3xl p-3 transition ${q ? "bg-matcha-200" : "bg-cream-50"}`}>
                  <button type="button" onClick={() => toggleAddon(a.id)} className="flex flex-1 items-center gap-3 text-left" aria-pressed={q > 0}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-cocoa-700 ${q ? "bg-pink-300" : "bg-white"}`}>
                      {q > 0 && "✓"}
                    </span>
                    {a.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl border-2 border-white object-cover" loading="lazy" />
                    ) : (
                      <HeartIcon className="h-10 w-10 shrink-0 text-pink-200" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-display text-lg leading-tight">{a.name}</span>
                      {a.description && <span className="block text-xs text-cocoa-500">{a.description}</span>}
                      <span className="block text-sm font-bold text-pink-500">+{formatVND(a.price)}</span>
                    </span>
                  </button>
                  {q > 0 && <Stepper value={q} onChange={(v) => setAddonQty({ ...addonQty, [a.id]: v })} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Bước 3: thông tin ---- */}
      <section className="mt-12">
        <StepHeading n={addons.length ? 3 : 2} title="Thông tin nhận hàng" />
        <div className="pop stitch grid gap-4 rounded-[2rem] bg-cream-50 p-5 sm:grid-cols-2 sm:p-7">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tên của bạn *</span>
            <input className="field" required maxLength={100} autoComplete="name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Số điện thoại / Zalo *</span>
            <input className="field" required type="tel" inputMode="tel" maxLength={20} autoComplete="tel"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Địa chỉ nhận hàng</span>
            <textarea className="field" rows={2} maxLength={500} autoComplete="street-address"
              value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Ghi chú cho tiệm</span>
            <textarea className="field" rows={3} maxLength={2000}
              placeholder="Ví dụ: tên album, màu sắc mong muốn, ngày cần nhận..."
              value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
        </div>
      </section>

      {error && <p className="mt-6 rounded-2xl bg-pink-100 px-4 py-3 text-center text-pink-500">{error}</p>}

      {/* ---- Thanh tổng tiền dính ở đáy màn hình ---- */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3">
        <div className="pop mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full bg-cream-50 py-2 pl-5 pr-2">
          <div className="min-w-0 leading-tight">
            <span className="block text-xs text-cocoa-400">Tạm tính</span>
            <span className="block font-display text-2xl text-pink-500">{formatVND(total)}</span>
          </div>
          <button type="submit" disabled={sending} className="btn shrink-0 bg-pink-300">
            {sending ? "Đang gửi..." : "Gửi đơn ♡"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Success({ result }: { result: Result }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="mx-auto max-w-lg px-4 pb-10">
      <div className="tape pop relative rounded-[2rem] bg-matcha-100 px-6 py-10 text-center">
        <StarIcon className="absolute left-6 top-6 h-8 w-8 text-butter-200 animate-wiggle" />
        <HeartIcon className="absolute bottom-6 right-6 h-8 w-8 text-pink-300 animate-float" />
        <h2 className="text-3xl">Tiệm đã nhận đơn rồi nè! ✿</h2>
        <p className="mt-2 text-cocoa-500">Mã đơn của bạn là:</p>
        <p className="pop-sm mx-auto mt-3 inline-block rounded-2xl bg-white px-5 py-2 font-display text-3xl tracking-wider">
          {result.code}
        </p>
        <div>
          <button type="button" className="mt-3 text-sm underline"
            onClick={() => { navigator.clipboard?.writeText(result.code); setCopied(true); }}>
            {copied ? "✓ Đã sao chép" : "Sao chép mã đơn"}
          </button>
        </div>
        <p className="mt-4">Tạm tính: <b className="text-pink-500">{formatVND(result.total)}</b></p>
        <p className="mt-4 text-sm text-cocoa-500">
          Bạn nhớ lưu lại mã đơn để nộp file in nhé. Tiệm sẽ liên hệ qua Zalo/SĐT để xác nhận và báo phí ship.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/nop-file?ma=${encodeURIComponent(result.code)}`} className="btn bg-pink-300">Nộp file ngay →</Link>
          <Link href="/huong-dan" className="btn bg-cream-50">Hướng dẫn làm file</Link>
        </div>
      </div>
    </section>
  );
}
