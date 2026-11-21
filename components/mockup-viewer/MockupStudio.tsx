"use client";

/* Trang "Xem Mockup CD": trái 36% = khu tải ảnh, phải = CD Mockup (hoặc trình xem Booklet khi bấm "Xem preview").
   Ảnh của khách chỉ xử lý trên trình duyệt, KHÔNG upload. */
import { EditorHeader } from "@/components/editor/EditorHeader";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Share2 } from "lucide-react";
import { createShare } from "@/lib/mockupShare/create";
import { triggerShareCleanup } from "@/lib/mockupShare/actions";
import { fmtExpire } from "@/lib/mockupShare/types";
import { Button, toast } from "@/components/ui/kit";
import { FEATURE_MOCKUP_FRAMES } from "@/lib/features";
import type { Package } from "@/lib/types";
import { GRADIENTS, type BgChoice } from "@/lib/mockup/backgrounds";
import { loadImg } from "@/lib/mockup/images";
import { takeHandoff } from "@/lib/mockup/handoff";
import type { MockupBackground, MockupFrame, TrayStyle } from "@/lib/mockup/types";
import { CdUploadPanel } from "@/components/cd/CdUploadPanel";
import { layoutOf, readPicked, slotsOf, type Picked } from "@/components/cd/cdSlots";
import { BgPicker } from "./BgPicker";
import { CdMockupTab, type MockupView } from "./CdMockupTab";
import { BookletViewer } from "./BookletViewer";
import { deriveMockup } from "./derive";

// so tên đã chuẩn hoá Unicode (NFC) — chữ "ộ", "ẻ" có thể được lưu dạng tổ hợp (NFD) khiến so khớp trượt
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const NO_FRAMES: MockupFrame[] = []; // mẫu khung admin đang tạm ẩn (FEATURE_MOCKUP_FRAMES)
const isSingleCd = (p: Package) => /^cd lẻ/.test(norm(p.name));
// gói "CD + Hộp": theo tên, hoặc gói có hộp nhưng không có bìa nào (chỉ mặt đĩa) và không phải CD lẻ
const isCdBox = (p: Package) => {
  const n = norm(p.name);
  if (/^cd ?\+ ?hộp/.test(n)) return true;
  const l = layoutOf(p);
  return !isSingleCd(p) && l.front === 0 && l.back === 0 && /hộp/.test(n);
};

export function MockupStudio({ packages: allPackages, frames, boxFrame, backgrounds, tray = "clear", finish = "matte", modelUrl = null, canShare = false }: {
  packages: Package[]; frames: MockupFrame[]; boxFrame?: MockupFrame | null; backgrounds: MockupBackground[]; watermark?: boolean; tray?: TrayStyle; finish?: "matte" | "gloss"; modelUrl?: string | null;
  canShare?: boolean; // admin đang đăng nhập (kiểm tra ở server) → nút "Chia sẻ"
}) {
  const view = useRef<MockupView>({ idx: -2, arrange: "grid", single: "closed", seed: 1, pos: { x: 0.5, y: 0.5, scale: 1 } });
  const [sharing, setSharing] = useState<{ done: number; total: number } | null>(null);
  const [shared, setShared] = useState<{ url: string; expires: string } | null>(null);
  // trang Mockup không có gói "CD lẻ"
  const packages = useMemo(() => allPackages.filter((p) => !isSingleCd(p)), [allPackages]);
  // gói mặc định khi mở trang: "Combo + 2 bìa 2 mặt" (không có thì gói đầu tiên)
  const [pkgId, setPkgId] = useState((packages.find((p) => /2 bìa 2 mặt/.test(norm(p.name))) ?? packages[0])?.id ?? "");
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

  const box = !!pkg && isCdBox(pkg);
  const D = useMemo(() => deriveMockup(layout, imgs, box), [imgs, box, layout?.front, layout?.back, layout?.disc]); // eslint-disable-line react-hooks/exhaustive-deps
  const { regionImages, bookletPages, images3d, system } = D;
  const picker = <BgPicker value={bg} onChange={setBg} shop={backgrounds} />;
  const showBooklet = previewing && !!bookletPages;

  /** "Chia sẻ" (admin): chụp toàn bộ trạng thái hiện tại → ảnh lên bucket riêng tư → link xem chỉ đọc 24 giờ */
  async function share() {
    if (!pkg || !layout) return;
    setSharing({ done: 0, total: 1 });
    try {
      const shopBg = bg.kind === "image" && bg.name.startsWith("shop:") ? backgrounds.find((b) => `shop:${b.id}` === bg.name) : undefined;
      const r = await createShare({
        pkgName: pkg.name, layout: { front: layout.front, back: layout.back, disc: !!layout.disc }, box,
        images: Object.fromEntries(Object.entries(imgs).filter(([, v]) => v)),
        bg: bg.kind === "gradient" ? { kind: "gradient", id: bg.g.id } : shopBg ? { kind: "shop", url: shopBg.url, name: bg.name } : { kind: "file", img: bg.img },
        view: view.current, booklet: showBooklet, tray, finish, modelUrl,
      }, (done, total) => setSharing({ done, total }));
      setShared({ url: `${location.origin}/m/${r.token}`, expires: r.expires });
      triggerShareCleanup().catch(() => null); // dự phòng: dọn các link đã hết hạn (chạy nền)
    } catch (e) { toast(e instanceof Error ? e.message : "Không tạo được link chia sẻ", "err"); }
    setSharing(null);
  }
  const [dls, setDls] = useState<{ label: string; onClick: () => void }[]>([]);
  const viewFrames = useMemo(() => (!FEATURE_MOCKUP_FRAMES ? NO_FRAMES : box ? (boxFrame ? [boxFrame] : NO_FRAMES) : frames), [box, boxFrame, frames]);
  return (
    <div data-fit-screen data-editor="" className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     {/* header riêng (giống các trình thiết kế khác): Chia sẻ (admin) · Tải về */}
     <EditorHeader h={{ share: canShare ? { onClick: share, busy: !!sharing } : undefined, downloads: showBooklet ? undefined : dls }} />
     <div className="flex w-full flex-1 flex-col md:min-h-0 md:flex-row">
      {/* ---------- Trái 36%: khu tải ảnh / trình xem Booklet ---------- */}
      <aside className="relative space-y-6 border-[#e5e5e7] bg-white p-6 md:w-[380px] md:shrink-0 md:overflow-y-auto md:border-r">
          <>
            {/* chọn gói: floating label kiểu outlined (nhãn đè lên viền trên) */}
            <label className="group relative block">
              <select value={pkg?.id ?? ""} onChange={(e) => setPkgId(e.target.value)} aria-label="Gói CD"
                className="peer h-12 w-full cursor-pointer appearance-none truncate rounded-[10px] border border-[#e5e5e7] bg-white pl-3 pr-9 text-[15px] text-[#18181b] outline-none transition-colors focus:border-[var(--c-primary)]">
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-white px-1 text-[11px] leading-none text-[#71717a] transition-colors peer-focus:text-[var(--c-primary)]">Gói CD</span>
              <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
            </label>
            {layout && (
              <CdUploadPanel variant="compact" slots={slots} layout={layout} files={files} previewing={showBooklet} onPreview={() => setPreviewing((v) => !v)}
                onPick={async (s, f) => setSlot(s.id, await readPicked(f, s.spec))} onRemove={(s) => setSlot(s.id, null)} />
            )}
          </>
      </aside>

      {/* ---------- Phải: CD Mockup ---------- */}
      <section className={`relative flex min-w-0 flex-1 flex-col md:min-h-0 ${showBooklet ? "md:overflow-visible" : "md:overflow-hidden"}`}>
        {showBooklet && bookletPages
          ? <BookletViewer pages={bookletPages} back={layout && layout.back >= 1 ? imgs.b1 ?? null : null} bg={bg} bgPicker={picker} onExit={() => setPreviewing(false)} />
          : <CdMockupTab frames={viewFrames} images={regionImages} images3d={images3d} system={system} tray={tray} finish={finish} modelUrl={modelUrl} bg={bg} bgPicker={picker}
              init={view.current} onView={(v) => { view.current = v; }} onDownloads={setDls} />}
      </section>
     </div>
      {sharing && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-[380px] rounded-[12px] bg-white p-5 shadow-xl">
            <p className="text-[15px] font-semibold">Đang tạo link chia sẻ...</p>
            <p className="mt-1 text-[13px] text-[#71717a]">Đang tải ảnh lên ({sharing.done} / {sharing.total})</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f4f4f5]"><div className="h-full bg-[var(--c-primary)] transition-[width]" style={{ width: `${(sharing.done / Math.max(1, sharing.total)) * 100}%` }} /></div>
          </div>
        </div>
      )}
      {shared && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={() => setShared(null)}>
          <div className="w-full max-w-[460px] rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-semibold">Link xem mockup</p>
            <p className="mt-1 text-[13px] text-[#71717a]">Người nhận chỉ xem được, không sửa được. {fmtExpire(shared.expires)} — sau đó ảnh và dữ liệu bị xoá hẳn.</p>
            <input readOnly value={shared.url} onFocus={(e) => e.currentTarget.select()} className="mt-3 h-10 w-full rounded-[8px] border border-[#e5e5e7] bg-[#fafafa] px-3 text-[13px]" />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setShared(null)}>Đóng</Button>
              <Button variant="secondary" onClick={() => window.open(shared.url, "_blank", "noopener")}>Mở thử</Button>
              <Button onClick={async () => { try { await navigator.clipboard.writeText(shared.url); toast("Đã sao chép link"); } catch { toast("Không sao chép được — hãy chọn và sao chép link", "err"); } }}>Sao chép link</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
