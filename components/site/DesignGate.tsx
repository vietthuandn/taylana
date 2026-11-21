"use client";
/* Cổng trang Thiết kế (khi admin bật "Yêu cầu số điện thoại / mã đơn hàng"): chưa có quyền → trang "Yêu cầu nhập mã"
   (cấu hình ở Giao diện → Khác) + ô nhập SĐT / mã đơn Shopee + nút xác nhận.
   Kiểm tra quyền bằng hàm Supabase (design_access / my_design_access — gọi thẳng từ trình duyệt, không tốn CPU của Vercel).
   Đã vào được → nhớ trên máy (localStorage) để lần sau vào thẳng; đã đăng nhập → mã được gán vào tài khoản. */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import type { StatusPage } from "@/lib/statusPages";
import { StatusView } from "./StatusView";

const KEY = "taylana-design-access";
type Cache = { v: string; until?: string | null; at: number };
const read = (): Cache | null => { try { const c = JSON.parse(localStorage.getItem(KEY) ?? "null"); return c && typeof c.v === "string" ? c : null; } catch { return null; } };
const write = (c: Cache | null) => { try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* bỏ qua */ } };
const REASON: Record<string, string> = {
  phone: "Không tìm thấy đơn đang làm với số điện thoại này.", code: "Mã đơn hàng chưa đúng hoặc chưa được tiệm xác nhận.",
  paused: "Mã đơn hàng này đang tạm ngưng — liên hệ tiệm nhé.", expired: "Mã đơn hàng đã hết hạn dùng thiết kế (7 ngày).",
};

export function DesignGate({ enabled, page, children }: { enabled: boolean; page: StatusPage; children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(enabled ? null : true);
  const [v, setV] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled || !hasSupabase) { setOk(true); return; }
    const c0 = read(); // vừa kiểm tra trong 10 phút → vào thẳng (kiểm tra lại ở nền)
    if (c0 && Date.now() - c0.at < 10 * 60 * 1000 && (!c0.until || Date.parse(c0.until) > Date.now())) setOk(true);
    (async () => {
      const sb = createClient(), c = read();
      // có mã đã lưu → kiểm tra lại (đã đăng nhập thì tự gán mã vào tài khoản)
      if (c) { const r = await sb.rpc("design_access", { p_value: c.v }); if (r.data?.ok) { write({ v: c.v, until: r.data.until ?? null, at: Date.now() }); setOk(true); return; } }
      const { data: { user } } = await sb.auth.getUser();
      if (user) { const r = await sb.rpc("my_design_access"); if (r.data?.ok) { setOk(true); return; } }
      write(null); setOk(false);
    })().catch(() => setOk(false));
  }, [enabled]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.trim()) return setErr("Nhập số điện thoại hoặc mã đơn hàng nhé.");
    setBusy(true); setErr("");
    const r = await createClient().rpc("design_access", { p_value: v.trim() });
    setBusy(false);
    if (r.error) return setErr(/design_access|schema cache/i.test(r.error.message) ? "Tiệm chưa bật tính năng này (cần chạy migration)." : r.error.message);
    if (!r.data?.ok) return setErr(REASON[r.data?.reason as string] ?? "Chưa xác nhận được, bạn kiểm tra lại nhé.");
    write({ v: v.trim(), until: r.data.until ?? null, at: Date.now() });
    setOk(true);
  }
  if (ok) return <>{children}</>;
  if (ok === null) return <div className="grid min-h-[50dvh] place-items-center text-[14px] text-[#71717a]">Đang kiểm tra…</div>;
  return (
    <StatusView page={page}>
      <form onSubmit={submit} className="mt-5 flex w-full max-w-[380px] flex-col gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Số điện thoại hoặc mã đơn hàng Shopee" autoComplete="tel" aria-label="Số điện thoại hoặc mã đơn hàng Shopee"
          className="h-12 w-full rounded-[10px] border border-[#d4d4d8] bg-white px-4 text-center text-[16px] outline-none focus:border-[var(--c-primary,#ff5fa2)]" />
        {err && <p className="text-[13px] text-[#dc2626]">{err}</p>}
        <button type="submit" disabled={busy} className="h-12 rounded-[10px] bg-[var(--c-primary,#ff5fa2)] text-[15px] font-semibold text-white disabled:opacity-60">{busy ? "Đang kiểm tra…" : page.submit || "Vào thiết kế"}</button>
      </form>
    </StatusView>
  );
}
