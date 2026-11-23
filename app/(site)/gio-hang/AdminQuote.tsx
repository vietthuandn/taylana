"use client";
/* Giỏ hàng — CHỈ chủ tiệm (admin đăng nhập): khối "Chuyển khoản" ngay dưới tổng tiền để báo giá qua Zalo:
   mã QR VietQR đúng số tiền + nội dung, thông tin tài khoản, nút chép báo giá (danh sách món + tổng + tài khoản). */
import { useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
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
  const [content, setContent] = useState(() => `${bank?.prefix || "TAYLANA"} BAOGIA`);
  const [copied, setCopied] = useState("");
  if (!bank?.account_no?.trim()) return (
    <section className="rounded-[12px] border border-dashed border-[#e5e5e7] bg-white p-4 text-[13px] text-[#71717a]">
      Chỉ chủ tiệm thấy · Chưa có tài khoản nhận tiền — cài ở Admin → Thanh toán.
    </section>
  );
  const qr = buildQrUrl({ bin: bank.bank_bin, accountNo: bank.account_no, accountName: bank.account_name, amount: total, content });
  const info = `${bank.bank_name} · ${bank.account_no} · ${bank.account_name}`;
  const quote = [...lines, `Tổng cộng: ${formatVND(total)}`, "", `Chuyển khoản: ${info}`, `Nội dung: ${content}`].join("\n");
  const copy = async (t: string, k: string) => { try { await navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(""), 1500); } catch { /* trình duyệt chặn */ } };
  const btn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#e5e5e7] bg-white px-3 text-[13px] font-medium text-[#18181b] hover:bg-[#f4f4f5]";
  return (
    <section className="rounded-[12px] border border-[#e5e5e7] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">Chuyển khoản · báo giá</p>
        <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[11px] text-[#71717a]">Chỉ chủ tiệm thấy</span>
      </div>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Mã QR chuyển khoản" width={140} height={140} className="h-[140px] w-[140px] shrink-0 rounded-[8px] border border-[#efeff1] object-contain" />
        <div className="min-w-0 flex-1 space-y-1 text-[13px]">
          <p className="text-[#71717a]">{bank.bank_name}</p>
          <p className="font-semibold tabular-nums">{bank.account_no}</p>
          <p className="truncate">{bank.account_name}</p>
          <p className="pt-1 text-[18px] font-bold tabular-nums text-[var(--c-primary)]">{formatVND(total)}</p>
          <label className="block pt-1 text-[12px] text-[#71717a]">Nội dung chuyển khoản
            <input value={content} onChange={(e) => setContent(toAccountName(e.target.value).slice(0, 50))}
              className="mt-0.5 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2 text-[13px] text-[#18181b] outline-none focus:border-[var(--c-primary)]" /></label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => copy(quote, "quote")} className={btn}><Copy size={14} /> {copied === "quote" ? "Đã chép báo giá" : "Chép báo giá"}</button>
        <button type="button" onClick={() => copy(bank.account_no, "acc")} className={btn}><Copy size={14} /> {copied === "acc" ? "Đã chép" : "Chép số TK"}</button>
        <a href={qr} target="_blank" rel="noreferrer" download className={btn}><Download size={14} /> Mở ảnh QR</a>
      </div>
    </section>
  );
}
