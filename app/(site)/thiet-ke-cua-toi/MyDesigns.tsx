"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { deleteDesign, listDesigns, renameDesign, type DesignRow } from "@/lib/designs";
import { AuthDialog } from "@/components/site/AuthDialog";

export function MyDesigns() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rows, setRows] = useState<DesignRow[]>([]);
  const [err, setErr] = useState("");
  const [auth, setAuth] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listDesigns()); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải danh sách"); }
  }, []);
  useEffect(() => {
    if (!hasSupabase) { setUser(null); return; }
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  if (user === undefined) return <p className="px-4 text-center">Đang tải...</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 text-center">
        <p className="mb-4">Đăng nhập bằng số điện thoại để xem các thiết kế đã lưu.</p>
        <button className="btn" onClick={() => setAuth(true)}>Đăng nhập</button>
        {auth && <AuthDialog onClose={() => setAuth(false)} />}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4">
      {err && <p className="mb-4 rounded-[10px] bg-hot-100 px-3 py-2 text-sm text-hot-700">{err}</p>}
      {!rows.length ? (
        <div className="panel p-8 text-center">
          <p>Bạn chưa lưu thiết kế nào.</p>
          <Link href="/custom-cd" className="btn mt-4">Bắt đầu thiết kế</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-[14px] border border-[#dedad3] bg-white font-sans text-[13px]">
              <Link href={`/custom-cd?design=${r.id}`} className="block aspect-square bg-[#f4f2ee]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.thumbnail ? <img src={r.thumbnail} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-ink-500">Chưa có ảnh</span>}
              </Link>
              <div className="space-y-2 p-3">
                <p className="truncate font-semibold text-ink-900" title={r.name}>{r.name}</p>
                <p className="text-[12px] text-ink-500">Sửa {new Date(r.updated_at).toLocaleString("vi-VN")}</p>
                <div className="flex gap-1.5">
                  <Link href={`/custom-cd?design=${r.id}`} className="tool-btn is-active flex-1">Mở</Link>
                  <button className="tool-btn" onClick={async () => {
                    const name = prompt("Tên mới cho thiết kế:", r.name);
                    if (name === null) return;
                    try { await renameDesign(r.id, name); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
                  }}>Đổi tên</button>
                  <button className="tool-btn !text-[#d0303f]" onClick={async () => {
                    if (!confirm(`Xoá thiết kế "${r.name}"?`)) return;
                    try { await deleteDesign(r.id); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
                  }}>Xoá</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
