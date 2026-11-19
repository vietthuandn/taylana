"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { deleteDesign, listDesigns, renameDesign, type DesignRow } from "@/lib/designs";
import { AuthDialog } from "@/components/site/AuthDialog";
import { Trash2 } from "lucide-react";
import { Button, confirmDialog } from "@/components/ui/kit";
import { btnClass } from "@/components/ui/styles";

// thiết kế Booklet Lyrics / Booklet Scrapbook mở ở trang riêng, còn lại mở trình chỉnh CD
const openHref = (r: DesignRow) => (r.kind === "lyrics-booklet" ? `/thiet-ke/booklet-lyrics?design=${r.id}` : r.kind === "booklet-scrapbook" ? `/thiet-ke/booklet-scrapbook?design=${r.id}` : `/thiet-ke/cd?design=${r.id}`);

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

  if (user === undefined) return <p className="px-4 py-12 text-center text-[#71717a]">Đang tải...</p>;
  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-12">
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-8 text-center">
          <p className="mb-4 text-[#71717a]">Đăng nhập bằng số điện thoại để xem các thiết kế đã lưu.</p>
          <Button onClick={() => setAuth(true)}>Đăng nhập</Button>
        </div>
        {auth && <AuthDialog onClose={() => setAuth(false)} />}
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12">
      {err && <p className="mb-4 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{err}</p>}
      {!rows.length ? (
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-10 text-center">
          <p className="text-[#71717a]">Bạn chưa lưu thiết kế nào.</p>
          <Button href="/thiet-ke/cd" className="mt-4">Bắt đầu thiết kế</Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white text-[13px] transition-shadow hover:shadow-[0_4px_16px_rgb(0_0_0/0.06)]">
              <Link href={openHref(r)} className="block aspect-square bg-[#f4f4f5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.thumbnail ? <img src={r.thumbnail} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-ink-500">Chưa có ảnh</span>}
              </Link>
              <div className="space-y-2 p-3">
                <p className="truncate font-semibold text-ink-900" title={r.name}>{r.name}</p>
                <p className="text-[12px] text-ink-500">Sửa {new Date(r.updated_at).toLocaleString("vi-VN")}</p>
                <div className="flex gap-1.5">
                  <Button href={openHref(r)} size="sm" className="flex-1">Mở</Button>
                  <button className={btnClass("secondary", "sm")} onClick={async () => {
                    const name = prompt("Tên mới cho thiết kế:", r.name);
                    if (name === null) return;
                    try { await renameDesign(r.id, name); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
                  }}>Đổi tên</button>
                  <button className={btnClass("danger", "sm")} aria-label="Xoá" onClick={async () => {
                    if (!await confirmDialog(`Xoá thiết kế "${r.name}"?`)) return;
                    try { await deleteDesign(r.id); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
                  }}><Trash2 size={16} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
