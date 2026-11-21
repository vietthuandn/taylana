"use client";
/* Quản lý tài khoản → Khách hàng: tên hiển thị, SĐT, lần cuối sử dụng, dung lượng ảnh đã dùng (bảng user_files), số đơn.
   Tìm theo tên / SĐT, sắp xếp theo lần cuối sử dụng. ⋮: Dọn file · Xoá tài khoản (gõ SĐT để xác nhận, đơn cũ giữ lại). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eraser, RefreshCw, Search, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import { RowMenu } from "@/components/ui/RowMenu";
import { Button, EmptyState, Input, Table, toast } from "@/components/admin/ui";

type Row = { id: string; name: string; phone: string; last_sign_in_at: string | null; created_at: string; bytes: number; orders: number };
async function api(method: string, body?: unknown) {
  const r = await fetch("/api/admin/customers", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Có lỗi, thử lại nhé");
  return j;
}
const when = (s: string | null) => (s ? new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Chưa đăng nhập");

export function CustomersAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState(""), [noTable, setNoTable] = useState(false);
  const [q, setQ] = useState(""), [desc, setDesc] = useState(true), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const j = await api("GET"); setRows(j.rows); setNoTable(!!j.noTable); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải danh sách"); setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase(), p = k.replace(/\D/g, ""), np = normalizePhone(k);
    const f = (rows ?? []).filter((r) => !k || r.name.toLowerCase().includes(k) || (p.length >= 3 && r.phone.includes(p)) || (!!np && r.phone === np));
    const t = (r: Row) => (r.last_sign_in_at ? Date.parse(r.last_sign_in_at) : 0);
    return f.sort((a, b) => (desc ? t(b) - t(a) : t(a) - t(b)));
  }, [rows, q, desc]);

  async function act(body: unknown, ok: string) {
    try { await api("POST", body); toast(ok); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Có lỗi", "err"); }
  }
  async function clean(r: Row) {
    if (await confirmDialog({ title: "Dọn file của khách?", message: `Xoá mọi thiết kế đã lưu và ảnh của ${r.name || r.phone} trên R2. Không thể hoàn tác.`, confirmText: "Dọn file", danger: true }))
      act({ action: "clean", user_id: r.id }, "Đã dọn file");
  }
  async function remove(r: Row) {
    const v = await promptDialog({ title: "Xoá tài khoản khách?", message: <>Xoá thiết kế, file và tài khoản đăng nhập của <b>{r.name || r.phone}</b>. Đơn hàng cũ vẫn giữ lại. Gõ số điện thoại <b>{r.phone}</b> để xác nhận.</>, label: "Số điện thoại", placeholder: r.phone, confirmText: "Xoá tài khoản" });
    if (v == null) return;
    if (normalizePhone(v) !== normalizePhone(r.phone)) return toast("Số điện thoại không khớp — chưa xoá", "err");
    act({ action: "delete", user_id: r.id, phone: v }, "Đã xoá tài khoản");
  }
  async function recount() {
    setBusy(true);
    try { const j = await api("POST", { action: "recount" }); toast(`Đã tính lại (${j.files} file)`); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Có lỗi", "err"); }
    setBusy(false);
  }

  if (!rows) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-3">
      {err && <p className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{err}</p>}
      {noTable && <p className="rounded-[8px] bg-[#fffbeb] px-3 py-2 text-[13px] text-[#b45309]">Chưa có bảng dung lượng — cần chạy supabase/migration_customers.sql.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc SĐT" className="pl-9" />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setDesc(!desc)}>Lần cuối sử dụng: {desc ? "mới nhất" : "cũ nhất"}</Button>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} loading={busy} onClick={recount} title="Quét R2 1 lần để tính dung lượng các file tải lên trước đây">Tính lại dung lượng</Button>
        <span className="ml-auto text-[13px] text-[#71717a]">{list.length} khách</span>
      </div>
      <Table keep={[0, 1]} head={["Tên hiển thị", "SĐT", "Lần cuối sử dụng", "Dung lượng ảnh", "Số đơn", ""]}
        empty={!list.length && <EmptyState>{rows.length ? "Không có khách phù hợp." : "Chưa có tài khoản khách."}</EmptyState>}>
        {list.map((r) => (
          <tr key={r.id}>
            <td className="font-medium text-[#18181b]">{r.name || "—"}</td>
            <td className="tabular-nums">{r.phone}</td>
            <td className="text-[13px] text-[#71717a]">{when(r.last_sign_in_at)}</td>
            <td className="tabular-nums text-[13px]">{r.bytes ? formatBytes(r.bytes) : "—"}</td>
            <td className="tabular-nums">{r.orders}</td>
            <td className="text-right">
              <RowMenu items={[
                { label: "Dọn file", icon: <Eraser size={14} />, onClick: () => clean(r) },
                { label: "Xoá tài khoản", icon: <Trash2 size={14} />, danger: true, onClick: () => remove(r) },
              ]} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
