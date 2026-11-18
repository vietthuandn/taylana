"use client";

/* Trang "Xem Mockup CD": trái 40% = khu tải ảnh (dùng chung với Gửi file CD), phải 60% = tab CD Mockup / Booklet Mockup.
   Ảnh của khách chỉ xử lý trên trình duyệt, KHÔNG upload. */
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Disc3 } from "lucide-react";
import type { Package } from "@/lib/types";
import { GRADIENTS, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg } from "@/lib/mockup/images";
import { takeHandoff } from "@/lib/mockup/handoff";
import type { MockupBackground, MockupFrame, RegionType } from "@/lib/mockup/types";
import { CdUploadPanel } from "@/components/cd/CdUploadPanel";
import { layoutOf, readPicked, slotsOf, type Picked } from "@/components/cd/cdSlots";
import { cx } from "@/components/ui/styles";
import { BgPicker } from "./BgPicker";
import { CdMockupTab } from "./CdMockupTab";
import { BookletMockupTab } from "./BookletMockupTab";

export function MockupStudio({ packages, frames, backgrounds }: {
  packages: Package[]; frames: MockupFrame[]; backgrounds: MockupBackground[]; watermark?: boolean;
}) {
  const [pkgId, setPkgId] = useState(packages[0]?.id ?? "");
  const [files, setFiles] = useState<Record<string, Picked>>({});
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement>>({});
  const [tab, setTab] = useState<"cd" | "booklet">("cd");
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
      if (layoutOf(p).front >= 4 && !layoutOf(p).back && !layoutOf(p).disc) setTab("booklet");
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
  const picker = <BgPicker value={bg} onChange={setBg} shop={backgrounds} className="shrink-0" />;

  const tabs = (
        <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
          {([["cd", "CD Mockup", Disc3], ["booklet", "Booklet Mockup", BookOpen]] as const).map(([k, t, Icon]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={cx("inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium", tab === k ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]")}>
              <Icon size={16} /> {t}
            </button>
          ))}
        </div>
  );

  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     {/* giới hạn bề ngang như các trang khác (1200px) */}
     <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col md:min-h-0 md:flex-row md:border-x md:border-[#e5e5e7]">
      {/* ---------- Trái 40%: khu tải ảnh ---------- */}
      <aside className="relative space-y-6 border-[#e5e5e7] bg-white p-6 md:w-[38%] md:shrink-0 md:overflow-y-auto md:border-r">
        {/* chọn gói: floating label */}
        <label className="relative block h-14 rounded-[10px] border border-[#e5e5e7] bg-white transition-colors focus-within:border-[#ff5fa2]">
          <span className="pointer-events-none absolute left-3 top-2 text-[12px] leading-none text-[#71717a]">Gói CD</span>
          <select value={pkg?.id ?? ""} onChange={(e) => setPkgId(e.target.value)} aria-label="Gói CD"
            className="h-full w-full cursor-pointer appearance-none truncate rounded-[10px] bg-transparent pl-3 pr-9 pt-4 text-[15px] text-[#18181b] outline-none">
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
        </label>
        {layout && (
          <CdUploadPanel variant="compact" slots={slots} layout={layout} files={files}
            onPick={async (s, f) => setSlot(s.id, await readPicked(f, s.spec))} onRemove={(s) => setSlot(s.id, null)} />
        )}
      </aside>

      {/* ---------- Phải 60%: mockup ---------- */}
      <section className="no-scrollbar relative flex min-w-0 flex-1 flex-col p-3 md:min-h-0 md:overflow-y-auto md:px-4">
        {tab === "cd"
          ? <CdMockupTab frames={frames} images={regionImages} bg={bg} bgPicker={picker} tabs={tabs} />
          : <BookletMockupTab pages={bookletPages} bg={bg} bgPicker={picker} tabs={tabs} />}
      </section>
     </div>
    </div>
  );
}
