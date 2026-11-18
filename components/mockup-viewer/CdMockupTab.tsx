"use client";

/* Tab "CD Mockup": chọn khung (admin tạo, tối đa 5) → nền → kéo / thu phóng khung trên nền → tải JPG. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Download, Files, Image as ImageIcon, Package } from "lucide-react";
import { paintBackground, bgRatio, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg, proxied } from "@/lib/mockup/images";
import { composeScene, renderFrame, type SourceImage } from "@/lib/mockup/render";
import type { MockupFrame, RegionType } from "@/lib/mockup/types";
import { saveBlob, saveZip } from "@/lib/imageTools";
import { Button, toast } from "@/components/ui/kit";
import { DownloadMenu } from "./DownloadMenu";
import { cx } from "@/components/ui/styles";

type Pos = { x: number; y: number; scale: number };
const DEFAULT_POS: Pos = { x: 0.5, y: 0.5, scale: 0.96 }; // khung chiếm ~96% chiều cao nền

async function buildFrame(f: MockupFrame, images: Partial<Record<RegionType, SourceImage>>, maxW: number) {
  const frame = await loadImg(f.image_url);
  const masks: Record<string, HTMLImageElement> = {};
  for (const r of f.regions) if (r.mask_url && !masks[r.mask_url]) masks[r.mask_url] = await loadImg(r.mask_url).catch(() => undefined as unknown as HTMLImageElement);
  return renderFrame({ frame, regions: f.regions, images, masks, glass: f.glass, maxW });
}
const toJpeg = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), "image/jpeg", 0.92));

export function CdMockupTab({ frames, images, bg, bgPicker, tabs }: {
  frames: MockupFrame[]; images: Partial<Record<RegionType, SourceImage>>; bg: BgChoice; bgPicker: React.ReactNode; tabs: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState<Pos>(DEFAULT_POS);
  const [built, setBuilt] = useState<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; p: Pos } | null>(null);
  const [vw, setVw] = useState(800);
  const frame = frames[idx];
  const ratio = bgRatio(bg);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    composeScene(c, (ctx, w, h) => paintBackground(ctx, w, h, bg), built, pos, false);
  }, [W, ratio, bg, built, pos]);

  async function exportFrame(f: MockupFrame) {
    const EW = 2400, EH = Math.round(2400 * ratio);
    const fr = await loadImg(f.image_url);
    const need = Math.ceil(EH * pos.scale * (fr.width / fr.height));
    const c = await buildFrame(f, images, Math.min(fr.width, Math.max(need, 800)));
    const out = document.createElement("canvas");
    out.width = EW; out.height = EH;
    composeScene(out, (ctx, w, h) => paintBackground(ctx, w, h, bg), c, pos, false);
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

  const menu = (
    <DownloadMenu busy={busy} items={[
      { label: "Tải ảnh này (JPG)", icon: <Download size={16} />, onClick: downloadOne },
      { label: "Tải tất cả mẫu (.zip)", icon: <Files size={16} />, onClick: downloadAll },
      { label: "Tải PNG nền trong suốt", icon: <ImageIcon size={16} />, onClick: downloadPng },
    ]} />
  );

  if (!frames.length) {
    return (
      <div className="space-y-3">
        {tabs}
        <div className="grid h-64 place-items-center rounded-[12px] border border-dashed border-[#d4d4d8] bg-white text-center text-[14px] text-[#71717a]"><span><Package size={24} className="mx-auto mb-2" />Tiệm chưa có mẫu khung CD.</span></div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">{tabs}<div className="ml-auto">{menu}</div></div>
      <div className="flex items-start gap-3">
        {/* xem trước: kéo để di chuyển khung */}
        <div ref={wrap} className="relative mx-auto w-full min-w-0 overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white"
          style={{ maxWidth: `min(820px, max(260px, calc((100dvh - var(--header-h) - 140px) / ${ratio})))` }}>
          <canvas ref={view} className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, p: pos }; }}
            onPointerMove={(e) => {
              const d = drag.current, el = view.current;
              if (!d || !el) return;
              const r = el.getBoundingClientRect();
              setPos({ ...d.p, x: d.p.x + (e.clientX - d.x) / r.width, y: d.p.y + (e.clientY - d.y) / r.height });
            }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
          {!built && !err && <p className="absolute inset-0 grid place-items-center text-[13px] text-[#71717a]">Đang dựng mockup...</p>}
          {err && <p className="absolute inset-x-0 top-2 text-center text-[13px] text-[#dc2626]">{err}</p>}
        </div>
        {/* chọn mẫu khung: cột bên phải */}
        <div className="no-scrollbar flex max-h-[calc(100dvh-var(--header-h)-140px)] shrink-0 flex-col gap-2 overflow-y-auto p-0.5">
          {frames.map((f, i) => (
            <button key={f.id} type="button" onClick={() => setIdx(i)} title={f.name}
              className={cx("h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border bg-[#f4f4f5]", i === idx ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proxied(f.image_url)} alt={f.name} className="h-full w-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="range" min={0.2} max={1.4} step={0.01} value={pos.scale} onChange={(e) => setPos({ ...pos, scale: Number(e.target.value) })} className="w-28 accent-[#ff5fa2]" aria-label="Kích thước khung" title="Kích thước khung" />
        <Button variant="ghost" size="sm" icon={<Crosshair size={16} />} onClick={() => setPos({ ...pos, x: 0.5, y: 0.5 })}>Căn giữa</Button>
        {bgPicker}
      </div>
    </div>
  );
}
