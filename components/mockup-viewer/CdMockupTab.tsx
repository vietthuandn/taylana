"use client";

/* Panel phải "CD Mockup": ảnh căn giữa tuyệt đối · cột mẫu bên phải · thanh đáy: Nền + Tải về. Kéo để di chuyển, +/− phóng to, nhấp đúp về mặc định. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Files, Image as ImageIcon, Minus, Package, Plus } from "lucide-react";
import { paintBackground, bgRatio, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg, proxied } from "@/lib/mockup/images";
import { composeScene, renderFrame, type SourceImage } from "@/lib/mockup/render";
import type { MockupFrame, RegionType } from "@/lib/mockup/types";
import { saveBlob, saveZip } from "@/lib/imageTools";
import { toast } from "@/components/ui/kit";
import { DownloadMenu } from "./DownloadMenu";
import { useFitBox } from "./useFitBox";
import { cx } from "@/components/ui/styles";

type Pos = { x: number; y: number; scale: number }; // scale = mức phóng 0.5 – 1.5 (1 = 100%)
const BASE = 0.96; // 100% = khung chiếm ~96% chiều cao nền
const DEFAULT_POS: Pos = { x: 0.5, y: 0.5, scale: 1 };
const scene = (p: Pos) => ({ ...p, scale: p.scale * BASE });

async function buildFrame(f: MockupFrame, images: Partial<Record<RegionType, SourceImage>>, maxW: number) {
  const frame = await loadImg(f.image_url);
  const masks: Record<string, HTMLImageElement> = {};
  for (const r of f.regions) if (r.mask_url && !masks[r.mask_url]) masks[r.mask_url] = await loadImg(r.mask_url).catch(() => undefined as unknown as HTMLImageElement);
  return renderFrame({ frame, regions: f.regions, images, masks, glass: f.glass, maxW });
}
const toJpeg = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), "image/jpeg", 0.92));

export function CdMockupTab({ frames, images, bg, bgPicker, hidePicker }: {
  frames: MockupFrame[]; images: Partial<Record<RegionType, SourceImage>>; bg: BgChoice; bgPicker: React.ReactNode; hidePicker?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState<Pos>(DEFAULT_POS);
  const [built, setBuilt] = useState<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; p: Pos } | null>(null);
  const frame = frames[idx] ?? frames[0];
  const ratio = bgRatio(bg);
  const { area, width } = useFitBox(ratio);
  const vw = width || 800;

  // dựng lại khung khi đổi mẫu / ảnh (xem trước tối đa 1600px)
  useEffect(() => {
    if (!frame) return;
    let off = false;
    setErr("");
    buildFrame(frame, images, 1600).then((c) => { if (!off) setBuilt(c); }).catch(() => { if (!off) setErr("Không tải được ảnh khung mockup."); });
    return () => { off = true; };
  }, [frame, images]);

  // vẽ cảnh: nền + khung
  const W = useMemo(() => Math.min(1600, Math.round(vw * (typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1))), [vw]);
  useEffect(() => {
    const c = view.current;
    if (!c) return;
    c.width = W; c.height = Math.round(W * ratio);
    composeScene(c, (ctx, w, h) => paintBackground(ctx, w, h, bg), built, scene(pos), false);
  }, [W, ratio, bg, built, pos]);

  async function exportFrame(f: MockupFrame) {
    const EW = 2400, EH = Math.round(2400 * ratio);
    const fr = await loadImg(f.image_url);
    const need = Math.ceil(EH * scene(pos).scale * (fr.width / fr.height));
    const c = await buildFrame(f, images, Math.min(fr.width, Math.max(need, 800)));
    const out = document.createElement("canvas");
    out.width = EW; out.height = EH;
    composeScene(out, (ctx, w, h) => paintBackground(ctx, w, h, bg), c, scene(pos), false);
    return toJpeg(out);
  }
  async function downloadOne() {
    if (!frame) return;
    setBusy(true);
    try { saveBlob(await exportFrame(frame), `Mockup-${frame.name.replace(/[^\w-]+/g, "-")}.jpg`); toast("Đã tải xuống"); }
    catch (e) { toast(e instanceof Error ? e.message : "Xuất ảnh thất bại", "err"); }
    setBusy(false);
  }
  // PNG nền trong suốt: chỉ khung mockup (không nền), giữ kích thước gốc của khung
  async function downloadPng() {
    if (!frame) return;
    setBusy(true);
    try {
      const fr = await loadImg(frame.image_url);
      const c = await buildFrame(frame, images, Math.min(fr.width, 3000));
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) throw new Error("Xuất ảnh thất bại");
      saveBlob(blob, `Mockup-${frame.name.replace(/[^\w-]+/g, "-")}.png`); toast("Đã tải xuống");
    } catch (e) { toast(e instanceof Error ? e.message : "Xuất ảnh thất bại", "err"); }
    setBusy(false);
  }
  async function downloadAll() {
    setBusy(true);
    try {
      const files = [];
      for (const [i, f] of frames.entries()) files.push({ name: `Mockup-${i + 1}-${f.name.replace(/[^\w-]+/g, "-")}.jpg`, blob: await exportFrame(f) });
      await saveZip(files, "Taylana-Mockup.zip");
      toast("Đã tải xuống");
    } catch (e) { toast(e instanceof Error ? e.message : "Xuất ảnh thất bại", "err"); }
    setBusy(false);
  }

  const zoom = (d: number) => setPos((p) => ({ ...p, scale: Math.round(Math.min(1.5, Math.max(0.5, p.scale + d)) * 10) / 10 }));
  const menu = (
    <DownloadMenu busy={busy} up items={[
      { label: "Tải ảnh này (JPG)", icon: <Download size={16} />, onClick: downloadOne },
      ...(frames.length > 1 ? [{ label: "Tải tất cả mẫu (.zip)", icon: <Files size={16} />, onClick: downloadAll }] : []),
      { label: "Tải PNG nền trong suốt", icon: <ImageIcon size={16} />, onClick: downloadPng },
    ]} />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:block">
      {/* ảnh mockup: căn giữa tuyệt đối trong panel (chừa đều 2 bên cho cột mẫu và thanh đáy) */}
      <div ref={area} className="relative flex min-h-[240px] flex-1 items-center justify-center p-3 md:absolute md:inset-x-[72px] md:inset-y-[64px] md:min-h-0 md:p-0">
        {!frame ? (
          <div className="grid h-64 w-full place-items-center rounded-[12px] border border-dashed border-[#d4d4d8] bg-white text-center text-[14px] text-[#71717a]"><span><Package size={24} className="mx-auto mb-2" />Tiệm chưa có mẫu khung CD.</span></div>
        ) : (
          <div className="group relative overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white" style={{ width: width || "100%" }}>
            <canvas ref={view} className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
              onDoubleClick={() => setPos(DEFAULT_POS)}
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, p: pos }; }}
              onPointerMove={(e) => {
                const d = drag.current, el = view.current;
                if (!d || !el) return;
                const r = el.getBoundingClientRect();
                setPos({ ...d.p, x: d.p.x + (e.clientX - d.x) / r.width, y: d.p.y + (e.clientY - d.y) / r.height });
              }}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
            {/* hover: +/− phóng to / thu nhỏ khung CD (50% – 150%) */}
            <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => zoom(-0.1)} disabled={pos.scale <= 0.5} aria-label="Thu nhỏ" title="Thu nhỏ"
                className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#18181b] shadow-[0_1px_4px_rgba(0,0,0,0.18)] disabled:opacity-40"><Minus size={14} /></button>
              <button type="button" onClick={() => zoom(0.1)} disabled={pos.scale >= 1.5} aria-label="Phóng to" title="Phóng to"
                className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#18181b] shadow-[0_1px_4px_rgba(0,0,0,0.18)] disabled:opacity-40"><Plus size={14} /></button>
            </div>
            {!built && !err && <p className="absolute inset-0 grid place-items-center text-[13px] text-[#71717a]">Đang dựng mockup...</p>}
            {err && <p className="absolute inset-x-0 top-2 text-center text-[13px] text-[#dc2626]">{err}</p>}
          </div>
        )}
      </div>

      {/* Mẫu: cột thumbnail dọc ở mép phải, căn giữa dọc, nằm đè vùng trống */}
      {!hidePicker && frames.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-auto px-3 md:absolute md:right-3 md:top-1/2 md:max-h-[calc(100%-128px)] md:-translate-y-1/2 md:flex-col md:px-0">
          {frames.map((f, i) => (
            <button key={f.id} type="button" onClick={() => setIdx(i)} title={f.name}
              className={cx("h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border bg-[#f4f4f5]", f.id === frame?.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proxied(f.image_url)} alt={f.name} className="h-full w-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* thanh đáy: trái Nền · phải Tải về */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4 md:absolute md:inset-x-0 md:bottom-0">
        <div className="min-w-0 flex-1">{bgPicker}</div>
        <div className="shrink-0">{menu}</div>
      </div>
    </div>
  );
}
