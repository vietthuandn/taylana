"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, CreditCard, Search, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { formatDate, formatVND, statusLabels } from "@/lib/format";
import { uploadHref } from "@/lib/uploadTools";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { saveOrderCode, savedOrderCodes } from "@/lib/cart";
import { paymentLabels, paymentTone, type PaymentStatus } from "@/lib/payment/settings";
import type { OrderSummary } from "@/lib/myOrders";
import { AuthDialog } from "@/components/site/AuthDialog";
import { Badge, Button, Field, Input } from "@/components/ui/kit";
import { btnClass, cx } from "@/components/ui/styles";

const prodTone = { new: "gray", in_progress: "amber", delivered: "green" } as const;

function OrderCard({ o }: { o: OrderSummary }) {
  const [open, setOpen] = useState(false);
  const ps = (o.payment_status ?? "unpaid") as PaymentStatus;
  const canPay = ps === "unpaid" || ps === "pending";
  return (
    <li className="overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-[#fafafa]">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold text-[#18181b]">{o.code}</span>
            <Badge tone={paymentTone[ps]}>{paymentLabels[ps]}</Badge>
            <Badge tone={prodTone[o.status]}>{statusLabels[o.status]}</Badge>
            <Badge tone={o.file_count ? "green" : "gray"}>{o.file_count ? "Đã gửi file" : "Chưa gửi file"}</Badge>
          </p>
          <p className="mt-1 truncate text-[13px] text-[#71717a]">
            {formatDate(o.created_at)} · {o.items.map((i) => `${i.package_name} × ${i.quantity}`).join(", ") || "—"}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-semibold text-[#18181b]">{formatVND(o.total)}</span>
          <ChevronDown size={16} className={cx("ml-auto mt-1 text-[#a1a1aa] transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="border-t border-[#efeff1] px-4 py-3">
          <ul className="space-y-2 text-[14px]">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="min-w-0 text-[#3f3f46]">
                  {i.package_name} × {i.quantity}
                  {i.addons.length > 0 && <span className="block text-[12px] text-[#71717a]">+ {i.addons.map((a) => `${a.name} × ${a.qty}`).join(", ")}</span>}
                </span>
                <span className="shrink-0">{formatVND(i.line_total)}</span>
              </li>
            ))}
          </ul>
          {o.amount_due != null && o.amount_due < o.total && <p className="mt-2 text-[12px] text-[#71717a]">Cần chuyển trước (đặt cọc): {formatVND(o.amount_due)}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {canPay && <Button href={`/thanh-toan/${encodeURIComponent(o.code)}`} size="sm" icon={<CreditCard size={16} />}>Thanh toán</Button>}
            <Button href={uploadHref(o.code)} size="sm" variant="secondary" icon={<Upload size={16} />}>Gửi file in</Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function MyOrders() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [err, setErr] = useState("");
  const [auth, setAuth] = useState(false);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [lookErr, setLookErr] = useState("");
  const [looking, setLooking] = useState(false);

  const load = useCallback(async (u: User | null) => {
    if (!hasSupabase) { setOrders([]); return; }
    const sb = createClient();
    if (u) {
      await sb.rpc("claim_my_orders").then(() => undefined, () => undefined);
      const { data, error } = await sb.rpc("my_orders");
      if (error) setErr(error.message.includes("my_orders") ? "Tiệm chưa mở tính năng này." : error.message);
      setOrders((data as OrderSummary[]) ?? []);
    } else {
      const codes = savedOrderCodes();
      if (!codes.length) { setOrders([]); return; }
      const { data, error } = await sb.rpc("orders_by_codes", { p_codes: codes });
      if (error) setErr(error.message.includes("orders_by_codes") ? "Tiệm chưa mở tính năng này." : error.message);
      setOrders((data as OrderSummary[]) ?? []);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabase) { setUser(null); setOrders([]); return; }
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => { setUser(data.user); load(data.user); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => { setUser(s?.user ?? null); load(s?.user ?? null); });
    return () => data.subscription.unsubscribe();
  }, [load]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLookErr("");
    const p = normalizePhone(phone);
    if (!code.trim()) return setLookErr("Nhập mã đơn.");
    if (!p) return setLookErr(PHONE_ERROR);
    setLooking(true);
    const { data, error } = await createClient().rpc("lookup_order", { p_code: code.trim(), p_phone: p });
    setLooking(false);
    if (error) return setLookErr(error.message);
    if (!data) return setLookErr("Không tìm thấy đơn khớp mã đơn và số điện thoại.");
    const o = data as OrderSummary;
    saveOrderCode(o.code);
    setOrders((cur) => [o, ...(cur ?? []).filter((x) => x.code !== o.code)]);
    setCode(""); setPhone("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-12">
      {err && <p className="mb-4 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{err}</p>}

      {user === null && (
        <div className="mb-5 space-y-3">
          <form onSubmit={lookup} className="rounded-[12px] border border-[#e5e5e7] bg-white p-4">
            <p className="mb-3 text-[15px] font-semibold text-[#18181b]">Tra cứu đơn</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Mã đơn"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TL-261116-AB12" /></Field>
              <Field label="Số điện thoại đã đặt"><Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <button className={btnClass("primary")} disabled={looking}><Search size={16} /> {looking ? "Đang tìm..." : "Tra cứu"}</button>
            </div>
            {lookErr && <p className="mt-2 text-[12px] text-[#dc2626]">{lookErr}</p>}
          </form>
          <p className="text-[13px] text-[#71717a]">
            <button type="button" onClick={() => setAuth(true)} className="font-medium text-[#ff5fa2] hover:text-[#e0468a]">Đăng nhập</button> bằng số điện thoại đã đặt hàng để xem tất cả đơn.
          </p>
        </div>
      )}

      {orders === null || user === undefined ? (
        <p className="py-10 text-center text-[#71717a]">Đang tải...</p>
      ) : orders.length ? (
        <>
          {user === null && <p className="mb-2 text-[13px] text-[#71717a]">Đơn đã đặt trên trình duyệt này</p>}
          <ul className="space-y-3">{orders.map((o) => <OrderCard key={o.id} o={o} />)}</ul>
        </>
      ) : (
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-10 text-center">
          <p className="text-[#71717a]">Chưa có đơn nào.</p>
          <Button href="/dat-don" className="mt-4">Đặt đơn ngay</Button>
        </div>
      )}
      {auth && <AuthDialog onClose={() => setAuth(false)} />}
    </div>
  );
}
