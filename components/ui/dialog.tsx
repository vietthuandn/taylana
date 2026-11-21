"use client";

/* Hộp thoại dùng chung (thay window.alert / confirm / prompt) cho cả trang khách và admin.
   Nền mờ, card trắng bo 12px, tiêu đề + nội dung, nút phụ "Huỷ" bên trái, nút chính hồng bên phải (thao tác nguy hiểm: đỏ).
   Esc = huỷ · Enter = xác nhận · focus tự vào nút chính (hoặc ô nhập). Mỗi hàm trả về Promise. Hiển thị bởi <DialogHost />
   (đã gắn sẵn trong AdminOverlays — có ở mọi trang khách và admin). */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Base = { title: string; message?: React.ReactNode };
type Item =
  | (Base & { kind: "confirm"; confirmText: string; cancelText: string; danger: boolean; resolve: (v: boolean) => void })
  | (Base & { kind: "alert"; confirmText: string; resolve: () => void })
  | (Base & { kind: "prompt"; label?: string; value: string; placeholder?: string; confirmText: string; cancelText: string; resolve: (v: string | null) => void });

let queue: Item[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const push = (d: Item) => { queue = [...queue, d]; emit(); };
const pop = () => { queue = queue.slice(1); emit(); };

export function confirmDialog(o: { title: string; message?: React.ReactNode; confirmText?: string; cancelText?: string; danger?: boolean }) {
  return new Promise<boolean>((resolve) => push({ kind: "confirm", title: o.title, message: o.message, confirmText: o.confirmText ?? "Đồng ý", cancelText: o.cancelText ?? "Huỷ", danger: !!o.danger, resolve }));
}
export function alertDialog(o: { title: string; message?: React.ReactNode; confirmText?: string }) {
  return new Promise<void>((resolve) => push({ kind: "alert", title: o.title, message: o.message, confirmText: o.confirmText ?? "Đã hiểu", resolve }));
}
export function promptDialog(o: { title: string; label?: string; message?: React.ReactNode; defaultValue?: string; placeholder?: string; confirmText?: string; cancelText?: string }) {
  return new Promise<string | null>((resolve) => push({ kind: "prompt", title: o.title, message: o.message, label: o.label, value: o.defaultValue ?? "", placeholder: o.placeholder, confirmText: o.confirmText ?? "Lưu", cancelText: o.cancelText ?? "Huỷ", resolve }));
}

const btn = "inline-flex h-10 items-center justify-center rounded-[8px] px-4 text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
let owner = 0, nextId = 1;
export function DialogHost() {
  const [me] = useState(() => nextId++);
  useEffect(() => { if (!owner) owner = me; return () => { if (owner === me) owner = 0; }; }, [me]);
  const list = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => queue, () => queue);
  const d = list[0];
  const [val, setVal] = useState("");
  const ok = useRef<HTMLButtonElement>(null), inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!d) return;
    if (d.kind === "prompt") { setVal(d.value); setTimeout(() => { inp.current?.focus(); inp.current?.select(); }, 0); }
    else setTimeout(() => ok.current?.focus(), 0);
  }, [d]);
  if (!d || (owner && owner !== me)) return null; // nhiều chỗ gắn DialogHost → chỉ 1 cái hiển thị
  const cancel = () => { if (d.kind === "confirm") d.resolve(false); else if (d.kind === "prompt") d.resolve(null); else d.resolve(); pop(); };
  const accept = () => { if (d.kind === "confirm") d.resolve(true); else if (d.kind === "prompt") d.resolve(val); else d.resolve(); pop(); };
  const danger = d.kind === "confirm" && d.danger;
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/40 p-4 backdrop-blur-[1px]" role="dialog" aria-modal aria-labelledby="dlg-title" onClick={cancel}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); accept(); } }}>
      <div className="w-full max-w-[420px] rounded-[12px] border border-[#e5e5e7] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p id="dlg-title" className="text-[16px] font-semibold text-[#18181b]">{d.title}</p>
        {d.message && <div className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-[#71717a]">{d.message}</div>}
        {d.kind === "prompt" && (
          <label className="mt-3 block text-[13px] text-[#52525b]">{d.label}
            <input ref={inp} value={val} onChange={(e) => setVal(e.target.value)} placeholder={d.placeholder}
              className="mt-1 h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] text-[#18181b] outline-none focus:border-[var(--c-primary)]" />
          </label>
        )}
        <div className="mt-5 flex items-center justify-between gap-2">
          {d.kind !== "alert" ? <button type="button" onClick={cancel} className={`${btn} border border-[#e5e5e7] bg-white text-[#3f3f46] hover:bg-[#f4f4f5] focus-visible:ring-[#a1a1aa]`}>{d.cancelText}</button> : <span />}
          <button ref={ok} type="button" onClick={accept}
            className={`${btn} text-white ${danger ? "bg-[#dc2626] hover:bg-[#b91c1c] focus-visible:ring-[#dc2626]" : "bg-[var(--c-primary)] hover:bg-[var(--c-primary-hover)] focus-visible:ring-[var(--c-primary)]"}`}>{d.confirmText}</button>
        </div>
      </div>
    </div>
  );
}
