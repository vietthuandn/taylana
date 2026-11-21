"use client";

/* Bộ component dùng chung cho trang Admin (kiểu dashboard SaaS tối giản).
   Màu nhấn duy nhất: hồng #ff5fa2. Lỗi: đỏ #dc2626. Icon: lucide-react 16px. */
import { DialogHost, confirmDialog as dlgConfirm } from "./dialog";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { uploadPublicImage } from "@/lib/upload";
import { btnClass, cx, inputClass, type BtnVariant } from "./styles";

export { btnClass, cx, inputClass };

export function Button({ variant = "primary", size = "md", loading, icon, className, children, href, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "md" | "sm"; loading?: boolean; icon?: React.ReactNode; href?: string }) {
  const inner = <>{loading ? <Loader2 size={16} className="animate-spin" /> : icon}{children}</>;
  if (href) return <Link href={href} className={cx(btnClass(variant, size), className)}>{inner}</Link>;
  return <button type="button" {...rest} className={cx(btnClass(variant, size), className)} disabled={rest.disabled || loading}>{inner}</button>;
}

// ---------- Input / Select / Textarea ----------
export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputClass, className)} />;
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputClass, "pr-8", className)} />;
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputClass, "h-auto min-h-[72px] py-2", className)} />;

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-[#18181b]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-[#71717a]">{hint}</span>}
    </label>
  );
}

// ---------- Toggle 32 × 18 ----------
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-left text-[14px] text-[#18181b]">
      <span className={cx("relative h-[18px] w-8 shrink-0 rounded-full transition-colors", checked ? "bg-[#ff5fa2]" : "bg-[#d4d4d8]")}>
        <span className={cx("absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-all", checked ? "left-[16px]" : "left-[2px]")} />
      </span>
      {label}
    </button>
  );
}

// ---------- Ô màu 24px ----------
export function Swatch({ color, active, onClick, title }: { color: string; active?: boolean; onClick: () => void; title?: string }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={cx("h-6 w-6 shrink-0 rounded-[6px] border border-black/10 transition", active && "ring-2 ring-[#ff5fa2] ring-offset-2")}
      style={{ background: color }} />
  );
}
export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-[6px] border border-[#e5e5e7] bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu khác">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu khác" />
    </label>
  );
}

// ---------- Card ----------
export function Card({ title, description, actions, children, className, padded = true }: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={cx("rounded-[12px] border border-[#e5e5e7] bg-white", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-[#efeff1] px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-[#18181b]">{title}</h2>}
            {description && <p className="mt-0.5 text-[12px] text-[#71717a]">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {padded ? <div className="p-5">{children}</div> : children}
    </section>
  );
}

// Card dạng 2 cột: tên nhóm + mô tả (30%) | các trường nhập (70%)
export function SettingsSection({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 rounded-[12px] border border-[#e5e5e7] bg-white p-5 md:grid-cols-[30%_1fr] md:gap-8">
      <div>
        <h2 className="text-[15px] font-semibold text-[#18181b]">{title}</h2>
        {description && <p className="mt-1 text-[12px] leading-relaxed text-[#71717a]">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

// ---------- Đầu trang ----------
// Tiêu đề trang admin: căn trái, không có dòng mô tả, cách nội dung bên dưới 16px
export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-left text-[20px] font-semibold tracking-[-0.01em] text-[#18181b]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
// Khung trang dạng form / danh sách: rộng tối đa 1200px, căn giữa
export function AdminPage({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={cx("mx-auto w-full px-4 py-6 md:p-8", wide ? "max-w-[1400px]" : "max-w-[1200px]")}>{children}</div>;
}

// ---------- Bảng ----------
/* Điện thoại (< 640px): chỉ hiện các cột `keep` (mặc định 2 cột đầu) + cột thao tác cuối (cột tiêu đề rỗng);
   chạm vào dòng → mở các cột còn lại (kèm tên cột). Máy tính: bảng bình thường. */
export function Table({ head, children, empty, keep = [0, 1] }: { head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode; keep?: number[] }) {
  const body = useRef<HTMLTableSectionElement>(null);
  const last = head.length - 1, action = head[last] === "" || head[last] == null;
  useEffect(() => {
    for (const tr of Array.from(body.current?.rows ?? [])) {
      Array.from(tr.cells).forEach((td, i) => {
        td.dataset.m = action && i === last ? "a" : keep.includes(i) ? "k" : "x";
        const h = head[i]; td.dataset.label = typeof h === "string" ? h : "";
      });
      tr.dataset.more = Array.from(tr.cells).some((td) => td.dataset.m === "x" && td.textContent?.trim()) ? "1" : "";
    }
  });
  function onClick(e: React.MouseEvent) {
    if (window.innerWidth >= 640 || (e.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
    const tr = (e.target as HTMLElement).closest("tr");
    if (tr?.dataset.more) tr.toggleAttribute("data-open");
  }
  return (
    <div className="rtable overflow-x-auto rounded-[12px] border border-[#e5e5e7] bg-white">
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-[#e5e5e7] bg-[#fafafa]">
            {head.map((h, i) => (
              <th key={i} className={cx("h-10 px-4 text-[12px] font-medium text-[#71717a]", i === head.length - 1 && "text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody ref={body} onClick={onClick} className="[&>tr]:h-12 [&>tr]:border-b [&>tr]:border-[#f0f0f2] [&>tr:last-child]:border-0 [&>tr:hover]:bg-[#fafafa] [&_td]:px-4">
          {children}
        </tbody>
      </table>
      {empty}
    </div>
  );
}
export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 py-12 text-center text-[14px] text-[#71717a]">{children}</div>
);

// ---------- Badge ----------
type Tone = "gray" | "pink" | "green" | "amber" | "blue" | "red" | "cream" | "matcha" | "butter";
const toneClass: Record<Tone, string> = {
  gray: "bg-[#f4f4f5] text-[#52525b]", cream: "bg-[#f4f4f5] text-[#52525b]",
  pink: "bg-[#fff0f6] text-[#db2777]", green: "bg-[#ecfdf3] text-[#15803d]", matcha: "bg-[#ecfdf3] text-[#15803d]",
  amber: "bg-[#fffbeb] text-[#b45309]", butter: "bg-[#fffbeb] text-[#b45309]",
  blue: "bg-[#eff6ff] text-[#1d4ed8]", red: "bg-[#fef2f2] text-[#dc2626]",
};
export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cx("inline-flex h-[22px] items-center rounded-full px-2 text-[12px] font-medium", toneClass[tone])}>{children}</span>;
}

// ---------- Nút sắp xếp ----------
export function SortButtons({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  const cls = "grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b] disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex gap-0.5">
      <button type="button" className={cls} disabled={first} onClick={onUp} aria-label="Lên"><ArrowUp size={16} /></button>
      <button type="button" className={cls} disabled={last} onClick={onDown} aria-label="Xuống"><ArrowDown size={16} /></button>
    </div>
  );
}

// ---------- Ô chọn ảnh: tải lên Storage và trả về link ----------
export function ImageInput({ value, onChange, folder, label = "Ảnh", allowSvg = false, removeLabel = "Bỏ ảnh" }: { value: string | null; onChange: (url: string | null) => void; folder: string; label?: string; allowSvg?: boolean; removeLabel?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-[#18181b]">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-dashed border-[#d4d4d8] bg-[#fafafa]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={16} className="text-[#a1a1aa]" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <label className={cx(btnClass("secondary", "sm"), "cursor-pointer")}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? "Đang tải..." : value ? "Đổi ảnh" : "Chọn ảnh"}
            <input type="file" accept="image/*" className="sr-only" disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                setErr("");
                try {
                  onChange(await uploadPublicImage(f, folder, 15, allowSvg));
                } catch (x) {
                  setErr(x instanceof Error ? x.message : "Lỗi tải ảnh");
                }
                setBusy(false);
              }} />
          </label>
          {value && (
            <button type="button" className="text-[12px] text-[#dc2626] hover:text-[#b91c1c]" onClick={() => onChange(null)}>{removeLabel}</button>
          )}
        </div>
      </div>
      {err && <p className="mt-1.5 text-[12px] text-[#dc2626]">{err}</p>}
    </div>
  );
}

// ---------- Nhiều ảnh: tải lên nhiều file, kéo thả để sắp thứ tự, ảnh đầu = ảnh chính ----------
export function ImagesInput({ value, onChange, folder, label = "Ảnh", hint }: { value: string[]; onChange: (urls: string[]) => void; folder: string; label?: string; hint?: string }) {
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  async function add(list: File[]) {
    if (!list.length) return;
    setErr("");
    setBusy(list.length);
    const urls: string[] = [];
    for (const f of list) {
      try { urls.push(await uploadPublicImage(f, folder, 15)); } catch (x) { setErr(x instanceof Error ? x.message : "Lỗi tải ảnh"); }
      setBusy((n) => n - 1);
    }
    onChange([...value, ...urls]);
  }
  function drop(to: number) {
    if (drag === null || drag === to) return;
    const next = [...value];
    const [x] = next.splice(drag, 1);
    next.splice(to, 0, x);
    onChange(next);
  }

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-[#18181b]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {value.map((u, i) => (
          <div key={u + i} draggable
            onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDrop={(e) => { e.preventDefault(); drop(i); setDrag(null); setOver(null); }}
            className={cx("group relative h-20 w-20 cursor-grab overflow-hidden rounded-[8px] border bg-[#fafafa] active:cursor-grabbing",
              over === i && drag !== i ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7]", drag === i && "opacity-40")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="pointer-events-none h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-1 left-1 rounded-[4px] bg-[#ff5fa2] px-1 text-[10px] font-medium text-white">Ảnh chính</span>}
            <button type="button" aria-label="Xoá ảnh" onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><X size={12} /></button>
          </div>
        ))}
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-[8px] border border-dashed border-[#d4d4d8] bg-[#fafafa] text-[#71717a] hover:border-[#ff5fa2] hover:text-[#ff5fa2]">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          <input type="file" multiple accept="image/*" className="sr-only" disabled={busy > 0}
            onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; add(f); }} />
        </label>
      </div>
      {hint && <p className="mt-1.5 text-[12px] text-[#71717a]">{hint}</p>}
      {err && <p className="mt-1.5 text-[12px] text-[#dc2626]">{err}</p>}
    </div>
  );
}

// =====================================================================
// Toast (góc dưới phải) + Modal xác nhận — gọi được từ bất kỳ đâu
// =====================================================================
type ToastItem = { id: number; type: "ok" | "err"; text: string; action?: { label: string; href: string } };
let toasts: ToastItem[] = [];
const toastSubs = new Set<() => void>();
const emitToasts = () => toastSubs.forEach((f) => f());
export function toast(text: string, type: "ok" | "err" = "ok", action?: { label: string; href: string }) {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, type, text: text.replace(/^✓\s*/, ""), action }];
  emitToasts();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emitToasts(); }, type === "err" ? 6000 : 3000);
}

// Giữ API cũ: <Message msg={...} /> → hiện toast mỗi khi msg đổi
const shown = new WeakSet<object>();
export function Message({ msg }: { msg: { type: "ok" | "err"; text: string } | null }) {
  useEffect(() => {
    if (msg && !shown.has(msg)) { shown.add(msg); toast(msg.text, msg.type); }
  }, [msg]);
  return null;
}

/** (tên cũ) hỏi xác nhận — dùng bộ hộp thoại chung components/ui/dialog */
export function confirmDialog(text: string, opts: { title?: string; ok?: string; danger?: boolean } = {}) {
  return dlgConfirm({ title: opts.title ?? "Xác nhận", message: text, confirmText: opts.ok ?? "Xoá", danger: opts.danger ?? true });
}

const sub = (set: Set<() => void>) => (f: () => void) => { set.add(f); return () => { set.delete(f); }; };
const subToasts = sub(toastSubs);

export function AdminOverlays() {
  const list = useSyncExternalStore(subToasts, () => toasts, () => toasts);
  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
        {list.map((t) => (
          <div key={t.id} role="status"
            className="pointer-events-auto flex items-start gap-2.5 rounded-[10px] border border-[#e5e5e7] bg-white px-3.5 py-3 text-[14px] text-[#18181b] shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
            {t.type === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#16a34a]" /> : <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#dc2626]" />}
            <span className="min-w-0 flex-1 break-words">{t.text}</span>
            {t.action && <Link href={t.action.href} className="shrink-0 text-[13px] font-semibold text-[#ff5fa2] hover:text-[#e0468a]">{t.action.label}</Link>}
            <button className="text-[#a1a1aa] hover:text-[#18181b]" aria-label="Đóng"
              onClick={() => { toasts = toasts.filter((x) => x.id !== t.id); emitToasts(); }}><X size={16} /></button>
          </div>
        ))}
      </div>
      <DialogHost />
    </>
  );
}

// ---------- Thanh "Lưu thay đổi" cố định ở đáy ----------
export function SaveBar({ show, saving, onSave, onReset, label = "Bạn có thay đổi chưa lưu" }: {
  show: boolean; saving?: boolean; onSave?: () => void; onReset?: () => void; label?: string;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e7] bg-white/95 backdrop-blur md:left-[var(--admin-sb,240px)]">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 md:px-8">
        <p className="text-[13px] text-[#71717a]">{label}</p>
        <div className="flex gap-2">
          {onReset && <Button variant="secondary" onClick={onReset} disabled={saving}>Huỷ thay đổi</Button>}
          <Button type={onSave ? "button" : "submit"} onClick={onSave} loading={saving}>Lưu thay đổi</Button>
        </div>
      </div>
    </div>
  );
}
