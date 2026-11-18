"use client";

/* Bộ chọn nền dùng chung (CD Mockup + Booklet Mockup): gradient có sẵn · nền của tiệm (link) · "Tải nền của bạn" (chỉ trên máy). */
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { GRADIENTS, drawGradient, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg, proxied } from "@/lib/mockup/images";
import type { MockupBackground } from "@/lib/mockup/types";
import { cx } from "@/components/ui/styles";

function GradThumb({ i }: { i: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (c) drawGradient(c.getContext("2d")!, 64, 64, GRADIENTS[i], 0.07); }, [i]);
  return <canvas ref={ref} width={64} height={64} className="h-full w-full" />;
}

export function BgPicker({ value, onChange, shop, className }: { value: BgChoice; onChange: (b: BgChoice) => void; shop: MockupBackground[]; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [mine, setMine] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [err, setErr] = useState("");
  const on = (k: string) => (value.kind === "gradient" ? value.g.id === k : value.name === k);
  const sw = (active: boolean) => cx("relative h-8 w-8 shrink-0 overflow-hidden rounded-[8px] border bg-white", active ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]");

  // 1 hàng duy nhất: gradient → nền của tiệm → nền của bạn → ô cuối là nút tải ảnh lên
  return (
    <div className={cx("min-w-0", className)}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[13px] font-semibold text-[#18181b]">Nền</span>
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 pl-1">
          {GRADIENTS.map((g, i) => (
            <button key={g.id} type="button" title={g.name} aria-label={g.name} className={sw(on(g.id))} onClick={() => onChange({ kind: "gradient", g })}><GradThumb i={i} /></button>
          ))}
          {shop.map((b) => (
            <button key={b.id} type="button" title={b.name} aria-label={b.name} className={sw(on(`shop:${b.id}`))}
              onClick={async () => { try { setErr(""); onChange({ kind: "image", img: await loadImg(b.url), name: `shop:${b.id}` }); } catch { setErr(`Không tải được nền "${b.name}".`); } }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proxied(b.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
          {mine && (
            <button type="button" title="Nền của bạn" aria-label="Nền của bạn" className={sw(on("mine"))} onClick={() => onChange({ kind: "image", img: mine.img, name: "mine" })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mine.url} alt="" className="h-full w-full object-cover" />
            </button>
          )}
          <button type="button" onClick={() => input.current?.click()} title="Tải nền của bạn" aria-label="Tải nền của bạn"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-dashed border-[#d4d4d8] bg-white text-[#71717a] hover:border-[#ff5fa2] hover:text-[#ff5fa2]">
            <ImagePlus size={15} />
          </button>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          const url = URL.createObjectURL(f); // chỉ dùng trên máy, không lưu lại
          try { const img = await loadImg(url); setMine({ url, img }); onChange({ kind: "image", img, name: "mine" }); setErr(""); }
          catch { setErr("Không đọc được ảnh nền."); }
        }} />
      </div>
      {err && <p className="mt-1 text-[12px] text-[#dc2626]">{err}</p>}
    </div>
  );
}
