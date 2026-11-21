"use client";

/* Chỉ admin thấy: nút "Mẫu: ... ▾" để xem trước các mẫu trang chủ + thanh "Đang xem trước" để đặt làm trang chủ. */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LayoutTemplate } from "lucide-react";
import type { HomeVariantMeta } from "@/lib/homeVariants";
import { setActiveHomeVariant } from "@/app/admin/homeVariantActions";
import { AdminOverlays, confirmDialog, toast } from "@/components/ui/kit";

export function HomeVariantSwitcher({ variants, current, active }: { variants: HomeVariantMeta[]; current: string; active: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cur = variants.find((v) => v.id === current);
  const previewing = current !== active;
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  async function makeActive() {
    if (!cur || !await confirmDialog(`Đặt "${cur.name}" làm trang chủ cho mọi khách?`, { title: "Đổi trang chủ", ok: "Đặt làm trang chủ", danger: false })) return;
    setBusy(true);
    const r = await setActiveHomeVariant(cur.id);
    setBusy(false);
    if (r.error) return toast(r.error, "err");
    toast(`Đã đặt "${cur.name}" làm trang chủ.`);
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      {previewing && (
        <div className="sticky top-[var(--header-h)] z-30 border-b border-[#ffd1e5] bg-[#fff5f9] font-sans">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-[13px] text-[#18181b]">
            <span className="min-w-0 flex-1">Đang xem trước <b className="font-semibold">{cur?.name}</b></span>
            <button type="button" disabled={busy} onClick={makeActive} className="h-8 rounded-[8px] bg-[#ff5fa2] px-3 font-medium text-white hover:bg-[#f0468f] disabled:opacity-50">Đặt làm trang chủ</button>
            <button type="button" onClick={() => router.push("/")} className="h-8 rounded-[8px] border border-[#e5e5e7] bg-white px-3 font-medium hover:bg-[#f4f4f5]">Thoát xem trước</button>
          </div>
        </div>
      )}
      <div ref={box} className={`fixed right-4 z-30 font-sans ${previewing ? "top-[calc(var(--header-h)+56px)]" : "top-[calc(var(--header-h)+12px)]"}`}>
        <button type="button" onClick={() => setOpen(!open)}
          className="flex h-9 items-center gap-2 rounded-full border border-[#e5e5e7] bg-white px-3 text-[13px] font-medium text-[#18181b] shadow-[0_4px_16px_rgb(0_0_0/0.08)] hover:bg-[#fafafa]">
          <LayoutTemplate size={16} className="text-[#ff5fa2]" /> Mẫu: {cur?.name ?? current} <ChevronDown size={14} className="text-[#a1a1aa]" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-72 rounded-[12px] border border-[#e5e5e7] bg-white p-1 shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
            {variants.map((v) => (
              <button key={v.id} type="button" onClick={() => { setOpen(false); router.push(v.id === active ? "/" : `/xem-truoc/${encodeURIComponent(v.id)}`); }}
                className="flex w-full items-start gap-2 rounded-[8px] px-3 py-2 text-left hover:bg-[#f4f4f5]">
                <span className="mt-0.5 w-4 shrink-0">{v.id === current && <Check size={16} className="text-[#ff5fa2]" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[14px] font-medium text-[#18181b]">
                    {v.name}
                    {v.id === active && <span className="rounded-full bg-[#ecfdf3] px-2 text-[11px] font-medium text-[#15803d]">Đang dùng</span>}
                  </span>
                  <span className="block text-[12px] text-[#71717a]">{v.description}</span>
                </span>
              </button>
            ))}
            <a href="/admin/giao-dien" className="mt-1 block border-t border-[#efeff1] px-3 py-2 text-[13px] text-[#ff5fa2] hover:text-[#e0468a]">Quản lý giao diện trang chủ →</a>
          </div>
        )}
      </div>
      <AdminOverlays />
    </>
  );
}
