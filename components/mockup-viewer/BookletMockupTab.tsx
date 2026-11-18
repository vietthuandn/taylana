"use client";

/* Tab "Booklet Mockup": cuốn sách lật trang thật (thư viện page-flip), trang vuông 12 × 12 cm,
   phủ texture giấy + bóng gáy + viền ngả kem. Trình tự: 1 (bìa, lẻ bên phải) → 2–3 → … → trang cuối (lẻ bên trái). */
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Download, Image as ImageIcon } from "lucide-react";
import { paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import { saveBlob } from "@/lib/imageTools";
import { Button, toast } from "@/components/ui/kit";

const PX = 1000; // kích thước ảnh 1 trang khi dựng

// texture giấy (nhiễu + vân) dùng chung
let paper: HTMLCanvasElement | null = null;
function paperTexture() {
  if (paper) return paper;
  paper = document.createElement("canvas");
  paper.width = paper.height = 512;
  const x = paper.getContext("2d")!;
  const d = x.createImageData(512, 512);
  for (let i = 0; i < d.data.length; i += 4) { const v = 225 + Math.random() * 30; d.data[i] = v; d.data[i + 1] = v - 2; d.data[i + 2] = v - 8; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  x.globalAlpha = 0.08; x.strokeStyle = "#8a7d6b";
  for (let i = 0; i < 140; i++) { x.beginPath(); const y = Math.random() * 512; x.moveTo(0, y); x.bezierCurveTo(170, y + Math.random() * 8 - 4, 340, y + Math.random() * 8 - 4, 512, y + Math.random() * 6 - 3); x.lineWidth = Math.random() * 1.2; x.stroke(); }
  return paper;
}

// 1 trang: ảnh phủ kín + giấy (multiply) + viền kem + bóng gáy ở cạnh trong
function pageImage(img: HTMLImageElement | null, no: number, side: "left" | "right") {
  const c = document.createElement("canvas");
  c.width = c.height = PX;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fbf8f1"; x.fillRect(0, 0, PX, PX);
  if (img) {
    const s = Math.max(PX / img.naturalWidth, PX / img.naturalHeight);
    x.drawImage(img, (PX - img.naturalWidth * s) / 2, (PX - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else {
    x.fillStyle = "#d4d4d8"; x.font = "600 48px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(`Trang ${no}`, PX / 2, PX / 2);
  }
  x.globalCompositeOperation = "multiply"; x.globalAlpha = 0.35;
  x.fillStyle = x.createPattern(paperTexture(), "repeat")!; x.fillRect(0, 0, PX, PX);
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  // viền trang hơi ngả kem
  x.strokeStyle = "rgba(214,196,160,0.55)"; x.lineWidth = 6; x.strokeRect(3, 3, PX - 6, PX - 6);
  // bóng gáy: tối dần vào cạnh trong
  const inner = side === "right" ? 0 : PX;
  const g = x.createLinearGradient(inner, 0, side === "right" ? PX * 0.12 : PX * 0.88, 0);
  g.addColorStop(0, "rgba(0,0,0,0.28)"); g.addColorStop(0.35, "rgba(0,0,0,0.08)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, PX, PX);
  return c;
}

export function BookletMockupTab({ pages, bg, bgPicker, onChangePackage }: {
  pages: (HTMLImageElement | null)[] | null; bg: BgChoice; bgPicker: React.ReactNode; onChangePackage?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const flip = useRef<import("page-flip").PageFlip | null>(null);
  const [cur, setCur] = useState(0);
  const [bgUrl, setBgUrl] = useState("");
  const n = pages?.length ?? 0;

  const canvases = useMemo(() => (pages ? pages.map((img, i) => pageImage(img, i + 1, i % 2 === 0 ? "right" : "left")) : []), [pages]);
  const urls = useMemo(() => canvases.map((c) => c.toDataURL("image/jpeg", 0.9)), [canvases]);

  useEffect(() => {
    const c = document.createElement("canvas"); c.width = 1200; c.height = 800;
    paintBackground(c.getContext("2d")!, 1200, 800, bg);
    setBgUrl(c.toDataURL("image/jpeg", 0.85));
  }, [bg]);

  // dựng cuốn sách (dựng lại khi đổi ảnh)
  useEffect(() => {
    const el = host.current;
    if (!el || !urls.length) return;
    let off = false;
    el.innerHTML = "";
    const book = document.createElement("div");
    el.appendChild(book);
    import("page-flip").then(({ PageFlip }) => {
      if (off) return;
      const pf = new PageFlip(book, {
        width: 400, height: 400, size: "stretch", minWidth: 120, maxWidth: 1000, minHeight: 120, maxHeight: 1000,
        showCover: true, drawShadow: true, maxShadowOpacity: 0.5, usePortrait: false, mobileScrollSupport: false, flippingTime: 800,
      });
      pf.loadFromImages(urls);
      pf.on("flip", (e) => setCur(Number(e.data)));
      flip.current = pf;
      setCur(0);
    });
    return () => { off = true; try { flip.current?.destroy(); } catch { /* bỏ qua */ } flip.current = null; el.innerHTML = ""; };
  }, [urls]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") flip.current?.flipNext();
      if (e.key === "ArrowLeft") flip.current?.flipPrev();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // trang đang mở: [0] | [1,2] | [3,4] | … | [n-1]
  const spread = cur === 0 ? [0] : cur >= n - 1 && n % 2 === 0 ? [n - 1] : [cur % 2 === 1 ? cur : cur - 1, (cur % 2 === 1 ? cur : cur - 1) + 1];
  const label = spread.length === 1 ? `Trang ${spread[0] + 1} / ${n}` : `Trang ${spread[0] + 1}–${spread[1] + 1} / ${n}`;

  async function downloadSpread(transparent = false) {
    const W = 2400, H = 1600;
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const x = out.getContext("2d")!;
    if (!transparent) paintBackground(x, W, H, bg);
    const size = H * 0.7, top = (H - size) / 2;
    x.save(); x.shadowColor = "rgba(0,0,0,0.25)"; x.shadowBlur = 40; x.shadowOffsetY = 16;
    if (spread.length === 1) {
      const left = spread[0] === 0 ? W / 2 : W / 2 - size;
      x.drawImage(canvases[spread[0]], left, top, size, size);
    } else {
      x.drawImage(canvases[spread[0]], W / 2 - size, top, size, size);
      x.drawImage(canvases[spread[1]], W / 2, top, size, size);
    }
    x.restore();
    // nền trong suốt: cắt sát phần trang (kèm chỗ cho bóng)
    let res = out;
    if (transparent) {
      const l = spread.length === 1 ? (spread[0] === 0 ? W / 2 : W / 2 - size) : W / 2 - size, w = spread.length === 1 ? size : size * 2, m = 60;
      res = document.createElement("canvas"); res.width = w + m * 2; res.height = size + m * 2;
      res.getContext("2d")!.drawImage(out, l - m, top - m, res.width, res.height, 0, 0, res.width, res.height);
    }
    const blob = await new Promise<Blob | null>((r) => res.toBlob(r, transparent ? "image/png" : "image/jpeg", 0.92));
    if (!blob) return toast("Xuất ảnh thất bại", "err");
    saveBlob(blob, `Booklet-${label.replace(/[^\d–/]+/g, "").replace(/[–/]/g, "-")}.${transparent ? "png" : "jpg"}`);
    toast("Đã tải xuống");
  }

  if (!pages) {
    return (
      <div className="grid h-64 place-items-center rounded-[12px] border border-dashed border-[#d4d4d8] bg-white text-center text-[14px] text-[#71717a]">
        <span>
          <BookOpen size={24} className="mx-auto mb-2" />Gói này không có booklet.
          <span className="mt-1 block text-[13px]">Chọn gói có Booklet 4, 8 hoặc 12 trang ở panel bên trái{onChangePackage ? "" : ""}.</span>
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {bgPicker}
      <div className="relative mx-auto w-full overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-cover bg-center px-[3%] py-[4%]" style={{ maxWidth: "min(640px, max(300px, calc((100dvh - var(--header-h) - 230px) * 1.7)))", backgroundImage: bgUrl ? `url(${bgUrl})` : undefined }}>
        <div ref={host} className="mx-auto w-full [filter:drop-shadow(0_16px_24px_rgba(0,0,0,0.18))]" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={<ChevronLeft size={16} />} onClick={() => flip.current?.flipPrev()} disabled={cur === 0}>Trước</Button>
        <span className="min-w-[120px] text-center text-[13px] tabular-nums text-[#3f3f46]">{label}</span>
        <Button variant="secondary" size="sm" onClick={() => flip.current?.flipNext()} disabled={spread[spread.length - 1] >= n - 1}>Sau <ChevronRight size={16} /></Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<ImageIcon size={16} />} onClick={() => downloadSpread(true)} title="Ảnh PNG nền trong suốt">PNG trong suốt</Button>
          <Button size="sm" icon={<Download size={16} />} onClick={() => downloadSpread()} title="Bấm mép trang, kéo góc hoặc dùng phím ← → để lật">Tải JPG</Button>
        </div>
      </div>
    </div>
  );
}
