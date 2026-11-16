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
        <button onClick={() => setOpen(true)} className="h-10 shrink-0 rounded-full border-[1.5px] border-ink-900 px-4 text-sm font-semibold text-ink-900 hover:bg-ink-900 hover:text-white">
          Đăng nhập
        </button>
        {open && <AuthDialog onClose={() => setOpen(false)} />}
      </>
    );
  }
  const name = (user.user_metadata?.display_name as string) || (user.user_metadata?.phone as string) || "Tài khoản";
  return (
    <div ref={box} className="relative shrink-0">
      <button onClick={() => setMenu(!menu)} className="flex h-10 max-w-[150px] items-center gap-2 rounded-full border-[1.5px] border-ink-900 px-3 text-sm font-semibold text-ink-900">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ff5fa2] text-xs text-white">{name.trim()[0]?.toUpperCase()}</span>
        <span className="truncate">{name}</span>
      </button>
      {menu && (
        <div className="absolute right-0 mt-2 w-52 rounded-[12px] border border-[#dedad3] bg-white p-1 font-sans text-[14px] shadow-lg">
          <Link href="/thiet-ke-cua-toi" onClick={() => setMenu(false)} className="block rounded-[8px] px-3 py-2 hover:bg-[#f4f2ee]">Thiết kế của tôi</Link>
          <button onClick={async () => { await createClient().auth.signOut(); setMenu(false); }} className="block w-full rounded-[8px] px-3 py-2 text-left hover:bg-[#f4f2ee]">Đăng xuất</button>
        </div>
      )}
    </div>
  );
}
