"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { AuthDialog } from "./AuthDialog";
import { FEATURE_REVIEWS } from "@/lib/features";
import { useMenuDismiss } from "@/components/ui/useMenuDismiss";

// Nút Đăng nhập / tài khoản trên header
export function AccountButton() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [staff, setStaff] = useState(false); // admin / nhà thiết kế → hiện "Trang quản trị"
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user || !hasSupabase) { setStaff(false); return; }
    createClient().rpc("my_staff_role").then((r) => setStaff(!r.error && (r.data === "admin" || r.data === "designer")), () => setStaff(false));
  }, [user]);
  useMenuDismiss(menu, () => setMenu(false));

  if (!user) {
    return (
      <>
        <button onClick={() => setOpen(true)} className="h-9 shrink-0 rounded-[8px] border border-[#e5e5e7] bg-white px-3 text-[14px] font-medium text-[#18181b] hover:bg-[#f4f4f5]">
          Đăng nhập
        </button>
        {open && <AuthDialog onClose={() => setOpen(false)} />}
      </>
    );
  }
  const name = (user.user_metadata?.display_name as string) || (user.user_metadata?.phone as string) || (user.email?.split("@")[0] ?? "") || "Tài khoản";
  return (
    <div ref={box} className="relative shrink-0">
      {menu && <div className="fixed inset-0 z-[1] bg-black/20 md:bg-transparent" onClick={() => setMenu(false)} aria-hidden />}
      <button onClick={() => setMenu(!menu)} className="relative z-[2] flex h-9 max-w-[150px] items-center gap-2 rounded-[8px] border border-[#e5e5e7] bg-white px-2 text-[14px] font-medium text-[#18181b] hover:bg-[#f4f4f5]">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#fff0f6] text-xs font-semibold text-[#ff5fa2]">{name.trim()[0]?.toUpperCase()}</span>
        <span className="truncate">{name}</span>
      </button>
      {menu && (
        <div className="absolute right-0 z-[2] mt-2 w-52 rounded-[12px] border border-[#e5e5e7] bg-white p-1 font-sans text-[14px] text-[#18181b] shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
          {staff && <><Link href="/admin" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 font-medium text-[#ff5fa2] hover:bg-[#fff0f6]">Trang quản trị</Link><div className="my-1 h-px bg-[#efeff1]" /></>}
          <Link href="/don-hang-cua-toi" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Đơn hàng của tôi</Link>
          <Link href="/thiet-ke-cua-toi" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Thiết kế của tôi</Link>
          <Link href="/tai-khoan" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Tài khoản của tôi</Link>
          {FEATURE_REVIEWS && <Link href="/san-pham#danh-gia" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Đánh giá</Link>}
          <div className="my-1 h-px bg-[#efeff1]" />
          <button onClick={async () => { await createClient().auth.signOut(); setMenu(false); }} className="block w-full rounded-[8px] px-3 py-2 text-left text-[#dc2626] hover:bg-[#fef2f2]">Đăng xuất</button>
        </div>
      )}
    </div>
  );
}
