"use client";
/* Chuông thông báo (chỉ admin): đơn mới · khách đăng ký · khách dùng quá 100MB ảnh (bảng admin_notifications — ghi bằng trigger).
   Hỏi lại mỗi 60 giây khi tab đang mở (truy vấn thẳng Supabase, không qua Vercel). Mở danh sách → "Đánh dấu đã đọc tất cả". */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, HardDrive, ShoppingBag, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/components/admin/styles";

type N = { id: string; kind: "order" | "signup" | "storage"; title: string; body: string; link: string | null; read_at: string | null; created_at: string };
const ICON = { order: ShoppingBag, signup: UserPlus, storage: HardDrive };
const ago = (s: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(s)) / 60000)); return m < 1 ? "vừa xong" : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`; };

export function NotificationBell() {
  const [list, setList] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const { data, error } = await createClient().from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(30);
    if (error) { setMissing(/admin_notifications|schema cache|does not exist/i.test(error.message)); return; }
    setList((data ?? []) as N[]); setMissing(false);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", h); return () => document.removeEventListener("pointerdown", h);
  }, [open]);
  const unread = list.filter((n) => !n.read_at).length;
  async function readAll() {
    const ids = list.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setList((l) => l.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await createClient().from("admin_notifications").update({ read_at: now }).in("id", ids);
  }
  async function readOne(n: N) {
    if (n.read_at) return;
    const now = new Date().toISOString();
    setList((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)));
    await createClient().from("admin_notifications").update({ read_at: now }).eq("id", n.id);
  }
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ""}`} title="Thông báo"
        className="relative grid h-8 w-8 place-items-center rounded-[6px] text-[#3f3f46] hover:bg-[#f4f4f5]">
        <Bell size={17} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ef4444] px-1 text-[10px] font-semibold leading-none text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
          <div className="flex items-center justify-between border-b border-[#efeff1] px-3 py-2.5">
            <p className="text-[14px] font-semibold">Thông báo</p>
            {unread > 0 && <button type="button" onClick={readAll} className="text-[12px] font-medium text-[#ff5fa2]">Đánh dấu đã đọc tất cả</button>}
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {missing && <li className="p-4 text-[13px] text-[#b45309]">Chưa có bảng thông báo — cần chạy supabase/migration_admin_notifications.sql.</li>}
            {!missing && !list.length && <li className="p-6 text-center text-[13px] text-[#71717a]">Chưa có thông báo nào.</li>}
            {list.map((n) => {
              const I = ICON[n.kind] ?? Bell;
              const inner = (
                <>
                  <span className={cx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", n.kind === "storage" ? "bg-[#fffbeb] text-[#b45309]" : n.kind === "signup" ? "bg-[#eff6ff] text-[#2563eb]" : "bg-[#fff0f6] text-[#ff5fa2]")}><I size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate text-[13px]", n.read_at ? "text-[#52525b]" : "font-semibold text-[#18181b]")}>{n.title}</span>
                    {n.body && <span className="block truncate text-[12px] text-[#71717a]">{n.body}</span>}
                    <span className="block text-[11px] text-[#a1a1aa]">{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ff5fa2]" aria-label="Chưa đọc" />}
                </>
              );
              const cls = "flex gap-2.5 border-b border-[#f4f4f5] px-3 py-2.5 text-left hover:bg-[#fafafa]";
              return <li key={n.id}>{n.link ? <Link href={n.link} onClick={() => { readOne(n); setOpen(false); }} className={cls}>{inner}</Link> : <button type="button" onClick={() => readOne(n)} className={cx(cls, "w-full")}>{inner}</button>}</li>;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
