import type { Slot } from "@/lib/templates";

// Ảnh thu nhỏ của mẫu (vẽ bằng HTML): nền + các ô ảnh + khung overlay
export function TemplateThumb({ ratio, slots, overlay, background, bgColor = "#fff", disc }: {
  ratio: number; slots: Slot[]; overlay?: string | null; background?: string | null; bgColor?: string; disc?: boolean;
}) {
  return (
    <div className={`relative w-full overflow-hidden ${disc ? "rounded-full" : "rounded-md"}`}
      style={{ aspectRatio: ratio, background: background ? `center/cover url(${background})` : bgColor }}>
      {slots.map((s) => (
        <div key={s.id} className={`absolute bg-cocoa-300/50 ${s.shape === "circle" ? "rounded-full" : ""}`}
          style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%`, transform: `rotate(${s.rotation ?? 0}deg)` }} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {overlay && <img src={overlay} alt="" className="absolute inset-0 h-full w-full" loading="lazy" />}
      {disc && <div className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream-100 ring-1 ring-cocoa-400" />}
    </div>
  );
}
