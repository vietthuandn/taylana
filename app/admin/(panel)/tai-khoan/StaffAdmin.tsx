"use client";

/* Quản lý tài khoản nội bộ: bảng (tên hiển thị, email, vai trò, trạng thái, lần đăng nhập gần nhất) · "Tạo tài khoản"
   (mật khẩu tạo ngẫu nhiên / sao chép) · mỗi dòng: Đổi vai trò, Đặt lại mật khẩu, Tạm khoá / Mở khoá, Xoá.
   Mọi thao tác qua /api/admin/staff (server kiểm tra quyền + Supabase Auth Admin API). */
import { useCallback, useEffect, useState } from "react";
import { RowMenu } from "@/components/ui/RowMenu";
import { Copy, KeyRound, Lock, Plus, Shuffle, Trash2, Unlock, UserCog } from "lucide-react";
import { ROLE_LABEL, type StaffRole } from "@/lib/roles";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import { Badge, Button, Card, EmptyState, Field, Input, Select, toast } from "@/components/admin/ui";

type Row = { user_id: string; email: string; role: StaffRole; display_name: string | null; created_at: string; disabled: boolean; last_sign_in_at: string | null };
const randomPassword = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%", b = new Uint32Array(14); crypto.getRandomValues(b); return Array.from(b, (x) => A[x % A.length]).join(""); };
async function api(method: string, body?: unknown) {
  const r = await fetch("/api/admin/staff", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Có lỗi, thử lại nhé");
  return j;
}

export function StaffAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState("");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<{ display_name: string; email: string; password: string; role: StaffRole } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const j = await api("GET"); setRows(j.rows); setMe(j.me); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải danh sách"); }
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast(ok); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Có lỗi", "err"); }
  }
  async function create() {
    if (!form) return;
    setBusy(true);
    try { await api("POST", form); toast("Đã tạo tài khoản"); setForm(null); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Không tạo được", "err"); }
    setBusy(false);
  }
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast("Đã sao chép"); } catch { toast("Không sao chép được", "err"); } };

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-6">
      <Card title={`Tài khoản (${rows.length})`} actions={<Button size="sm" icon={<Plus size={15} />} onClick={() => setForm({ display_name: "", email: "", password: randomPassword(), role: "designer" })}>Tạo tài khoản</Button>}>
        {err && <p className="mb-3 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{err}{/staff_roles|relation/.test(err) ? " — cần chạy supabase/migration_staff_templates.sql." : ""}</p>}
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[12px] text-[#71717a]"><th className="py-2 pr-3">Tên hiển thị</th><th className="pr-3">Email đăng nhập</th><th className="pr-3">Vai trò</th><th className="pr-3">Trạng thái</th><th className="pr-3">Đăng nhập gần nhất</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const self = r.user_id === me;
                  return (
                    <tr key={r.user_id} className="border-t border-[#efeff1] align-middle">
                      <td className="py-2 pr-3 font-medium">{r.display_name || "—"}{self && <span className="ml-1 text-[11px] text-[#a1a1aa]">(bạn)</span>}</td>
                      <td className="pr-3">{r.email}</td>
                      <td className="pr-3"><Badge tone={r.role === "admin" ? "pink" : "gray"}>{ROLE_LABEL[r.role]}</Badge></td>
                      <td className="pr-3">{r.disabled ? <Badge tone="amber">Tạm khoá</Badge> : <Badge tone="green">Hoạt động</Badge>}</td>
                      <td className="pr-3 text-[#71717a]">{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("vi-VN") : "Chưa đăng nhập"}</td>
                      <td className="py-2">
                        <RowMenu items={[
                          { label: "Đổi vai trò", icon: <UserCog size={14} />, disabled: self, title: self ? "Không thể tự đổi vai trò" : undefined,
                            onClick: async () => { const to: StaffRole = r.role === "admin" ? "designer" : "admin"; if (await confirmDialog({ title: `Đổi sang ${ROLE_LABEL[to]}?`, message: `${r.display_name || r.email} sẽ ${to === "admin" ? "có toàn quyền quản trị" : "chỉ vào được Quản lý chất liệu và Quản lý template"}.`, confirmText: "Đổi vai trò" })) act(() => api("PATCH", { user_id: r.user_id, action: "role", value: to }), "Đã đổi vai trò"); } },
                          { label: "Đặt lại mật khẩu", icon: <KeyRound size={14} />,
                            onClick: async () => { const v = await promptDialog({ title: "Đặt lại mật khẩu", message: r.email, label: "Mật khẩu mới (tối thiểu 8 ký tự)", defaultValue: randomPassword(), confirmText: "Đặt mật khẩu" }); if (v) act(async () => { await api("PATCH", { user_id: r.user_id, action: "password", value: v }); await copy(v); }, "Đã đặt lại mật khẩu (đã sao chép)"); } },
                          { label: r.disabled ? "Mở khoá" : "Tạm khoá", icon: r.disabled ? <Unlock size={14} /> : <Lock size={14} />, disabled: self && !r.disabled, title: self && !r.disabled ? "Không thể tự khoá tài khoản của bạn" : undefined,
                            onClick: () => act(() => api("PATCH", { user_id: r.user_id, action: r.disabled ? "enable" : "disable" }), r.disabled ? "Đã mở khoá" : "Đã tạm khoá") },
                          { label: "Xoá", icon: <Trash2 size={14} />, danger: true, disabled: self, title: self ? "Không thể tự xoá tài khoản của bạn" : undefined,
                            onClick: async () => { if (await confirmDialog({ title: "Xoá tài khoản?", message: `${r.display_name || r.email} sẽ không đăng nhập được nữa. Không thể hoàn tác.`, confirmText: "Xoá tài khoản", danger: true })) act(() => api("DELETE", { user_id: r.user_id }), "Đã xoá tài khoản"); } },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>Chưa có tài khoản.</EmptyState>}
      </Card>
      {form && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={() => setForm(null)}>
          <div className="w-full max-w-[460px] space-y-3 rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-semibold">Tạo tài khoản</p>
            <Field label="Tên hiển thị"><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Ví dụ: Lan (thiết kế)" /></Field>
            <Field label="Email đăng nhập"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ten@email.com" /></Field>
            <Field label="Mật khẩu">
              <div className="flex gap-1.5">
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="font-mono" />
                <Button variant="secondary" icon={<Shuffle size={14} />} onClick={() => setForm({ ...form, password: randomPassword() })}>Tạo ngẫu nhiên</Button>
                <Button variant="secondary" icon={<Copy size={14} />} onClick={() => copy(form.password)}>Sao chép</Button>
              </div>
            </Field>
            <Field label="Vai trò"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}><option value="designer">{ROLE_LABEL.designer}</option><option value="admin">{ROLE_LABEL.admin}</option></Select></Field>
            <p className="text-[12px] text-[#71717a]">Tài khoản được xác nhận email sẵn, đăng nhập ngay ở /admin/login. Gửi email + mật khẩu cho người dùng qua kênh riêng.</p>
            <div className="flex justify-end gap-2 pt-1"><Button variant="secondary" onClick={() => setForm(null)}>Huỷ</Button><Button onClick={create} loading={busy}>Tạo tài khoản</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
