"use client";
/* Tổng quan → Đơn hàng Shopee: mã đơn Shopee hợp lệ để khách vào trang Thiết kế (khi bật "Yêu cầu số điện thoại / mã đơn hàng").
   Dán nhiều mã (mỗi dòng 1 mã) → Thêm. Mỗi mã: dùng được 7 ngày kể từ lần khách nhập đầu tiên (database tự dọn mã hết hạn mỗi ngày).
   ⋯: Tạm ngưng / Bật lại · Xoá. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RowMenu } from "@/components/ui/RowMenu";
import { Badge, Button, EmptyState, Input, Table, Textarea, confirmDialog, toast } from "@/components/admin/ui";

type Row = { code: string; active: boolean; activated_at: string | null; expires_at: string | null; user_id: string | null; created_at: string };
const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();
const dt = (s: string) => new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function ShopeeCodesAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [text, setText] = useState(""), [q, setQ] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await createClient().from("shopee_codes").select("*").order("created_at", { ascending: false }).limit(2000);
    if (error) { setErr(/shopee_codes|schema cache|does not exist/i.test(error.message) ? "Chưa có bảng mã đơn Shopee — cần chạy supabase/migration_design_access.sql." : error.message); setRows([]); return; }
    setRows((data ?? []) as Row[]); setErr("");
  }, []);
  useEffect(() => { load(); }, [load]);
  async function add() {
    const codes = [...new Set(text.split(/[\n,;]+/).map(norm).filter((c) => c.length >= 4))];
    if (!codes.length) return toast("Dán ít nhất 1 mã đơn hàng (mỗi dòng 1 mã)", "err");
    setBusy(true);
    const { error } = await createClient().from("shopee_codes").upsert(codes.map((code) => ({ code })), { onConflict: "code", ignoreDuplicates: true });
    setBusy(false);
    if (error) return toast(error.message, "err");
    setText(""); toast(`Đã thêm ${codes.length} mã`); load();
  }
  async function patch(r: Row, v: Partial<Row>, ok: string) {
    const { error } = await createClient().from("shopee_codes").update(v).eq("code", r.code);
    if (error) return toast(error.message, "err");
    toast(ok); load();
  }
  async function remove(r: Row) {
    if (!(await confirmDialog(`Xoá mã ${r.code}? Khách dùng mã này sẽ không vào trang Thiết kế được nữa.`, { danger: true, ok: "Xoá" }))) return;
    const { error } = await createClient().from("shopee_codes").delete().eq("code", r.code);
    if (error) return toast(error.message, "err");
    toast("Đã xoá"); load();
  }
  const list = useMemo(() => (rows ?? []).filter((r) => !q.trim() || r.code.includes(norm(q))), [rows, q]);
  const state = (r: Row) => !r.active ? <Badge tone="amber">Tạm ngưng</Badge>
    : r.expires_at && Date.parse(r.expires_at) < Date.now() ? <Badge>Hết hạn</Badge>
    : r.expires_at ? <Badge tone="green">Đang dùng · đến {dt(r.expires_at)}</Badge> : <Badge tone="pink">Chưa dùng</Badge>;
  if (!rows) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-4">
      {err && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{err}</p>}
      <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-4">
        <p className="mb-1 text-[14px] font-semibold">Thêm mã đơn hàng Shopee</p>
        <p className="mb-2 text-[12px] text-[#71717a]">Dán 1 hoặc nhiều mã (mỗi dòng 1 mã). Khách nhập mã ở trang Thiết kế → dùng được 7 ngày kể từ lần nhập đầu; nếu khách đăng nhập, mã được gán vào tài khoản.</p>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={"2411200ABC123\n2411200DEF456"} className="font-mono" />
        <Button size="sm" className="mt-2" icon={<Plus size={14} />} loading={busy} onClick={add}>Thêm mã</Button>
      </div>
      <div className="relative max-w-[320px]">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã đơn hàng" className="pl-9" />
      </div>
      <Table keep={[0, 1]} head={["Mã đơn hàng", "Trạng thái", "Lần đầu nhập", "Tài khoản", "Ngày thêm", ""]} empty={!list.length && <EmptyState>{rows.length ? "Không có mã phù hợp." : "Chưa có mã đơn Shopee nào."}</EmptyState>}>
        {list.map((r) => (
          <tr key={r.code}>
            <td className="font-mono text-[13px] font-medium">{r.code}</td>
            <td>{state(r)}</td>
            <td className="text-[13px] text-[#71717a]">{r.activated_at ? dt(r.activated_at) : "—"}</td>
            <td className="text-[13px] text-[#71717a]">{r.user_id ? "Đã gán" : "—"}</td>
            <td className="text-[13px] text-[#71717a]">{dt(r.created_at)}</td>
            <td className="text-right">
              <RowMenu items={[
                r.active ? { label: "Tạm ngưng", icon: <Pause size={14} />, onClick: () => patch(r, { active: false }, "Đã tạm ngưng") } : { label: "Bật lại", icon: <Play size={14} />, onClick: () => patch(r, { active: true }, "Đã bật lại") },
                { label: "Xoá", icon: <Trash2 size={14} />, danger: true, onClick: () => remove(r) },
              ]} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
