"use client";

/* Trình xem Booklet (panel trái, "Xem preview"): sách lật trang thật (page-flip), trang vuông 12 × 12 cm,
   texture giấy + bóng gáy + viền ngả kem. Trình tự: 1 (đơn) → 2–3 → … → n (đơn) → Bìa Sau - Mặt Ngoài (đơn, 15 : 11.7).
   Khi chỉ 1 trang: khung ngoài rộng đúng 1 trang (overflow hidden), sách trượt ±½ để giấu nửa trống. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import { Button } from "@/components/ui/kit";
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

const BACK_RATIO = 15 / 11.7;

export function BookletViewer({ pages, back, bg }: { pages: (HTMLImageElement | null)[]; back: HTMLImageElement | null; bg: BgChoice }) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const flip = useRef<import("page-flip").PageFlip | null>(null);
  const [cur, setCur] = useState(0);
  const [onBack, setOnBack] = useState(false);
  const [bgUrl, setBgUrl] = useState("");
  const [avail, setAvail] = useState(0);
  const n = pages.length;

  const canvases = useMemo(() => pages.map((img, i) => pageImage(img, i + 1, i % 2 === 0 ? "right" : "left")), [pages]);
  const urls = useMemo(() => canvases.map((c) => c.toDataURL("image/jpeg", 0.9)), [canvases]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = document.createElement("canvas"); c.width = 1200; c.height = 800;
    paintBackground(c.getContext("2d")!, 1200, 800, bg);
    setBgUrl(c.toDataURL("image/jpeg", 0.85));
  }, [bg]);

  // 1 trang = ½ bề ngang khả dụng (trừ lề 24px mỗi bên)
  const P = Math.max(80, Math.floor((avail - 48) / 2));

  // dựng cuốn sách (dựng lại khi đổi ảnh / kích thước)
  useEffect(() => {
    const el = host.current;
    if (!el || !urls.length || !avail) return;
    let off = false;
    el.innerHTML = "";
    const book = document.createElement("div");
    el.appendChild(book);
    import("page-flip").then(({ PageFlip }) => {
      if (off) return;
      const pf = new PageFlip(book, {
        width: P, height: P, size: "fixed", showCover: true, drawShadow: true, maxShadowOpacity: 0.5,
        usePortrait: false, mobileScrollSupport: false, flippingTime: 800,
      });
      pf.loadFromImages(urls);
      pf.on("flip", (e) => setCur(Number(e.data)));
      flip.current = pf;
      setCur(0); setOnBack(false);
    });
    return () => { off = true; try { flip.current?.destroy(); } catch { /* bỏ qua */ } flip.current = null; el.innerHTML = ""; };
  }, [urls, P, avail]);

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
  const label = onBack ? "Mặt sau hộp CD" : spread.length === 1 ? `Trang ${spread[0] + 1} / ${n}` : `Trang ${spread[0] + 1}–${spread[1] + 1} / ${n}`;
  // khung ngoài: 1 trang / 2 trang / bìa sau; sách trượt để giấu nửa trống
  const outerW = onBack ? Math.round(P * BACK_RATIO) : spread.length === 1 ? P : P * 2;
  const shift = spread.length === 1 && spread[0] === 0 ? -P : 0; // trang 1 nằm nửa phải → kéo sang trái

  return (
    <div ref={box} className="space-y-3">
      <div className="flex justify-center rounded-[12px] border border-[#e5e5e7] bg-cover bg-center px-6 py-8" style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : undefined }}>
        <div className="relative overflow-hidden transition-[width] duration-500 ease-out" style={{ width: outerW, height: P }}>
          <div className={cx("absolute left-0 top-0 transition-[transform,opacity] duration-500 ease-out", onBack && "pointer-events-none opacity-0")}
            style={{ width: P * 2, height: P, transform: `translateX(${shift}px)` }}>
            <div ref={host} className="h-full w-full" />
          </div>
          {back && (
            <div className={cx("absolute inset-0 transition-opacity duration-500", onBack ? "opacity-100" : "pointer-events-none opacity-0")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={back.src} alt="Mặt sau hộp CD" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button variant="secondary" size="sm" icon={<ChevronLeft size={16} />} onClick={prev} disabled={cur === 0 && !onBack}>Trước</Button>
        <span className="min-w-[120px] text-center text-[13px] tabular-nums text-[#3f3f46]">{label}</span>
        <Button variant="secondary" size="sm" onClick={next} disabled={onBack || (atEnd && !back)}>Sau <ChevronRight size={16} /></Button>
      </div>
    </div>
  );
}
