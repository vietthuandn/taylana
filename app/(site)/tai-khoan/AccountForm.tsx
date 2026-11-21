"use client";
/* Tài khoản của tôi: Thông tin (tên hiển thị, SĐT) · Đổi mật khẩu · Thông tin nhận hàng mặc định (tự điền khi đặt đơn).
   Tên + địa chỉ lưu trong user_metadata; đổi SĐT qua /api/account/phone (đổi email ảo đăng nhập ở server). */
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { isCustomerEmail, normalizePhone, phoneToEmail, PHONE_ERROR } from "@/lib/phoneAuth";
import { Button, Field, Input } from "@/components/ui/kit";

type Ship = { name: string; phone: string; province: string; ward: string; street: string };
const emptyShip: Ship = { name: "", phone: "", province: "", ward: "", street: "" };
type Msg = { ok: boolean; t: string } | null;

function Block({ title, children, msg, busy, onSave, label = "Lưu" }: { title: string; children: React.ReactNode; msg: Msg; busy: boolean; onSave: () => void; label?: string }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="rounded-[12px] border border-[#e5e5e7] bg-white p-4 sm:p-5">
      <p className="mb-3 text-[15px] font-semibold text-[#18181b]">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      {msg && <p className={`mt-3 rounded-[8px] px-3 py-2 text-[13px] ${msg.ok ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fef2f2] text-[#dc2626]"}`}>{msg.t}</p>}
      <Button type="submit" loading={busy} className="mt-4">{label}</Button>
    </form>
  );
}

export function AccountForm() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [name, setName] = useState(""), [phone, setPhone] = useState("");
  const [cur, setCur] = useState(""), [p1, setP1] = useState(""), [p2, setP2] = useState("");
  const [ship, setShip] = useState<Ship>(emptyShip);
  const [busy, setBusy] = useState(""), [msg, setMsg] = useState<Record<string, Msg>>({});
  const say = (k: string, ok: boolean, t: string) => setMsg((m) => ({ ...m, [k]: { ok, t } }));

  useEffect(() => {
    if (!hasSupabase) { setUser(null); return; }
    createClient().auth.getUser().then(({ data }) => {
      const u = data.user; setUser(u);
      if (!u) return;
      const m = u.user_metadata ?? {};
      setName((m.display_name as string) || ""); setPhone((m.phone as string) || u.email?.split("@")[0] || "");
      setShip({ ...emptyShip, ...((m.ship as Partial<Ship>) ?? {}) });
    });
  }, []);

  if (user === undefined) return <div className="mx-auto max-w-2xl px-4 py-8 text-[14px] text-[#71717a]">Đang tải…</div>;
  if (!user) return <div className="mx-auto max-w-2xl px-4 py-8 text-[14px] text-[#71717a]">Bạn cần đăng nhập để xem trang này (nút Đăng nhập ở góc trên).</div>;
  const customer = isCustomerEmail(user.email);

  async function saveInfo() {
    if (!name.trim()) return say("info", false, "Vui lòng nhập tên hiển thị.");
    const sb = createClient();
    setBusy("info");
    try {
      const oldPhone = (user!.user_metadata?.phone as string) || "";
      let np = oldPhone;
      if (customer) {
        const p = normalizePhone(phone);
        if (!p) throw new Error(`${PHONE_ERROR} (ví dụ 0905 546 694).`);
        if (phoneToEmail(p) !== user!.email) {
          const r = await fetch("/api/account/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: p }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || "Không đổi được số điện thoại");
          await sb.auth.refreshSession();
        }
        np = p; setPhone(p);
      }
      const { data, error } = await sb.auth.updateUser({ data: { display_name: name.trim(), ...(customer ? { phone: np } : {}) } });
      if (error) throw error;
      setUser(data.user);
      say("info", true, np !== oldPhone ? `Đã lưu. Từ giờ bạn đăng nhập bằng số ${np}.` : "Đã lưu thông tin.");
    } catch (e) { say("info", false, e instanceof Error ? e.message : "Lỗi"); }
    setBusy("");
  }

  async function savePass() {
    if (p1.length < 6) return say("pass", false, "Mật khẩu mới tối thiểu 6 ký tự.");
    if (p1 !== p2) return say("pass", false, "Mật khẩu nhập lại không khớp.");
    const sb = createClient();
    setBusy("pass");
    const chk = await sb.auth.signInWithPassword({ email: user!.email!, password: cur });
    if (chk.error) { setBusy(""); return say("pass", false, "Mật khẩu hiện tại không đúng."); }
    const { error } = await sb.auth.updateUser({ password: p1 });
    setBusy("");
    if (error) return say("pass", false, error.message);
    setCur(""); setP1(""); setP2("");
    say("pass", true, "Đã đổi mật khẩu.");
  }

  async function saveShip() {
    if (ship.phone.trim() && !normalizePhone(ship.phone)) return say("ship", false, `${PHONE_ERROR} (ví dụ 0905 546 694).`);
    const v: Ship = { name: ship.name.trim(), phone: ship.phone.trim() ? normalizePhone(ship.phone)! : "", province: ship.province.trim(), ward: ship.ward.trim(), street: ship.street.trim() };
    setBusy("ship");
    const { error } = await createClient().auth.updateUser({ data: { ship: v } });
    setBusy("");
    if (error) return say("ship", false, error.message);
    setShip(v);
    say("ship", true, "Đã lưu. Thông tin này sẽ tự điền khi bạn đặt đơn.");
  }

  const set = (k: keyof Ship) => (e: React.ChangeEvent<HTMLInputElement>) => setShip({ ...ship, [k]: e.target.value });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-12 font-sans">
      <Block title="Thông tin" msg={msg.info ?? null} busy={busy === "info"} onSave={saveInfo}>
        <Field label="Tên hiển thị *"><Input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {customer
          ? <Field label="Số điện thoại (đăng nhập)" hint="Đổi số thì lần sau đăng nhập bằng số mới."><Input type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          : <Field label="Email đăng nhập"><Input value={user.email ?? ""} disabled /></Field>}
      </Block>
      <Block title="Đổi mật khẩu" msg={msg.pass ?? null} busy={busy === "pass"} onSave={savePass} label="Đổi mật khẩu">
        <Field label="Mật khẩu hiện tại" className="sm:col-span-2"><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="Mật khẩu mới (tối thiểu 6 ký tự)"><Input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
        <Field label="Nhập lại mật khẩu mới"><Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
      </Block>
      <Block title="Thông tin nhận hàng mặc định" msg={msg.ship ?? null} busy={busy === "ship"} onSave={saveShip}>
        <Field label="Tên người nhận"><Input maxLength={100} autoComplete="name" value={ship.name} onChange={set("name")} /></Field>
        <Field label="Số điện thoại"><Input type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={ship.phone} onChange={set("phone")} /></Field>
        <Field label="Tỉnh / Thành phố"><Input maxLength={100} autoComplete="address-level1" placeholder="Ví dụ: TP. Hồ Chí Minh" value={ship.province} onChange={set("province")} /></Field>
        <Field label="Phường / Xã"><Input maxLength={100} autoComplete="address-level3" value={ship.ward} onChange={set("ward")} /></Field>
        <Field label="Số nhà và đường" className="sm:col-span-2"><Input maxLength={300} autoComplete="street-address" value={ship.street} onChange={set("street")} /></Field>
      </Block>
    </div>
  );
}
