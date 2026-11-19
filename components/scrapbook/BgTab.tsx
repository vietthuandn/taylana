"use client";

/* Scrapbook → tab "Nền" (khách + admin): màu nền (màu có sẵn + chọn màu riêng), texture giấy từ thư viện
   (nhóm "Texture nền giấy", có ảnh xem trước), ảnh nền tải lên (phủ kín bề mặt, đĩa tự cắt tròn; độ mờ + xoá).
   Cặp trang booklet: áp cho cả cặp, trang trái hoặc trang phải. */
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { ScrapAsset, Template } from "@/lib/scrapbook/types";
import { cx } from "@/components/ui/styles";

const COLORS = ["#ffffff", "#fbf3e6", "#fdf6e3", "#fde7ea", "#fbcfe8", "#e9f3ee", "#c7f0db", "#e7f6fb", "#cfe8fb", "#ece7ff", "#ddd6fe", "#fff1e6", "#fef3a8", "#f4f1ea", "#efe3cf", "#e4e4e7", "#3f3f46", "#18181b"];
const PATTERNS: [Template["bg"]["pattern"], string][] = [["plain", "Trơn"], ["dots", "Chấm"], ["grid", "Ô kẻ"], ["lines", "Dòng kẻ"]];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";

export function BgTab({ t, assets, bgImages, onSet, onUpload }: {
  t: Template | null; assets: ScrapAsset[]; bgImages: Record<string, { src?: string } | undefined>;
  onSet: (scope: "all" | "left" | "right", v: Partial<Template["bg"]>) => void; onUpload: (f: File) => Promise<string>;
}) {
  const [scope, setScope] = useState<"all" | "left" | "right">("all");
  const [busy, setBusy] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  if (!t) return <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">Chọn mẫu trước khi đổi nền.</p>;
  const spread = t.surface === "spread";
  const sc = spread ? scope : "all";
  const bg = sc === "right" ? t.bg2 ?? t.bg : t.bg;
  const textures = assets.filter((a) => a.is_active && a.grp === "texture");
  const set = (v: Partial<Template["bg"]>) => onSet(sc, v);
  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[12px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  const preview = bg.image ? bgImages[bg.image]?.src : undefined;
  return (
    <div className="space-y-5">
      {spread && (
        <div className="flex flex-wrap gap-1.5">
          {([["all", "Cả cặp trang"], ["left", "Trang trái"], ["right", "Trang phải"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setScope(k)} className={chip(scope === k)}>{l}</button>)}
        </div>
      )}
      <section>
        <p className="mb-2 text-[13px] font-semibold">Màu nền</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {COLORS.map((c) => <button key={c} type="button" onClick={() => set({ color: c })} aria-label={c} className={cx("h-7 w-7 rounded-full border-2", bg.color.toLowerCase() === c ? "border-[#ff5fa2]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: c }} />)}
          <label className="relative grid h-7 w-7 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-[#a1a1aa] text-[14px] text-[#52525b] hover:border-[#ff5fa2]" title="Chọn màu riêng">
            +<input type="color" value={bg.color} onChange={(e) => set({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Chọn màu riêng" />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PATTERNS.map(([k, l]) => <button key={k} type="button" onClick={() => set({ pattern: k })} className={chip(bg.pattern === k)}>{l}</button>)}
        </div>
      </section>
      <section>
        <p className="mb-2 text-[13px] font-semibold">Texture giấy</p>
        {textures.length ? (
          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => set({ asset: undefined })} className={cx("grid aspect-square place-items-center rounded-[8px] border text-[11px] text-[#71717a]", !bg.asset ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/25" : "border-[#e5e5e7]")}>Không</button>
            {textures.map((a) => (
              <button key={a.id} type="button" title={a.name} onClick={() => set({ asset: a.id })} className={cx("aspect-square overflow-hidden rounded-[8px] border", bg.asset === a.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/25" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        ) : <p className="text-[12px] text-[#a1a1aa]">Thư viện chưa có texture nền giấy.</p>}
      </section>
      <section>
        <p className="mb-2 text-[13px] font-semibold">Ảnh nền</p>
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => fileIn.current?.click()} disabled={busy} className={cx("grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] text-[12px] text-[#52525b] hover:border-[#ff5fa2]", checker)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="grid place-items-center gap-1"><ImagePlus size={18} />{busy ? "Đang tải..." : "Tải ảnh"}</span>}
          </button>
          {bg.image && (
            <div className="min-w-0 flex-1 space-y-2">
              <label className="block text-[12px] text-[#52525b]">
                <span className="flex justify-between">Độ mờ<span className="tabular-nums">{Math.round((bg.imageOpacity ?? 1) * 100)}%</span></span>
                <input type="range" min={10} max={100} step={5} value={Math.round((bg.imageOpacity ?? 1) * 100)} onChange={(e) => set({ imageOpacity: Number(e.target.value) / 100 })} className="w-full accent-[#ff5fa2]" />
              </label>
              <button type="button" onClick={() => set({ image: undefined, imageOpacity: undefined })} className="inline-flex items-center gap-1 text-[12px] text-[#dc2626]"><Trash2 size={12} /> Xoá ảnh nền</button>
            </div>
          )}
        </div>
        <p className="mt-1 text-[11px] text-[#a1a1aa]">Ảnh phủ kín bề mặt{spread ? "" : " (mặt đĩa tự cắt tròn)"}.</p>
        <input ref={fileIn} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          setBusy(true);
          try { set({ image: await onUpload(f), imageOpacity: bg.imageOpacity ?? 1 }); } catch { /* lỗi tải ảnh */ }
          setBusy(false);
        }} />
      </section>
    </div>
  );
}
