"use client";

/* Panel phải "CD Mockup": ảnh căn giữa tuyệt đối · cột mẫu bên phải (+ thẻ "3D" cố định ở cuối) · thanh đáy: Nền + Tải về.
   Kéo để di chuyển, +/− phóng to, nhấp đúp về mặc định. Thẻ 3D: cảnh three.js, chỉ tải thư viện khi được chọn. */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Download, Files, Image as ImageIcon, Minus, Plus } from "lucide-react";
import { paintBackground, bgRatio, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg, proxied } from "@/lib/mockup/images";
import { composeScene, renderFrame, type SourceImage } from "@/lib/mockup/render";
import type { MockupFrame, RegionType, TrayStyle } from "@/lib/mockup/types";
import type { Cd3DHandle, Cd3DImages } from "./Cd3D";
import { can3D } from "./can3d";
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
// Cảnh 3D: chỉ tải three / @react-three khi khách chọn thẻ 3D
const Cd3D = dynamic(() => import("./Cd3D"), { ssr: false, loading: () => <p className="absolute inset-0 grid place-items-center text-[13px] text-[#71717a]">Đang tải 3D...</p> });
const THREE_D = -1;
const ratioOf = (bg: BgChoice) => bgRatio(bg);

const toJpeg = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), "image/jpeg", 0.92));

export function CdMockupTab({ frames, images, images3d, tray, finish, modelUrl, watermark = false, bg, bgPicker }: {
  frames: MockupFrame[]; images: Partial<Record<RegionType, SourceImage>>; images3d: Cd3DImages; tray: TrayStyle; finish?: "matte" | "gloss"; modelUrl?: string | null; watermark?: boolean;
  bg: BgChoice; bgPicker: React.ReactNode;
}) {
  const [idx, setIdx] = useState(frames.length ? 0 : THREE_D);
  const three = useRef<Cd3DHandle | null>(null);
  const is3d = idx === THREE_D;
  const [pos, setPos] = useState<Pos>(DEFAULT_POS);
  const [built, setBuilt] = useState<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; p: Pos } | null>(null);
  const frame = is3d ? undefined : frames[idx] ?? frames[0];

  // đổi gói → danh sách mẫu đổi: về mẫu đầu, không có mẫu 2D thì tự chọn 3D
  useEffect(() => { setIdx((i) => (i === THREE_D || !frames.length ? THREE_D : 0)); }, [frames]);
  // không xem được 3D → báo và quay về mẫu 2D đầu tiên
  useEffect(() => {
    if (is3d && !can3D()) { toast("Thiết bị không hỗ trợ xem 3D", "err"); if (frames.length) setIdx(0); }
  }, [is3d, frames.length]);
  // nền 3D: vẽ nền đang chọn thành ảnh CSS phía sau canvas trong suốt
  const [bgUrl, setBgUrl] = useState("");
  useEffect(() => {
    if (!is3d) return;
    const c = document.createElement("canvas"); c.width = 1400; c.height = Math.round(1400 * ratioOf(bg));
    paintBackground(c.getContext("2d")!, c.width, c.height, bg);
    setBgUrl(c.toDataURL("image/jpeg", 0.88));
  }, [is3d, bg]);
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

  async function download3d() {
    const shot = three.current?.capture(2400);
    if (!shot) return toast("Chưa dựng xong cảnh 3D", "err");
    const out = document.createElement("canvas");
    const k = 2400 / Math.max(shot.width, shot.height);
    out.width = Math.round(shot.width * k); out.height = Math.round(shot.height * k);
    const x = out.getContext("2d")!;
    paintBackground(x, out.width, out.height, bg);
    x.drawImage(shot, 0, 0, out.width, out.height);
    if (watermark) {
      x.font = `600 ${Math.round(out.width * 0.018)}px Inter, system-ui, sans-serif`;
      x.fillStyle = "rgba(24,24,27,0.35)"; x.textAlign = "right"; x.textBaseline = "bottom";
      x.fillText("Taylana", out.width * 0.975, out.height - out.width * 0.025);
    }
    try { saveBlob(await toJpeg(out), "Mockup-3D.jpg"); toast("Đã tải xuống"); } catch { toast("Xuất ảnh thất bại", "err"); }
  }
  const zoom = (d: number) => setPos((p) => ({ ...p, scale: Math.round(Math.min(1.5, Math.max(0.5, p.scale + d)) * 10) / 10 }));
  const menu = (
    <DownloadMenu busy={busy} up items={is3d ? [{ label: "Tải ảnh góc nhìn này", icon: <Download size={16} />, onClick: download3d }] : [
      { label: "Tải ảnh này (JPG)", icon: <Download size={16} />, onClick: downloadOne },
      ...(frames.length > 1 ? [{ label: "Tải tất cả mẫu (.zip)", icon: <Files size={16} />, onClick: downloadAll }] : []),
      { label: "Tải PNG nền trong suốt", icon: <ImageIcon size={16} />, onClick: downloadPng },
    ]} />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:block">
      {/* ảnh mockup: căn giữa tuyệt đối trong panel (chừa đều 2 bên cho cột mẫu và thanh đáy) */}
      <div ref={area} className="relative flex min-h-[240px] flex-1 items-center justify-center p-3 md:absolute md:inset-x-[72px] md:inset-y-[64px] md:min-h-0 md:p-0">
        {is3d ? (
          <div className="relative overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white bg-cover bg-center"
            style={{ width: width || "100%", aspectRatio: `1 / ${ratio}`, backgroundImage: bgUrl ? `url(${bgUrl})` : undefined }}>
            <Cd3D images={images3d} tray={tray} finish={finish} modelUrl={modelUrl} handle={three} />
          </div>
        ) : !frame ? null : (
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

      {/* Mẫu: cột thumbnail dọc ở mép phải, căn giữa dọc, nằm đè vùng trống · thẻ "3D" cố định ở cuối */}
      <div className="no-scrollbar flex gap-2 overflow-auto px-3 md:absolute md:right-3 md:top-1/2 md:max-h-[calc(100%-128px)] md:-translate-y-1/2 md:flex-col md:px-0">
        {frames.map((f, i) => (
          <button key={f.id} type="button" onClick={() => setIdx(i)} title={f.name}
            className={cx("h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border bg-[#f4f4f5]", !is3d && f.id === frame?.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proxied(f.image_url)} alt={f.name} className="h-full w-full object-contain" loading="lazy" />
          </button>
        ))}
        <button type="button" onClick={() => setIdx(THREE_D)} title="Hộp CD 3D" aria-label="Hộp CD 3D"
          className={cx("relative grid h-12 w-12 shrink-0 place-items-center rounded-[8px] border bg-white text-[#52525b]", is3d ? "border-[#ff5fa2] text-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
          <Box size={20} />
          <span className="absolute bottom-0.5 right-1 text-[9px] font-bold leading-none">3D</span>
        </button>
      </div>

      {/* thanh đáy: trái Nền · phải Tải về */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4 md:absolute md:inset-x-0 md:bottom-0">
        <div className="min-w-0 flex-1">{bgPicker}</div>
        <div className="shrink-0">{menu}</div>
      </div>
    </div>
  );
}
