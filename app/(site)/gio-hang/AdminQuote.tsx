"use client";
/* Giỏ hàng — CHỈ chủ tiệm (admin đăng nhập): khối "Chuyển khoản" ngay dưới tổng tiền để báo giá qua Zalo:
   mã QR VietQR đúng số tiền + nội dung, thông tin tài khoản, nút chép báo giá (danh sách món + tổng + tài khoản). */
import { useEffect, useState } from "react";
import { Check, Copy, ImageDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildQrUrl } from "@/lib/payment/qr";
import { toAccountName, type PaymentSettings } from "@/lib/payment/settings";
import { formatVND } from "@/lib/format";

export function useIsAdmin() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => { if (data.user) sb.rpc("is_admin").then(({ data: a }) => setOn(a === true)); });
  }, []);
  return on;
}

export function AdminQuote({ bank, total, lines }: { bank: PaymentSettings | null; total: number; lines: string[] }) {
  const [content, setContent] = useState("TAYLANA");
  const [copied, setCopied] = useState("");
  if (!bank?.account_no?.trim()) return (
    <section className="rounded-[12px] border border-dashed border-[#e5e5e7] bg-white p-4 text-[13px] text-[#71717a]">
      Chưa có tài khoản nhận tiền — cài ở Admin → Thanh toán.
    </section>
  );
  const qr = buildQrUrl({ bin: bank.bank_bin, accountNo: bank.account_no, accountName: bank.account_name, amount: total, content });
  const info = `${bank.bank_name} · ${bank.account_no} · ${bank.account_name}`;
  const quote = [...lines, `Tổng cộng: ${formatVND(total)}`, "", `Chuyển khoản: ${info}`, `Nội dung: ${content}`].join("\n");
  const copy = async (t: string, k: string) => { try { await navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(""), 1500); } catch { /* trình duyệt chặn */ } };
  const ib = "grid h-9 w-9 place-items-center rounded-[8px] border border-[#e5e5e7] bg-white text-[#3f3f46] hover:bg-[#f4f4f5]";
  return (
    <section className="flex gap-4 rounded-[12px] border border-[#e5e5e7] bg-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Mã QR chuyển khoản" width={220} height={220} className="h-[200px] w-[200px] shrink-0 rounded-[8px] border border-[#efeff1] object-contain sm:h-[220px] sm:w-[220px]" />
      <div className="min-w-0 flex-1 space-y-1 text-[13px]">
        <p className="text-[#71717a]">{bank.bank_name}</p>
        <p className="font-semibold tabular-nums">{bank.account_no}</p>
        <p className="truncate">{bank.account_name}</p>
        <p className="pt-1 text-[18px] font-bold tabular-nums text-[var(--c-primary)]">{formatVND(total)}</p>
        <label className="block pt-1 text-[12px] text-[#71717a]">Nội dung chuyển khoản
          <input value={content} onChange={(e) => setContent(toAccountName(e.target.value).slice(0, 50))}
            className="mt-0.5 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2 text-[13px] text-[#18181b] outline-none focus:border-[var(--c-primary)]" /></label>
        <div className="flex gap-2 pt-1.5">
          <button type="button" onClick={() => copy(quote, "quote")} title={copied === "quote" ? "Đã chép" : "Chép báo giá"} aria-label="Chép báo giá" className={ib}>{copied === "quote" ? <Check size={16} className="text-[#16a34a]" /> : <Copy size={16} />}</button>
          <a href={qr} target="_blank" rel="noreferrer" title="Mở ảnh QR" aria-label="Mở ảnh QR" className={ib}><ImageDown size={16} /></a>
        </div>
      </div>
    </section>
  );
}
