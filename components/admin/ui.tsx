"use client";

import { useState } from "react";
import { uploadPublicImage } from "@/lib/upload";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm">
      <span className={`relative h-7 w-12 rounded-full border-2 border-ink-900 transition ${checked ? "bg-lime-500" : "bg-ink-100"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink-900 bg-white transition-all ${checked ? "left-5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

// Ô chọn ảnh: tải lên Storage và trả về link
export function ImageInput({ value, onChange, folder, label = "Ảnh" }: { value: string | null; onChange: (url: string | null) => void; folder: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-ink-300 bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-ink-500">Chưa có</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="btn cursor-pointer btn-ghost btn-sm">
            {busy ? "Đang tải..." : value ? "Đổi ảnh" : "Chọn ảnh"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                setErr("");
                try {
                  onChange(await uploadPublicImage(f, folder));
                } catch (x) {
                  setErr(x instanceof Error ? x.message : "Lỗi tải ảnh");
                }
                setBusy(false);
              }} />
          </label>
          {value && (
            <button type="button" className="text-left text-xs text-hot-500 underline" onClick={() => onChange(null)}>Bỏ ảnh</button>
          )}
        </div>
      </div>
      {err && <p className="mt-1 text-xs text-hot-500">{err}</p>}
    </div>
  );
}

export function SortButtons({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  const cls = "grid h-8 w-8 place-items-center rounded-full border-2 border-ink-900 bg-white disabled:opacity-30";
  return (
    <div className="flex gap-1">
      <button type="button" className={cls} disabled={first} onClick={onUp} aria-label="Lên">↑</button>
      <button type="button" className={cls} disabled={last} onClick={onDown} aria-label="Xuống">↓</button>
    </div>
  );
}

export function Badge({ children, tone = "cream" }: { children: React.ReactNode; tone?: "cream" | "pink" | "matcha" | "butter" }) {
  const map = { cream: "bg-cream-200", pink: "bg-hot-100", matcha: "bg-lime-300", butter: "bg-lime-300" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}

export function Message({ msg }: { msg: { type: "ok" | "err"; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`rounded-xl px-3 py-2 text-sm ${msg.type === "ok" ? "bg-lime-100 text-lime-700" : "bg-hot-100 text-hot-500"}`}>
      {msg.text}
    </p>
  );
}
