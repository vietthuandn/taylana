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

export function BgPicker({ value, onChange, shop }: { value: BgChoice; onChange: (b: BgChoice) => void; shop: MockupBackground[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [mine, setMine] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [err, setErr] = useState("");
  const on = (k: string) => (value.kind === "gradient" ? value.g.id === k : value.name === k);
  const sw = (active: boolean) => cx("relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] border bg-white", active ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-[12px] text-[#71717a]">Gradient</span>
        {GRADIENTS.map((g, i) => (
          <button key={g.id} type="button" title={g.name} aria-label={g.name} className={sw(on(g.id))} onClick={() => onChange({ kind: "gradient", g })}><GradThumb i={i} /></button>
        ))}
      </div>
      {shop.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-[12px] text-[#71717a]">Của tiệm</span>
          {shop.map((b) => (
            <button key={b.id} type="button" title={b.name} aria-label={b.name} className={sw(on(`shop:${b.id}`))}
              onClick={async () => { try { setErr(""); onChange({ kind: "image", img: await loadImg(b.url), name: `shop:${b.id}` }); } catch { setErr(`Không tải được nền "${b.name}".`); } }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proxied(b.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-[12px] text-[#71717a]">Của bạn</span>
        {mine && (
          <button type="button" className={sw(on("mine"))} onClick={() => onChange({ kind: "image", img: mine.img, name: "mine" })} aria-label="Nền của bạn">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mine.url} alt="" className="h-full w-full object-cover" />
          </button>
        )}
        <button type="button" onClick={() => input.current?.click()} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-dashed border-[#d4d4d8] bg-white px-3 text-[13px] text-[#3f3f46] hover:border-[#ff5fa2] hover:text-[#ff5fa2]">
          <ImagePlus size={16} /> Tải nền của bạn
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          const url = URL.createObjectURL(f); // chỉ dùng trên máy, không lưu lại
          try { const img = await loadImg(url); setMine({ url, img }); onChange({ kind: "image", img, name: "mine" }); setErr(""); }
          catch { setErr("Không đọc được ảnh nền."); }
        }} />
      </div>
      {err && <p className="text-[12px] text-[#dc2626]">{err}</p>}
    </div>
  );
}
