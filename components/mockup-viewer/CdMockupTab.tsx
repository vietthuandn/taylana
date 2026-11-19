"use client";

/* Panel phải "CD Mockup": ảnh căn giữa tuyệt đối · cột mẫu bên phải (+ thẻ "3D" cố định ở cuối) · thanh đáy: Nền + Tải về.
   Kéo để di chuyển, +/− phóng to, nhấp đúp về mặc định. Thẻ 3D: cảnh three.js, chỉ tải thư viện khi được chọn. */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Dices, Download, Files, Image as ImageIcon, Minus, Plus } from "lucide-react";
import { paintBackground, bgRatio, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg, proxied } from "@/lib/mockup/images";
import { composeScene, renderFrame, type SourceImage } from "@/lib/mockup/render";
import type { MockupFrame, RegionType, TrayStyle } from "@/lib/mockup/types";
import type { Cd3DHandle, Cd3DImages } from "./Cd3D";
import { can3D } from "./can3d";
import { itemsOf, renderSystem, type SystemArrange, type SystemInput, type SystemItem } from "@/lib/mockup/system/compose";
import { defaultGlass } from "@/lib/mockup/types";
import { loadSprites } from "@/lib/mockup/system/sprites";
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
const SYSTEM = -2; // "Mẫu hệ thống" (Auto): tự vẽ bằng code, mặc định khi mở trang
const ARRANGE: [SystemArrange, string][] = [["grid", "Lưới"], ["stack", "Chồng"], ["single", "Một"]];
const ITEM_LABEL: Record<SystemItem, string> = { closed: "Hộp đóng", open: "Hộp mở", back: "Mặt sau", booklet: "Booklet", disc: "Đĩa" };
const ratioOf = (bg: BgChoice) => bgRatio(bg);

const toJpeg = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), "image/jpeg", 0.92));

/** trạng thái xem (lưu khi chia sẻ mockup): mẫu đang chọn (-2 Auto · -1 3D · ≥0 khung), bố cục Auto, món, seed, vị trí khung */
export type MockupView = { idx: number; arrange: SystemArrange; single: SystemItem; seed: number; pos: Pos };
export function CdMockupTab({ frames, images, images3d, system, tray, finish, modelUrl, watermark = false, bg, bgPicker, init, onView, readOnly = false, extra }: {
  frames: MockupFrame[]; images: Partial<Record<RegionType, SourceImage>>; images3d: Cd3DImages; system: SystemInput; tray: TrayStyle; finish?: "matte" | "gloss"; modelUrl?: string | null; watermark?: boolean;
  bg: BgChoice; bgPicker: React.ReactNode;
  init?: Partial<MockupView>; onView?: (v: MockupView) => void; // dựng lại đúng trạng thái đã lưu · báo trạng thái hiện tại lên trên
  readOnly?: boolean; extra?: React.ReactNode; // chỉ xem (link chia sẻ): không đổi mẫu / nền / bố cục · nút thêm cạnh "Tải về"
}) {
  const [idx, setIdx] = useState(init?.idx ?? SYSTEM);
  const three = useRef<Cd3DHandle | null>(null);
  const is3d = idx === THREE_D;
  const isSys = idx === SYSTEM;
  const [pos, setPos] = useState<Pos>(init?.pos ?? DEFAULT_POS);
  const [built, setBuilt] = useState<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; p: Pos } | null>(null);
  const frame = idx < 0 ? undefined : frames[idx] ?? frames[0];

  // đổi gói → danh sách mẫu đổi: giữ Auto / 3D; đang ở mẫu khung thì về mẫu đầu (không còn mẫu khung → Auto)
  const firstFrames = useRef(true);
  useEffect(() => { if (firstFrames.current && init) { firstFrames.current = false; return; } firstFrames.current = false; setIdx((i) => (i < 0 ? i : frames.length ? 0 : SYSTEM)); }, [frames]); // eslint-disable-line react-hooks/exhaustive-deps
  // không xem được 3D → báo và quay về mẫu 2D đầu tiên
  useEffect(() => {
    if (is3d && !can3D()) { toast("Thiết bị không hỗ trợ xem 3D", "err"); setIdx(frames.length ? 0 : SYSTEM); }
  }, [is3d, frames.length]);

  // ---------- Mẫu hệ thống ----------
  const [arrange, setArrange] = useState<SystemArrange>(init?.arrange ?? "grid");
  const [single, setSingle] = useState<SystemItem>(init?.single ?? "closed");
  const [seed, setSeed] = useState(init?.seed ?? 1);
  useEffect(() => { onView?.({ idx, arrange, single, seed, pos }); }, [idx, arrange, single, seed, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sysBusy, setSysBusy] = useState(true);
  const [thumbs, setThumbs] = useState<Partial<Record<SystemArrange, string>>>({});
  const sysView = useRef<HTMLCanvasElement>(null);
  const glass = frames[0]?.glass ?? defaultGlass; // cùng cài đặt kính với mẫu khung
  const singles = useMemo(() => itemsOf(system), [system]);
  const one = singles.includes(single) ? single : singles[0];
  const sysOpts = useMemo(() => ({ arrange, single: one, seed, tray, glass }), [arrange, one, seed, tray, glass]);
  // bản xem trước 1200px (vẽ lại khi ảnh / tuỳ chọn / nền đổi); thumbnail thẻ Auto lấy từ chính cảnh này
  useEffect(() => {
    let off = false;
    setSysBusy(true);
    const t = setTimeout(async () => {
      await loadSprites(); // ảnh hộp CD thật (tải 1 lần)
      if (off) return;
      const c = renderSystem(1200, system, sysOpts, (ctx, w, h) => paintBackground(ctx, w, h, bg));
      const v = sysView.current;
      if (v) { v.width = c.width; v.height = c.height; v.getContext("2d")!.drawImage(c, 0, 0); }
      setSysBusy(false);
      // thumbnail 3 lựa chọn (Lưới · Chồng · Một) dựng từ chính ảnh của khách → đổi theo ảnh tải lên
      const next: Partial<Record<SystemArrange, string>> = {};
      for (const [k] of ARRANGE) {
        if (off) return;
        const tc = k === arrange ? c : renderSystem(400, system, { ...sysOpts, arrange: k }, (ctx, w, h) => paintBackground(ctx, w, h, bg));
        const t = document.createElement("canvas"); t.width = t.height = 112;
        const tx = t.getContext("2d")!; tx.imageSmoothingQuality = "high"; tx.drawImage(tc, 0, 0, 112, 112);
        next[k] = t.toDataURL("image/jpeg", 0.82);
      }
      if (!off) setThumbs(next);
    }, 30);
    return () => { off = true; clearTimeout(t); };
  }, [system, sysOpts, bg, isSys]);
  // nền 3D: vẽ nền đang chọn thành ảnh CSS phía sau canvas trong suốt
  const [bgUrl, setBgUrl] = useState("");
  useEffect(() => {
    if (!is3d) return;
    const c = document.createElement("canvas"); c.width = 1400; c.height = Math.round(1400 * ratioOf(bg));
    paintBackground(c.getContext("2d")!, c.width, c.height, bg);
    setBgUrl(c.toDataURL("image/jpeg", 0.88));
  }, [is3d, bg]);
  const ratio = isSys ? 1 : bgRatio(bg); // Mẫu hệ thống: canvas vuông
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

  // Mẫu hệ thống: tải về vẽ lại ở 2400px
  async function downloadSystem(transparent: boolean) {
    setBusy(true);
    try {
      await loadSprites();
      await new Promise((r) => setTimeout(r, 20));
      const c = renderSystem(2400, system, sysOpts, transparent ? null : (ctx, w, h) => paintBackground(ctx, w, h, bg));
      if (watermark && !transparent) {
        const x = c.getContext("2d")!;
        x.font = `600 ${Math.round(c.width * 0.018)}px Inter, system-ui, sans-serif`;
        x.fillStyle = "rgba(24,24,27,0.35)"; x.textAlign = "right"; x.textBaseline = "bottom";
        x.fillText("Taylana", c.width * 0.975, c.height * 0.975);
      }
      const blob = transparent ? await new Promise<Blob | null>((r) => c.toBlob(r, "image/png")) : await toJpeg(c);
      if (!blob) throw new Error("Xuất ảnh thất bại");
      saveBlob(blob, `Mockup-Auto.${transparent ? "png" : "jpg"}`); toast("Đã tải xuống");
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
    x.drawImage(shot, 0, 0, out.width, out.height); // ảnh chụp đã gồm nền đang chọn
    if (watermark) {
      x.font = `600 ${Math.round(out.width * 0.018)}px Inter, system-ui, sans-serif`;
      x.fillStyle = "rgba(24,24,27,0.35)"; x.textAlign = "right"; x.textBaseline = "bottom";
      x.fillText("Taylana", out.width * 0.975, out.height - out.width * 0.025);
    }
    try { saveBlob(await toJpeg(out), "Mockup-3D.jpg"); toast("Đã tải xuống"); } catch { toast("Xuất ảnh thất bại", "err"); }
  }
  const zoom = (d: number) => setPos((p) => ({ ...p, scale: Math.round(Math.min(1.5, Math.max(0.5, p.scale + d)) * 10) / 10 }));
  const menu = (
    <DownloadMenu busy={busy} up items={is3d ? [{ label: "Tải ảnh góc nhìn này", icon: <Download size={16} />, onClick: download3d }] : isSys ? [
      { label: "Tải ảnh này (JPG)", icon: <Download size={16} />, onClick: () => downloadSystem(false) },
      { label: "Tải PNG nền trong suốt", icon: <ImageIcon size={16} />, onClick: () => downloadSystem(true) },
    ] : [
      { label: "Tải ảnh này (JPG)", icon: <Download size={16} />, onClick: downloadOne },
      ...(frames.length > 1 ? [{ label: "Tải tất cả mẫu (.zip)", icon: <Files size={16} />, onClick: downloadAll }] : []),
      { label: "Tải PNG nền trong suốt", icon: <ImageIcon size={16} />, onClick: downloadPng },
    ]} />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:block">
      {/* ảnh mockup: căn giữa tuyệt đối trong panel (chừa đều 2 bên cho cột mẫu và thanh đáy) */}
      <div ref={area} className={`relative flex min-h-[240px] flex-1 items-center justify-center p-3 md:absolute md:inset-x-[72px] md:min-h-0 md:p-0 ${isSys ? "md:bottom-[100px] md:top-4" : "md:inset-y-[64px]"}`}>
        {isSys ? (
          <div className="relative overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white" style={{ width: width || "100%", aspectRatio: "1 / 1" }}>
            <canvas ref={sysView} className="block h-full w-full" />
            {/* khung chờ trong lúc dựng */}
            {sysBusy && <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,#f4f4f5_30%,#fafafa_50%,#f4f4f5_70%)]" />}
          </div>
        ) : is3d ? (
          <div className="relative overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white"
            style={{ width: width || "100%", aspectRatio: `1 / ${ratio}` }}>
            <Cd3D images={images3d} tray={tray} finish={finish} modelUrl={modelUrl} bgUrl={bgUrl} handle={three} />
          </div>
        ) : !frame ? null : (
          <div className="group relative overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white" style={{ width: width || "100%" }}>
            <canvas ref={view} className={cx("block h-auto w-full touch-none", !readOnly && "cursor-grab active:cursor-grabbing")}
              onDoubleClick={() => { if (!readOnly) setPos(DEFAULT_POS); }}
              onPointerDown={(e) => { if (readOnly) return; (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, p: pos }; }}
              onPointerMove={(e) => {
                const d = drag.current, el = view.current;
                if (!d || !el) return;
                const r = el.getBoundingClientRect();
                setPos({ ...d.p, x: d.p.x + (e.clientX - d.x) / r.width, y: d.p.y + (e.clientY - d.y) / r.height });
              }}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
            {/* hover: +/− phóng to / thu nhỏ khung CD (50% – 150%) */}
            <div className={cx("absolute bottom-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100", readOnly && "hidden")}>
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
      <div className={cx("no-scrollbar flex gap-2 overflow-auto px-3 md:absolute md:right-3 md:top-1/2 md:max-h-[calc(100%-128px)] md:-translate-y-1/2 md:flex-col md:px-0", readOnly && "hidden")}>
        {/* mẫu hệ thống: 3 lựa chọn bố cục (Lưới · Chồng · Một), thumbnail dựng từ chính ảnh của khách */}
        {ARRANGE.map(([k, t]) => {
          const on = isSys && arrange === k;
          return (
            <button key={k} type="button" onClick={() => { setIdx(SYSTEM); setArrange(k); }} title={`Mockup: ${t}`} aria-label={`Mockup ${t}`}
              className={cx("relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border bg-[#f4f4f5]", on ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumbs[k] && <img src={thumbs[k]} alt="" className="h-full w-full object-cover" />}
              <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[9px] font-bold leading-[13px] text-white">{t}</span>
            </button>
          );
        })}
        {frames.map((f, i) => (
          <button key={f.id} type="button" onClick={() => setIdx(i)} title={f.name}
            className={cx("h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border bg-[#f4f4f5]", idx >= 0 && f.id === frame?.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
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

      {/* Mẫu hệ thống: chip bố cục ngay trên thanh đáy */}
      {isSys && !readOnly && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-4 pt-2 md:absolute md:inset-x-0 md:bottom-14 md:pt-0">
          {/* "Một": chọn món · nút xáo trộn */}
          {arrange === "single" && singles.map((k) => <Chip key={k} on={one === k} onClick={() => setSingle(k)}>{ITEM_LABEL[k]}</Chip>)}
          <button type="button" onClick={() => setSeed((v) => v + 1)} title="Xáo trộn" aria-label="Xáo trộn"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /></button>
        </div>
      )}

      {/* thanh đáy: trái Nền · phải Tải về */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4 md:absolute md:inset-x-0 md:bottom-0">
        <div className="min-w-0 flex-1">{readOnly ? null : bgPicker}</div>
        {extra && <div className="shrink-0">{extra}</div>}
        <div className="shrink-0">{menu}</div>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cx("h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]")}>
      {children}
    </button>
  );
}
