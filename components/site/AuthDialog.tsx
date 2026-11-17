"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { normalizePhone, phoneToEmail, PHONE_ERROR } from "@/lib/phoneAuth";
import { btnClass, inputClass } from "@/components/ui/styles";

// Popup đăng nhập / đăng ký khách bằng số điện thoại + mật khẩu
export function AuthDialog({ onClose, onDone, title }: { onClose: () => void; onDone?: () => void; title?: string }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const p = normalizePhone(phone);
    if (!p) return setErr(`${PHONE_ERROR} (ví dụ 0905 546 694).`);
    if (pass.length < 6) return setErr("Mật khẩu tối thiểu 6 ký tự.");
    const sb = createClient();
    setBusy(true);
    if (tab === "register") {
      if (pass !== pass2) { setBusy(false); return setErr("Mật khẩu nhập lại không khớp."); }
      if (!name.trim()) { setBusy(false); return setErr("Vui lòng nhập tên hiển thị."); }
      const { data, error } = await sb.auth.signUp({ email: phoneToEmail(p), password: pass, options: { data: { display_name: name.trim(), phone: p } } });
      if (error) { setBusy(false); return setErr(error.message.includes("registered") ? "Số điện thoại này đã có tài khoản, bạn đăng nhập nhé." : error.message); }
      if (!data.session) {
        const r = await sb.auth.signInWithPassword({ email: phoneToEmail(p), password: pass });
        if (r.error) { setBusy(false); return setErr("Đã tạo tài khoản nhưng chưa đăng nhập được. Tiệm cần tắt xác nhận email trong Supabase."); }
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: phoneToEmail(p), password: pass });
      if (error) { setBusy(false); return setErr("Sai số điện thoại hoặc mật khẩu."); }
    }
    // gắn các đơn đã đặt bằng SĐT này (khi chưa đăng nhập) vào tài khoản
    await sb.rpc("claim_my_orders").then(() => undefined, () => undefined);
    setBusy(false);
    onDone?.();
    onClose();
  }

  const input = inputClass;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-[12px] border border-[#e5e5e7] bg-white p-5 font-sans text-[14px] text-[#18181b] shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[16px] font-semibold text-[#18181b]">{title ?? (tab === "login" ? "Đăng nhập" : "Tạo tài khoản")}</p>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="mb-4 flex rounded-[8px] bg-[#f4f4f5] p-0.5">
          {(["login", "register"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setErr(""); }}
              className={`h-8 flex-1 rounded-[6px] text-[13px] font-medium ${tab === t ? "bg-white text-[#18181b] shadow-sm" : "text-[#71717a]"}`}>
              {t === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          <input className={input} type="tel" inputMode="tel" autoComplete="tel" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {tab === "register" && <input className={input} placeholder="Tên hiển thị" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />}
          <input className={input} type="password" autoComplete={tab === "login" ? "current-password" : "new-password"} placeholder="Mật khẩu (tối thiểu 6 ký tự)" value={pass} onChange={(e) => setPass(e.target.value)} />
          {tab === "register" && <input className={input} type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={pass2} onChange={(e) => setPass2(e.target.value)} />}
        </div>
        {err && <p className="mt-3 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{err}</p>}
        <button disabled={busy} className={`${btnClass("primary")} mt-4 w-full`}>
          {busy ? "Đang xử lý..." : tab === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </form>
    </div>
  );
}
