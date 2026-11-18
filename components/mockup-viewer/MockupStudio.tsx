"use client";

/* Trang "Xem Mockup CD": trái 36% = khu tải ảnh (hoặc trình xem Booklet khi bấm "Xem preview"), phải = CD Mockup.
   Ảnh của khách chỉ xử lý trên trình duyệt, KHÔNG upload. */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import type { Package } from "@/lib/types";
import { GRADIENTS, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg } from "@/lib/mockup/images";
import { takeHandoff } from "@/lib/mockup/handoff";
import type { MockupBackground, MockupFrame, RegionType } from "@/lib/mockup/types";
import { CdUploadPanel } from "@/components/cd/CdUploadPanel";
import { layoutOf, readPicked, slotsOf, type Picked } from "@/components/cd/cdSlots";
import { BgPicker } from "./BgPicker";
import { CdMockupTab } from "./CdMockupTab";
import { BookletViewer } from "./BookletViewer";

const isSingleCd = (p: Package) => /^\s*cd\s*lẻ/i.test(p.name);
const isCdBox = (p: Package) => /^\s*cd\s*\+\s*hộp/i.test(p.name);

export function MockupStudio({ packages: allPackages, frames, boxFrame, backgrounds }: {
  packages: Package[]; frames: MockupFrame[]; boxFrame?: MockupFrame | null; backgrounds: MockupBackground[]; watermark?: boolean;
}) {
  // trang Mockup không có gói "CD lẻ"
  const packages = useMemo(() => allPackages.filter((p) => !isSingleCd(p)), [allPackages]);
  const [pkgId, setPkgId] = useState(packages[0]?.id ?? "");
  const [files, setFiles] = useState<Record<string, Picked>>({});
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement>>({});
  const [previewing, setPreviewing] = useState(false);
  const [bg, setBg] = useState<BgChoice>({ kind: "gradient", g: GRADIENTS[0] });
  const pkg = packages.find((p) => p.id === pkgId) ?? packages[0];
  const layout = pkg ? layoutOf(pkg) : null;
  const slots = useMemo(() => (layout ? slotsOf(layout) : []), [layout?.front, layout?.back, layout?.disc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ảnh mang sang từ Trình chỉnh CD / Gửi file CD (bộ nhớ tạm trong trình duyệt)
  useEffect(() => {
    takeHandoff().then(async (h) => {
      if (!h) return;
      if (h.packageId && packages.some((p) => p.id === h.packageId)) setPkgId(h.packageId);
      const p = packages.find((x) => x.id === h.packageId) ?? packages[0];
      if (!p) return;
      const all = slotsOf(layoutOf(p));
      const next: Record<string, Picked> = {};
      for (const [slot, f] of Object.entries(h.files)) {
        const s = all.find((x) => x.id === slot);
        if (s) next[slot] = await readPicked(f, s.spec);
      }
      setFiles(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ảnh xem trước → HTMLImageElement cho bộ dựng
  useEffect(() => {
    let off = false;
    (async () => {
      const out: Record<string, HTMLImageElement> = {};
      for (const [k, p] of Object.entries(files)) if (p.preview && !p.error) out[k] = await loadImg(p.preview).catch(() => undefined as unknown as HTMLImageElement);
      if (!off) setImgs(out);
    })();
    return () => { off = true; };
  }, [files]);

  function setSlot(id: string, p: Picked | null) {
    setFiles((cur) => {
      const old = cur[id];
      if (old?.preview && old.preview !== p?.preview) URL.revokeObjectURL(old.preview);
      const n = { ...cur };
      if (p) n[id] = p; else delete n[id];
      return n;
    });
  }

  // chỉ vùng thuộc gói mới có khoá (null = chưa có ảnh); vùng ngoài gói bỏ trống → vẽ trắng trơn
  const regionImages = useMemo<Partial<Record<RegionType, HTMLImageElement | null>>>(() => {
    const out: Partial<Record<RegionType, HTMLImageElement | null>> = {};
    if (!layout) return out;
    if (layout.front >= 1) out.front_out = imgs.f1 ?? null;
    if (layout.front >= 2) out.front_in = imgs.f2 ?? null;
    if (layout.back >= 1) out.back_out = imgs.b1 ?? null;
    if (layout.back >= 2) out.back_in = imgs.b2 ?? null;
    if (layout.disc) out.disc = imgs.d ?? null;
    return out;
  }, [imgs, layout?.front, layout?.back, layout?.disc]); // eslint-disable-line react-hooks/exhaustive-deps
  const bookletPages = useMemo(() => (layout && layout.front >= 4 ? Array.from({ length: layout.front }, (_, i) => imgs[`f${i + 1}`] ?? null) : null), [layout, imgs]);
  const picker = <BgPicker value={bg} onChange={setBg} shop={backgrounds} />;
  // gói "CD + Hộp": dùng mẫu mặc định, ẩn cột chọn mẫu
  const box = !!pkg && isCdBox(pkg) && !!boxFrame;
  const viewFrames = useMemo(() => (box && boxFrame ? [boxFrame] : frames), [box, boxFrame, frames]);

  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     {/* giới hạn bề ngang như các trang khác (1200px) */}
     <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col md:min-h-0 md:flex-row md:border-x md:border-[#e5e5e7]">
      {/* ---------- Trái 36%: khu tải ảnh / trình xem Booklet ---------- */}
      <aside className="relative space-y-6 border-[#e5e5e7] bg-white p-6 md:w-[36%] md:min-w-[360px] md:shrink-0 md:overflow-y-auto md:border-r">
        {previewing && bookletPages ? (
          <>
            <button type="button" onClick={() => setPreviewing(false)} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#18181b] hover:text-[#ff5fa2]">
              <ArrowLeft size={16} /> Quay lại
            </button>
            <BookletViewer pages={bookletPages} back={layout && layout.back >= 1 ? imgs.b1 ?? null : null} bg={bg} />
          </>
        ) : (
          <>
            {/* chọn gói: floating label kiểu outlined (nhãn đè lên viền trên) */}
            <label className="group relative block">
              <select value={pkg?.id ?? ""} onChange={(e) => setPkgId(e.target.value)} aria-label="Gói CD"
                className="peer h-12 w-full cursor-pointer appearance-none truncate rounded-[10px] border border-[#e5e5e7] bg-white pl-3 pr-9 text-[15px] text-[#18181b] outline-none transition-colors focus:border-[#ff5fa2]">
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-white px-1 text-[11px] leading-none text-[#71717a] transition-colors peer-focus:text-[#ff5fa2]">Gói CD</span>
              <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
            </label>
            {layout && (
              <CdUploadPanel variant="compact" slots={slots} layout={layout} files={files} onPreview={() => setPreviewing(true)}
                onPick={async (s, f) => setSlot(s.id, await readPicked(f, s.spec))} onRemove={(s) => setSlot(s.id, null)} />
            )}
          </>
        )}
      </aside>

      {/* ---------- Phải: CD Mockup ---------- */}
      <section className="relative flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-hidden">
        <CdMockupTab frames={viewFrames} images={regionImages} bg={bg} bgPicker={picker} hidePicker={box} />
      </section>
     </div>
    </div>
  );
}
