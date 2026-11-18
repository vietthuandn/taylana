"use client";

/* Trình xem Booklet (panel phải, bấm "Xem preview"): sách lật trang thật (page-flip), trang vuông 12 × 12 cm,
   texture giấy + bóng gáy + viền ngả kem. Trình tự: 1 (đơn) → 2–3 → … → n (đơn) → Bìa Sau - Mặt Ngoài (đơn, 15 : 11.7).
   Trang đơn: sách trượt ±½ trang về giữa, nửa trống giấu bằng clip-path CHỈ theo chiều ngang (chiều dọc vẫn tràn
   để trang cong khi lật không bị cắt). Không dùng overflow: hidden quanh cuốn sách. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { coverCrop } from "@/lib/mockup/coverCrop";
import { paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import { saveBlob } from "@/lib/imageTools";
import { Button, toast } from "@/components/ui/kit";
import { DownloadMenu } from "./DownloadMenu";
import { cx } from "@/components/ui/styles";

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
    x.drawImage(coverCrop(img, 1, PX), 0, 0, PX, PX); // trang 12 × 12: phủ kín
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

const BACK_RATIO = 15 / 11.7;

export function BookletViewer({ pages, back, bg, bgPicker, onExit }: {
  pages: (HTMLImageElement | null)[]; back: HTMLImageElement | null; bg: BgChoice; bgPicker: React.ReactNode; onExit: () => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const flip = useRef<import("page-flip").PageFlip | null>(null);
  const curRef = useRef(0);
  const [cur, setCur] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [onBack, setOnBack] = useState(false);
  const [bgUrl, setBgUrl] = useState("");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const n = pages.length;

  const canvases = useMemo(() => pages.map((img, i) => pageImage(img, i + 1, i % 2 === 0 ? "right" : "left")), [pages]);
  const urls = useMemo(() => canvases.map((c) => c.toDataURL("image/jpeg", 0.9)), [canvases]);
  // Bìa Sau - Mặt Ngoài: cắt phủ kín đúng 15 × 11.7
  const backCanvas = useMemo(() => (back ? coverCrop(back, BACK_RATIO, 1600) : null), [back]);
  const backUrl = useMemo(() => backCanvas?.toDataURL("image/jpeg", 0.9) ?? "", [backCanvas]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = document.createElement("canvas"); c.width = 1200; c.height = 800;
    paintBackground(c.getContext("2d")!, 1200, 800, bg);
    setBgUrl(c.toDataURL("image/jpeg", 0.85));
  }, [bg]);

  // 1 trang (vuông) = min(cao vùng xem × 0.7, rộng vùng xem × 0.85 / 2)
  const P = Math.max(80, Math.floor(Math.min(size.h * 0.7, (size.w * 0.85) / 2)));

  // dựng cuốn sách (dựng lại khi đổi ảnh / kích thước, giữ trang đang xem)
  useEffect(() => {
    const el = host.current;
    if (!el || !urls.length || !size.w) return;
    let off = false;
    el.innerHTML = "";
    const book = document.createElement("div");
    el.appendChild(book);
    import("page-flip").then(({ PageFlip }) => {
      if (off) return;
      const pf = new PageFlip(book, {
        width: P, height: P, size: "fixed", showCover: true, drawShadow: true, maxShadowOpacity: 0.5,
        usePortrait: false, mobileScrollSupport: false, flippingTime: 800, startPage: Math.min(curRef.current, urls.length - 1),
      });
      // chế độ HTML (không dùng canvas) để trang cong khi lật tràn ra ngoài khung, không bị cắt
      // ảnh trang là <img> CON của trang: page-flip ghi đè style.cssText của trang mỗi lần vẽ (nền CSS sẽ mất)
      const items = urls.map((u) => {
        const d = document.createElement("div");
        const im = document.createElement("img");
        im.src = u; im.alt = ""; im.draggable = false;
        im.style.cssText = "display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;user-select:none;";
        d.appendChild(im);
        return d;
      });
      items.forEach((d) => book.appendChild(d));
      pf.loadFromHTML(items);
      pf.on("flip", (e) => { curRef.current = Number(e.data); setCur(Number(e.data)); });
      // bắt đầu lật → bỏ clip-path ngay; lật xong mới trượt về giữa
      pf.on("changeState", (e) => setFlipping(e.data !== "read"));
      flip.current = pf;
      setCur(curRef.current);
    });
    return () => { off = true; try { flip.current?.destroy(); } catch { /* bỏ qua */ } flip.current = null; el.innerHTML = ""; };
  }, [urls, P, size.w]);

  const atEnd = cur >= n - 1 || (n % 2 === 1 && cur >= n - 2);
  const next = () => { if (!atEnd) flip.current?.flipNext(); else if (back) setOnBack(true); };
  const prev = () => { if (onBack) setOnBack(false); else flip.current?.flipPrev(); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // trang đang mở: [0] | [1,2] | … | [n-1]
  const spread = cur === 0 ? [0] : cur >= n - 1 && n % 2 === 0 ? [n - 1] : [cur % 2 === 1 ? cur : cur - 1, (cur % 2 === 1 ? cur : cur - 1) + 1];
  const single = spread.length === 1;
  const first = single && spread[0] === 0;
  const label = onBack ? "Mặt sau hộp CD" : single ? `Trang ${spread[0] + 1} / ${n}` : `Trang ${spread[0] + 1}–${spread[1] + 1} / ${n}`;
  // trang đơn: trượt ½ trang về giữa + giấu nửa trống theo chiều NGANG (dọc vẫn tràn)
  const shift = single ? (first ? -P / 2 : P / 2) : 0;
  const clip = flipping || !single ? "none" : first ? "inset(-50% -50% -50% 50%)" : "inset(-50% 50% -50% -50%)";

  async function download() {
    const W = 2400, H = 1600;
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const x = out.getContext("2d")!;
    paintBackground(x, W, H, bg);
    const s = H * 0.7, top = (H - s) / 2;
    x.save(); x.shadowColor = "rgba(0,0,0,0.25)"; x.shadowBlur = 40; x.shadowOffsetY = 16;
    if (onBack && backCanvas) x.drawImage(backCanvas, (W - s * BACK_RATIO) / 2, top, s * BACK_RATIO, s);
    else if (single) x.drawImage(canvases[spread[0]], (W - s) / 2, top, s, s);
    else { x.drawImage(canvases[spread[0]], W / 2 - s, top, s, s); x.drawImage(canvases[spread[1]], W / 2, top, s, s); }
    x.restore();
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return toast("Xuất ảnh thất bại", "err");
    saveBlob(blob, `Booklet-${onBack ? "mat-sau" : label.replace(/[^\d–/]+/g, "").replace(/[–/]/g, "-")}.jpg`);
    toast("Đã tải xuống");
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:block">
      {/* vùng xem: nền đang chọn, cuốn sách căn giữa 2 chiều; mọi khung quanh sách để tràn (overflow visible) */}
      <div className="relative flex min-h-[420px] flex-1 flex-col bg-cover bg-center md:absolute md:inset-x-0 md:bottom-14 md:top-0 md:min-h-0"
        style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : undefined }}>
        <button type="button" onClick={onExit}
          className="absolute left-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-white/90 px-2.5 text-[13px] font-medium text-[#18181b] shadow-sm hover:text-[#ff5fa2]">
          <ArrowLeft size={15} /> CD Mockup
        </button>
        <div ref={area} className="flex flex-1 flex-col items-center justify-center">
          {/* chừa trên / dưới ≥ 25% chiều cao trang để trang cong khi lật hiện đủ */}
          <div className="relative" style={{ width: P * 2, height: P, marginTop: P * 0.25, marginBottom: P * 0.25 }}>
            <div className={cx("absolute inset-0 transition-[transform,opacity] duration-500 ease-out [filter:drop-shadow(0_16px_24px_rgba(0,0,0,0.18))]", onBack && "pointer-events-none opacity-0")}
              style={{ transform: `translateX(${shift}px)`, clipPath: clip }}>
              <div ref={host} className="h-full w-full" />
            </div>
            {back && (
              <div className={cx("absolute top-0 transition-opacity duration-500 [filter:drop-shadow(0_16px_24px_rgba(0,0,0,0.18))]", onBack ? "opacity-100" : "pointer-events-none opacity-0")}
                style={{ height: P, width: P * BACK_RATIO, left: (P * 2 - P * BACK_RATIO) / 2 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={backUrl} alt="Mặt sau hộp CD" className="h-full w-full" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" icon={<ChevronLeft size={16} />} onClick={prev} disabled={cur === 0 && !onBack}>Trước</Button>
            <span className="min-w-[120px] rounded-[6px] bg-white/80 px-2 py-0.5 text-center text-[13px] tabular-nums text-[#3f3f46]">{label}</span>
            <Button variant="secondary" size="sm" onClick={next} disabled={onBack || (atEnd && !back)}>Sau <ChevronRight size={16} /></Button>
          </div>
        </div>
      </div>
      {/* thanh đáy: trái Nền · phải Tải về */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4 md:absolute md:inset-x-0 md:bottom-0">
        <div className="min-w-0 flex-1">{bgPicker}</div>
        <div className="shrink-0"><DownloadMenu up items={[{ label: "Tải ảnh trang đang mở (JPG)", icon: <Download size={16} />, onClick: download }]} /></div>
      </div>
    </div>
  );
}
