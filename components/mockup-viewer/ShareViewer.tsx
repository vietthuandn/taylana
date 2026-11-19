"use client";

/* Xem link chia sẻ mockup (chỉ đọc): dựng lại y hệt trạng thái admin đã lưu bằng chính bộ dựng của trang Mockup.
   Được: chuyển "CD Mockup" ↔ "Booklet" (nếu gói có booklet), xoay / mở hộp 3D, lật trang booklet, tải ảnh đang xem
   (watermark nếu đang bật). Không đổi được ảnh, mẫu, nền. Góc dưới: đếm ngược thời gian còn lại của link. */
import { useEffect, useMemo, useState } from "react";
import { GRADIENTS, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg } from "@/lib/mockup/images";
import { fmtLeft, type ShareState } from "@/lib/mockupShare/types";
import { AdminOverlays } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { CdMockupTab } from "./CdMockupTab";
import { BookletViewer } from "./BookletViewer";
import { deriveMockup } from "./derive";

export function ShareViewer({ state, urls, expiresAt, watermark }: { state: ShareState; urls: Record<string, string>; expiresAt: string; watermark: boolean }) {
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement>>({});
  const [bg, setBg] = useState<BgChoice>(() => ({ kind: "gradient", g: GRADIENTS.find((g) => state.bg.kind === "gradient" && g.id === state.bg.id) ?? GRADIENTS[0] }));
  const [ready, setReady] = useState(false);
  const [booklet, setBooklet] = useState(state.booklet);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let off = false;
    (async () => {
      const out: Record<string, HTMLImageElement> = {};
      await Promise.all(Object.entries(state.slots).map(async ([k, p]) => { if (urls[p]) { try { out[k] = await loadImg(urls[p]); } catch { /* bỏ */ } } }));
      let b: BgChoice | null = null;
      try {
        if (state.bg.kind === "shop") b = { kind: "image", img: await loadImg(state.bg.url), name: state.bg.name };
        else if (state.bg.kind === "file" && urls[state.bg.path]) b = { kind: "image", img: await loadImg(urls[state.bg.path]), name: "mine" };
      } catch { /* nền lỗi → gradient */ }
      if (off) return;
      setImgs(out); if (b) setBg(b); setReady(true);
    })();
    return () => { off = true; };
  }, [state, urls]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const left = new Date(expiresAt).getTime() - now;
  useEffect(() => { if (left <= 0) location.reload(); }, [left]);
  const D = useMemo(() => deriveMockup(state.layout, imgs, state.box), [state.layout, state.box, imgs]);
  const canBooklet = !!D.bookletPages;
  if (!ready) return <div className="grid flex-1 place-items-center text-[14px] text-[#71717a]">Đang tải ảnh...</div>;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#3f3f46]">{state.pkgName}</p>
        {canBooklet && (
          <div className="inline-flex rounded-[10px] border border-[#e5e5e7] bg-white p-1">
            {([[false, "CD Mockup"], [true, "Booklet"]] as const).map(([v, l]) => (
              <button key={l} type="button" onClick={() => setBooklet(v)} className={cx("rounded-[8px] px-3 py-1.5 text-[13px] font-medium", booklet === v ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]")}>{l}</button>
            ))}
          </div>
        )}
      </div>
      <section className={cx("relative mx-auto flex w-full max-w-[1200px] min-h-[520px] flex-1 flex-col md:min-h-0", booklet && canBooklet ? "md:overflow-visible" : "md:overflow-hidden")}>
        {booklet && canBooklet
          ? <BookletViewer pages={D.bookletPages!} back={D.back} bg={bg} bgPicker={null} onExit={() => setBooklet(false)} />
          : <CdMockupTab frames={[]} images={D.regionImages} images3d={D.images3d} system={D.system} tray={state.tray} finish={state.finish} modelUrl={state.modelUrl}
              watermark={watermark} bg={bg} bgPicker={null} init={state.view.idx !== undefined && state.view.idx >= 0 ? { ...state.view, idx: -2 } : state.view} readOnly />}
      </section>
      <p className="pointer-events-none fixed bottom-3 left-3 z-30 rounded-full bg-white/90 px-3 py-1 text-[12px] text-[#71717a] shadow-sm">Link hết hạn sau {fmtLeft(left)}</p>
      <AdminOverlays />
    </div>
  );
}
