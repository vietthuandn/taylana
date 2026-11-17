"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { AuthDialog } from "./AuthDialog";

// Nút Đăng nhập / tài khoản trên header
export function AccountButton() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

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
  const name = (user.user_metadata?.display_name as string) || (user.user_metadata?.phone as string) || "Tài khoản";
  return (
    <div ref={box} className="relative shrink-0">
      <button onClick={() => setMenu(!menu)} className="flex h-9 max-w-[150px] items-center gap-2 rounded-[8px] border border-[#e5e5e7] bg-white px-2 text-[14px] font-medium text-[#18181b] hover:bg-[#f4f4f5]">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#fff0f6] text-xs font-semibold text-[#ff5fa2]">{name.trim()[0]?.toUpperCase()}</span>
        <span className="truncate">{name}</span>
      </button>
      {menu && (
        <div className="absolute right-0 mt-2 w-52 rounded-[12px] border border-[#e5e5e7] bg-white p-1 font-sans text-[14px] text-[#18181b] shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
          <Link href="/don-hang-cua-toi" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Đơn hàng của tôi</Link>
          <Link href="/thiet-ke-cua-toi" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Thiết kế của tôi</Link>
          <div className="my-1 h-px bg-[#efeff1]" />
          <Link href="/huong-dan" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Hướng dẫn</Link>
          <Link href="/san-pham#danh-gia" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Đánh giá</Link>
          <Link href="/lien-he" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f4f5]">Liên hệ</Link>
          <button onClick={async () => { await createClient().auth.signOut(); setMenu(false); }} className="block w-full rounded-[8px] px-3 py-2 text-left text-[#dc2626] hover:bg-[#fef2f2]">Đăng xuất</button>
        </div>
      )}
    </div>
  );
}
