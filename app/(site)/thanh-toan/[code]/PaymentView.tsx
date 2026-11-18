"use client";

/* Trang thanh toán QR của 1 đơn. Tự kiểm tra trạng thái mỗi 10 giây —
   admin xác nhận (hoặc sau này webhook SePay) thì tự chuyển sang "Thanh toán thành công". */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Brush, Check, Clock, Copy, Download, ListOrdered, Upload } from "lucide-react";
import { saveOrderCode } from "@/lib/cart";
import { uploadHref } from "@/lib/uploadTools";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { formatVND } from "@/lib/format";
import { bankByBin } from "@/lib/payment/banks";
import { buildQrUrl } from "@/lib/payment/qr";
import type { PaymentSettings, PaymentStatus } from "@/lib/payment/settings";
import { Button } from "@/components/ui/kit";
import { btnClass, cx } from "@/components/ui/styles";

type Info = {
  order_code: string; payment_code: string; total: number; amount_due: number; paid_amount: number;
  payment_status: PaymentStatus; payment_deadline: string | null; payment_claimed_at: string | null;
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
const left = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h ? `${h} giờ ` : ""}${String(m).padStart(2, "0")} phút ${String(sec).padStart(2, "0")} giây`;
};

function CopyRow({ label, value, copy, strong, hint }: { label: string; value: React.ReactNode; copy?: string; strong?: boolean; hint?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-[#71717a]">{label}</p>
        <p className={cx("break-all text-[15px] text-[#18181b]", strong ? "font-bold" : "font-medium")}>{value}</p>
        {hint && <p className="mt-0.5 text-[12px] font-medium text-[#ff5fa2]">{hint}</p>}
      </div>
      {copy && (
        <button type="button" className={btnClass("secondary", "sm")}
          onClick={() => { navigator.clipboard?.writeText(copy); setDone(true); setTimeout(() => setDone(false), 1500); }}>
          {done ? <Check size={16} className="text-[#16a34a]" /> : <Copy size={16} />} {done ? "Đã chép" : "Sao chép"}
        </button>
      )}
    </div>
  );
}

export function PaymentView({ code, settings }: { code: string; settings: PaymentSettings }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [claiming, setClaiming] = useState(false);
  const now = useNow();

  const load = useCallback(async () => {
    if (!hasSupabase) { setInfo(null); return; }
    const { data, error } = await createClient().rpc("get_order_payment", { p_code: code });
    if (error) { setErr(error.message); return; }
    const row = (data?.[0] as Info) ?? null;
    if (row) saveOrderCode(row.order_code);
    setInfo(row);
  }, [code]);
  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // tự kiểm tra trạng thái mỗi 10 giây
    return () => clearInterval(t);
  }, [load]);

  async function claim() {
    setClaiming(true);
    const { error } = await createClient().rpc("claim_order_payment", { p_code: code });
    setClaiming(false);
    if (error) return setErr(error.message);
    load();
  }

  const nextSteps = (
    <div className="mt-6 border-t border-[#efeff1] pt-5">
      <p className="mb-3 text-[13px] font-medium text-[#18181b]">Bước tiếp theo</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button href={uploadHref(code)} variant="secondary" icon={<Upload size={16} />}>Gửi file in</Button>
        <Button href="/thiet-ke/cd" variant="secondary" icon={<Brush size={16} />}>Tự thiết kế CD</Button>
        <Button href="/don-hang-cua-toi" variant="ghost" icon={<ListOrdered size={16} />} className="sm:col-span-2">Xem đơn hàng của tôi</Button>
      </div>
    </div>
  );
  const shell = (children: React.ReactNode, wide = false) => (
    <section className={cx("mx-auto w-full px-4 py-8 sm:py-12", wide ? "max-w-4xl" : "max-w-lg")}>
      <div className="rounded-[16px] border border-[#e5e5e7] bg-white p-5 sm:p-8">{children}</div>
    </section>
  );
  const title = (t: string) => <h1 className="font-sans text-[22px] font-bold normal-case tracking-[-0.02em] text-[#18181b] sm:text-[28px]">{t}</h1>;

  if (info === undefined) return shell(<p className="py-8 text-center text-[#71717a]">{err || "Đang tải..."}</p>);
  if (!info) return shell(<>{title("Không tìm thấy đơn")}<p className="mt-2 text-[15px] text-[#71717a]">Mã đơn “{code}” không đúng. Bạn kiểm tra lại link hoặc <Link href="/lien-he" className="font-medium text-[#ff5fa2] hover:text-[#e0468a]">liên hệ tiệm</Link> nhé.</p></>);

  const st = info.payment_status;
  const deadline = info.payment_deadline ? new Date(info.payment_deadline).getTime() : null;
  const expired = st === "expired" || (st === "unpaid" && deadline !== null && deadline < now);
  const deposit = info.amount_due < info.total;
  const bank = bankByBin(settings.bank_bin);

  if (st === "paid" || st === "deposited") {
    return shell(
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ecfdf3] text-[#16a34a]"><Check size={24} /></span>
        <div className="mt-4">{title("Thanh toán thành công 🎉")}</div>
        <p className="mt-2 text-[15px] text-[#71717a]">
          {st === "deposited" ? `Tiệm đã nhận tiền cọc ${formatVND(info.paid_amount)} cho đơn ${info.order_code}.` : `Tiệm đã nhận ${formatVND(info.paid_amount || info.amount_due)} cho đơn ${info.order_code}.`}
        </p>
        <p className="mt-1 text-[13px] text-[#71717a]">Cảm ơn bạn! Tiệm sẽ bắt đầu làm đơn ngay.</p>
        {nextSteps}
      </div>,
    );
  }
  if (expired || st === "cancelled") {
    return shell(
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#fffbeb] text-[#b45309]"><Clock size={24} /></span>
        <div className="mt-4">{title(st === "cancelled" ? "Thanh toán đã huỷ" : "Đơn đã hết hạn thanh toán")}</div>
        <p className="mt-2 text-[15px] text-[#71717a]">
          {st === "cancelled" ? "Thanh toán của đơn này đã bị huỷ" : "Đơn đã hết hạn thanh toán"}, vui lòng <Link href="/lien-he" className="font-medium text-[#ff5fa2] hover:text-[#e0468a]">liên hệ tiệm</Link>.
        </p>
        <p className="mt-1 text-[13px] text-[#a1a1aa]">Mã đơn: {info.order_code}</p>
      </div>,
    );
  }

  if (!settings.enabled || !settings.account_no) {
    return shell(<>{title("Chưa mở thanh toán online")}<p className="mt-2 text-[15px] text-[#71717a]">Tiệm sẽ liên hệ qua Zalo/SĐT để hướng dẫn thanh toán đơn {info.order_code}.</p>{nextSteps}</>);
  }

  const qr = buildQrUrl({ bin: settings.bank_bin, accountNo: settings.account_no, accountName: settings.account_name, amount: info.amount_due, content: info.payment_code });
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  async function downloadQr() {
    try {
      const blob = await (await fetch(qr)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `QR-${info!.payment_code}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      window.open(qr, "_blank"); // trình duyệt chặn tải → mở ảnh để khách nhấn giữ và lưu
    }
  }

  return shell(
    <>
      <div className="mb-5">
        {title("Thanh toán đơn hàng")}
        <p className="mt-1 text-[15px] text-[#71717a]">Mã đơn {info.order_code} · Quét QR bằng app ngân hàng để chuyển khoản.</p>
      </div>

      {st === "pending" ? (
        <div className="mb-5 rounded-[10px] border border-[#ffd1e5] bg-[#fff0f6] px-4 py-3 text-[14px] text-[#18181b]">
          <p className="font-semibold">Tiệm đã ghi nhận bạn đã chuyển khoản — đang chờ xác nhận.</p>
          {settings.note && <p className="mt-0.5 text-[#52525b]">{settings.note}</p>}
          <p className="mt-0.5 text-[12px] text-[#71717a]">Trang này tự cập nhật khi tiệm xác nhận.</p>
        </div>
      ) : deadline !== null && (
        <p className="mb-5 flex items-center gap-2 rounded-[10px] bg-[#fafafa] px-4 py-2.5 text-[14px] text-[#3f3f46]">
          <Clock size={16} className="shrink-0 text-[#ff5fa2]" /> Còn <b className="tabular-nums">{left(deadline - now)}</b> để thanh toán
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR chuyển khoản ${info.payment_code}`} className="mx-auto w-full max-w-[280px] rounded-[12px] border border-[#e5e5e7]" />
          <button type="button" onClick={downloadQr} className={cx(btnClass("secondary"), "mt-3 w-full max-w-[280px]")}><Download size={16} /> Tải ảnh QR</button>
          <p className="mt-2 text-[12px] text-[#71717a]">Lưu ảnh rồi mở bằng app ngân hàng trên cùng điện thoại.</p>
        </div>

        <div className="min-w-0">
          {deposit && (
            <p className="mb-3 rounded-[10px] bg-[#fafafa] px-4 py-2.5 text-[14px] text-[#3f3f46]">
              Đặt cọc {Math.round((info.amount_due / Math.max(1, info.total)) * 100)}%: <b>{formatVND(info.amount_due)}</b> / Tổng đơn: {formatVND(info.total)}
            </p>
          )}
          <div className="divide-y divide-[#efeff1] overflow-hidden rounded-[12px] border border-[#e5e5e7]">
            <CopyRow label="Ngân hàng" value={bank ? `${bank.short} — ${bank.name}` : settings.bank_name} />
            <CopyRow label="Số tài khoản" value={settings.account_no} copy={settings.account_no} />
            <CopyRow label="Chủ tài khoản" value={settings.account_name} copy={settings.account_name} />
            <CopyRow label="Số tiền" value={formatVND(info.amount_due)} copy={String(info.amount_due)} strong />
            <CopyRow label="Nội dung chuyển khoản" value={info.payment_code} copy={info.payment_code} strong hint="Vui lòng ghi ĐÚNG nội dung này" />
          </div>

          {err && <p className="mt-3 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{err}</p>}
          {st === "unpaid" && (
            <Button className="mt-4 h-12 w-full text-[16px] font-semibold" loading={claiming} onClick={claim}>Tôi đã chuyển khoản</Button>
          )}
          {settings.note && st === "unpaid" && <p className="mt-2 text-center text-[12px] text-[#71717a]">{settings.note}</p>}
          {pageUrl && (
            <p className="mt-4 text-[12px] text-[#71717a]">Lưu lại link trang này để mở lại: <span className="break-all text-[#3f3f46]">{pageUrl}</span></p>
          )}
        </div>
      </div>
      {nextSteps}
    </>,
    true,
  );
}
