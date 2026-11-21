"use client";
/* Nút "Lưu" của CD Template / Booklet Template / Back cover Template: nhắc thiết kế chỉ lưu 24 giờ (kể từ lần sửa gần nhất),
   tối đa 5 thiết kế. Chưa đăng nhập → "Đăng nhập để lưu" (mở form đăng nhập / đăng ký, xong là tự lưu). */
import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { AuthDialog } from "@/components/site/AuthDialog";
import { Button } from "@/components/ui/kit";

export function SaveDesignDialog({ onSave, onClose }: { onSave: () => Promise<void>; onClose: () => void }) {
  const [user, setUser] = useState<boolean | null>(null);
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!hasSupabase) { setUser(false); return; }
    createClient().auth.getUser().then(({ data }) => setUser(!!data.user));
  }, []);
  async function save() { setBusy(true); try { await onSave(); onClose(); } finally { setBusy(false); } }
  if (auth) return <AuthDialog title="Đăng nhập để lưu thiết kế" onClose={() => setAuth(false)} onDone={() => { setAuth(false); setUser(true); save(); }} />;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-5 font-sans shadow-xl">
        <div className="mb-3 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--c-secondary)] text-[var(--c-primary)]"><Clock size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[#18181b]">Lưu thiết kế</p>
            <p className="mt-1 text-[14px] leading-relaxed text-[#3f3f46]">Mẫu chỉ được lưu <b>24 tiếng</b> kể từ lần sửa gần nhất. Vui lòng chỉnh sửa và tải ảnh / đặt đơn trong vòng 1 ngày nhé.</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Mỗi tài khoản lưu tối đa 5 thiết kế. Xem lại ở “Thiết kế của tôi”.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Bỏ qua</Button>
          {user === false
            ? <Button onClick={() => setAuth(true)}>Đăng nhập để lưu</Button>
            : <Button onClick={save} loading={busy} disabled={user === null}>Lưu</Button>}
        </div>
      </div>
    </div>
  );
}
