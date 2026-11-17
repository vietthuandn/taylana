"use client";

/* Thanh toán của đơn (Mức 1: admin tự xác nhận). Xác nhận → tạo 1 dòng payments (manual) + ghi lịch sử. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatVND } from "@/lib/format";
import { paymentLabels, paymentTone } from "@/lib/payment/settings";
import type { Order } from "@/lib/types";
import { Badge, Button, Card, Field, Input, Message, Select, Textarea, confirmDialog } from "@/components/admin/ui";

export type PaymentRow = { id: string; amount: number; source: string; bank_txn_id: string | null; paid_at: string; note: string; created_by: string | null };

const actionLabels: Record<string, string> = {
  claimed: "Khách bấm “Tôi đã chuyển khoản”", deposited: "Xác nhận đã cọc", paid: "Xác nhận đã thanh toán",
  cancelled: "Huỷ thanh toán", reopened: "Mở lại thanh toán",
};

export function PaymentCard({ order, payments }: { order: Order; payments: PaymentRow[] }) {
  const router = useRouter();
  const st = order.payment_status ?? "unpaid";
  const due = order.amount_due ?? order.total;
  const paid = order.paid_amount ?? 0;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"deposited" | "paid">(due < order.total && paid === 0 ? "deposited" : "paid");
  const [amount, setAmount] = useState(Math.max(0, (paid ? order.total - paid : due)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg({ type: "err", text: error.message });
    setMsg({ type: "ok", text: ok });
    setOpen(false);
    router.refresh();
  }
  const sb = () => createClient();

  if (!order.payment_code) {
    return (
      <Card title="Thanh toán" description="Chưa bật thanh toán cho đơn này.">
        <p className="text-[13px] text-[#71717a]">Cần chạy file supabase/migration_payment.sql trên Supabase.</p>
      </Card>
    );
  }

  return (
    <Card title="Thanh toán" actions={<Badge tone={paymentTone[st]}>{paymentLabels[st]}</Badge>}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px]">
        <div><dt className="text-[12px] text-[#71717a]">Mã thanh toán</dt><dd className="font-semibold">{order.payment_code}</dd></div>
        <div><dt className="text-[12px] text-[#71717a]">Cần thu</dt><dd className="font-semibold">{formatVND(due)}{due < order.total && <span className="ml-1 text-[12px] font-normal text-[#71717a]">(cọc)</span>}</dd></div>
        <div><dt className="text-[12px] text-[#71717a]">Đã nhận</dt><dd>{formatVND(paid)}</dd></div>
        <div><dt className="text-[12px] text-[#71717a]">Hạn thanh toán</dt><dd>{order.payment_deadline ? formatDate(order.payment_deadline) : "—"}</dd></div>
        <div className="col-span-2"><dt className="text-[12px] text-[#71717a]">Khách bấm “Tôi đã chuyển khoản”</dt>
          <dd className={order.payment_claimed_at ? "font-medium text-[#ff5fa2]" : ""}>{order.payment_claimed_at ? formatDate(order.payment_claimed_at) : "Chưa"}</dd></div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#efeff1] pt-4">
        {st !== "paid" && st !== "cancelled" && (
          <Button icon={<CheckCircle2 size={16} />} onClick={() => setOpen(!open)} disabled={busy}>Xác nhận đã nhận tiền</Button>
        )}
        {st !== "cancelled" && st !== "paid" && (
          <Button variant="danger" icon={<XCircle size={16} />} disabled={busy} onClick={async () => {
            if (!await confirmDialog(`Huỷ thanh toán của đơn ${order.code}?`, { ok: "Huỷ thanh toán" })) return;
            run(() => sb().rpc("admin_cancel_payment", { p_order_id: order.id, p_note: "" }), "Đã huỷ thanh toán");
          }}>Huỷ thanh toán</Button>
        )}
        {(st === "expired" || st === "cancelled") && (
          <Button variant="secondary" icon={<RotateCcw size={16} />} disabled={busy}
            onClick={() => run(() => sb().rpc("admin_reopen_payment", { p_order_id: order.id }), "Đã mở lại thanh toán")}>Mở lại thanh toán</Button>
        )}
      </div>

      {open && (
        <div className="mt-4 grid gap-3 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] p-4 sm:grid-cols-2">
          <Field label="Trạng thái">
            <Select value={kind} onChange={(e) => setKind(e.target.value as "deposited" | "paid")}>
              <option value="deposited">Đã cọc</option>
              <option value="paid">Đã thanh toán</option>
            </Select>
          </Field>
          <Field label="Số tiền thực nhận (đồng)">
            <Input type="number" min={0} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Ghi chú" className="sm:col-span-2" hint="Ví dụ: mã giao dịch, chuyển từ TK nào...">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button loading={busy} onClick={() => run(() => sb().rpc("admin_confirm_payment", {
              p_order_id: order.id, p_status: kind, p_amount: Math.max(0, Math.round(amount)), p_note: note,
            }), "Đã xác nhận thanh toán")}>Xác nhận</Button>
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium">Giao dịch đã nhận</p>
          <ul className="divide-y divide-[#efeff1] rounded-[10px] border border-[#e5e5e7] text-[13px]">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium">{formatVND(p.amount)} <span className="font-normal text-[#71717a]">· {p.source === "manual" ? "Thủ công" : p.source}{p.bank_txn_id ? ` · ${p.bank_txn_id}` : ""}</span></span>
                <span className="text-[12px] text-[#71717a]">{p.created_by ?? ""} · {formatDate(p.paid_at)}</span>
                {p.note && <span className="w-full text-[12px] text-[#52525b]">{p.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(order.payment_log ?? []).length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium">Lịch sử</p>
          <ol className="space-y-1.5 text-[12px]">
            {[...(order.payment_log ?? [])].reverse().map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4d4d8]" />
                <span className="text-[#3f3f46]">
                  <b className="font-medium">{actionLabels[l.action] ?? l.action}</b>
                  {l.amount ? ` · ${formatVND(l.amount)}` : ""} — {l.by} · {formatDate(l.at)}
                  {l.note ? <span className="block text-[#71717a]">{l.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <Message msg={msg} />
    </Card>
  );
}
