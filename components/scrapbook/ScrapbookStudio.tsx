"use client";

/* Trang "CD Scrapbook" (/thiet-ke/scrapbook): khách tải ảnh → chọn 1 mẫu mặt đĩa kiểu scrapbook xé dán.
   Trái 36%: 3 tab Ảnh (ảnh của bạn — đang dùng / chưa dùng, thêm ô ảnh, tất cả mẫu 5–10 ảnh chia nhóm) · Sticker (thư viện +
   sticker của bạn) · Chữ (font thường / chữ cắt dán). Bấm 1 mẫu = chép toàn bộ lớp của mẫu thành thiết kế của khách (độc lập với mẫu);
   thêm / xoá ảnh không tự đổi mẫu. Phải: mặt đĩa — sửa tự do (lib/scrapbook + SurfaceView). Ảnh khách chỉ xử lý trên trình duyệt. */
import { confirmDialog } from "@/components/ui/dialog";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/pangolin/400.css";
import "@fontsource/itim/400.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/700.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/400-italic.css";
import "@fontsource/be-vietnam-pro/700-italic.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Dices, Download, Image as ImageIcon, ShoppingBag } from "lucide-react";
import { GRADIENTS, paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import type { MockupBackground } from "@/lib/mockup/types";
import { defaultGlass } from "@/lib/mockup/types";
import { renderSystem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { saveBlob } from "@/lib/imageTools";
import { savePendingDisc } from "@/lib/scrapbook/pending";
import { loadFonts, renderSurface } from "@/lib/scrapbook/render";
import { discTemplates } from "@/lib/scrapbook/catalog";
import { autoDecorate } from "@/lib/scrapbook/generate";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import { MAX_PHOTOS, MIN_PHOTOS, PRINT_PX, STYLES, type Frame, type FrameSet, type ScrapAsset, type Template, type TemplateSetting, type CustomTemplate, type Wish, type WishTopic } from "@/lib/scrapbook/types";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import { BgPicker } from "@/components/mockup-viewer/BgPicker";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { ScrapbookEditor, type EditorTab } from "./ScrapbookEditor";
import { TemplateGallery, type GalleryGroup } from "./TemplateGallery";
import { PhotoPanel, type Photo } from "./parts";
import { setFrameLibrary } from "@/lib/scrapbook/decor";
import { customizeText, useScrapStudio } from "./useScrapStudio";
import { clone } from "./useScrapDoc";

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));
const NO_EXTRA = {};
/** chép mẫu thành thiết kế của khách: ô ảnh thứ i ← ảnh thứ i của khách (thiếu thì ô trống "+") */
export const fromTemplate = (t: Template, photos: { id: string }[]): Template => ({ ...clone(t), layers: clone(t.layers).map((l) => (l.k === "photo" ? { ...l, photo: photos[l.slot]?.id ?? "" } : l)) });

export function ScrapbookStudio({ assets, settings, customs = [], fonts, glyphs, frames, frameSets, stickerCfg, topics, wishes, backgrounds, boxPackageId }: {
  assets: ScrapAsset[]; settings: TemplateSetting[]; customs?: CustomTemplate[]; fonts: CutoutFont[]; glyphs: Glyph[]; frames: Frame[]; frameSets: FrameSet[]; stickerCfg: StickerCfg;
  topics: WishTopic[]; wishes: Wish[]; backgrounds: MockupBackground[]; boxPackageId: string | null;
}) {
  const T = topics.length ? topics : DEFAULT_TOPICS, W = wishes.length ? wishes : DEFAULT_WISHES;
  setStickerConfig(stickerCfg); // cài đặt sticker tự rải của admin (trước khi sinh mẫu)
  setFrameLibrary(frameSets); // tên bộ khung → ưu tiên khung hợp phong cách
  const router = useRouter();
  const [tab, setTab] = useState<EditorTab>("anh");
  const [guides, setGuides] = useState(true);
  const [boxView, setBoxView] = useState(false);
  const [bg, setBg] = useState<BgChoice>({ kind: "gradient", g: GRADIENTS[0] });
  const [busy, setBusy] = useState(false);
  const st = useScrapStudio({
    prefix: "scrapbook", max: MAX_PHOTOS, assets, frames, fonts, glyphs, defaultText: { main: "Happy Birthday", sub: "" }, extra: NO_EXTRA, wantAllFonts: tab === "chu",
    // bản nháp cũ: mẫu đã sửa (work) → thiết kế, ô ảnh theo thứ tự ảnh
    onLoad: (meta, list) => (meta.work ? [fromTemplate(meta.work, list)] : undefined),
  });
  const { doc, photos } = st;


  // ---------- mẫu: tất cả mẫu 5–10 ảnh ----------
  const { templates: all, labels } = useMemo(() => discTemplates(settings, customs, assets, frames), [settings, customs, assets, frames]);
  const fit = Math.min(MAX_PHOTOS, Math.max(MIN_PHOTOS, photos.length));
  const samples = useMemo(() => samplePhotos(), []);
  const thumbPhotos = useMemo(() => Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i]?.img ?? samples[i]), [photos, samples]);
  const pKey = photos.map((p) => p.id).join(",");
  const groups: GalleryGroup[] = useMemo(() => Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => MIN_PHOTOS + i).map((n) => ({
    id: String(n), title: `${n} ảnh`, chip: String(n), match: photos.length > 0 && n === fit,
    items: all.filter((t) => t.n === n).map((t) => ({
      id: t.id, label: labels[t.id] ?? STYLES.find((s) => s.id === t.style)?.name ?? t.style, key: `${t.id}|${pKey}|${st.text.main}|${Object.keys(st.assetImgs).length}|${Object.keys(st.frameImgs).length}`,
      make: () => renderSurface({ template: t, photos: thumbPhotos, text: st.text, assets: st.renderOpts.assets, frames: st.frameImgs, size: 200 }).canvas.toDataURL("image/jpeg", 0.85),
    })),
  })), [all, labels, fit, photos.length, pKey, thumbPhotos, st.text, st.assetImgs, st.frameImgs, st.renderOpts.assets]);
  const apply = useCallback(async (id: string, list: Photo[], ask = true) => {
    const t = all.find((x) => x.id === id);
    if (!t) return;
    if (ask && st.D.edited && !(await confirmDialog({ title: "Đổi sang mẫu này?", message: "Bố cục hiện tại sẽ được thay bằng mẫu mới. Sticker và chữ bạn tự thêm vẫn được giữ.", confirmText: "Đổi mẫu" }))) return;
    const mine = st.doc?.[0]?.layers.filter((l) => l.user && l.k !== "photo") ?? [];
    const d = customizeText(fromTemplate(t, list), st.text); // chữ của mẫu → lớp chữ thường (bấm để sửa)
    st.D.begin(); st.D.setDoc([{ ...d, layers: [...d.layers, ...mine] }]); st.D.setEdited(false); st.setApplied(id); st.setSel(null); st.setEditLayer(null);
  }, [all, st]);
  // lần đầu tải ảnh (chưa áp mẫu nào): tự áp mẫu đầu tiên của nhóm khớp số ảnh
  useEffect(() => {
    if (st.ready && !doc && photos.length) { const t = all.find((x) => x.n === fit); if (t) apply(t.id, photos, false); }
  }, [st.ready, doc, photos, all, fit, apply]);
  function shuffle() {
    if (!doc) return;
    st.D.begin(); st.D.patchSurface(0, (t) => autoDecorate(t, Math.floor(Math.random() * 1e6), assets)); st.setSel(null);
  }
  async function restore() {
    if (!st.applied) return;
    if (!(await confirmDialog({ title: "Khôi phục mẫu gốc?", message: "Các chỉnh sửa, sticker và chữ bạn đã thêm sẽ bị bỏ. Ảnh bạn đã tải vẫn được giữ.", confirmText: "Khôi phục", danger: true }))) return;
    const t = all.find((x) => x.id === st.applied);
    if (!t) return;
    st.D.begin(); st.D.setDoc([customizeText(fromTemplate(t, photos), st.text)]); st.D.setEdited(false); st.setSel(null);
  }

  // ---------- xem trong hộp: "Một món" = đĩa to ở giữa trên nền đang chọn, có bóng ----------
  const mockupCanvas = useCallback(async (N: number) => {
    if (!doc) return null;
    await loadSprites();
    const disc = renderSurface({ template: doc[0], ...st.renderOpts, size: Math.min(PRINT_PX, N * 0.6), mode: "print" }).canvas;
    return renderSystem(N, { pack: "box", disc: disc as unknown as HTMLImageElement, pages: [] },
      { arrange: "single", single: "disc", seed: 1, tray: "clear", glass: defaultGlass }, (ctx, w, h) => paintBackground(ctx, w, h, bg));
  }, [doc, st.renderOpts, bg]);
  const [boxUrl, setBoxUrl] = useState("");
  useEffect(() => {
    if (!boxView) return;
    let off = false;
    mockupCanvas(1200).then((c) => { if (!off && c) setBoxUrl(c.toDataURL("image/jpeg", 0.9)); });
    return () => { off = true; };
  }, [boxView, mockupCanvas]);

  // ---------- xuất file / đặt in ----------
  const printBlob = async () => {
    if (!doc) throw new Error("Tải ảnh và chọn mẫu trước");
    await loadFonts();
    return toBlob(renderSurface({ template: doc[0], ...st.renderOpts, size: PRINT_PX, mode: "print" }).canvas, "image/png");
  };
  async function downloadPrint() {
    setBusy(true);
    try { saveBlob(await printBlob(), "Mat-dia-Scrapbook-12x12cm-300dpi.png"); toast("Đã tải xuống"); } catch (e) { toast(e instanceof Error ? e.message : "Xuất file thất bại", "err"); }
    setBusy(false);
  }
  async function downloadMockup() {
    setBusy(true);
    try { const c = await mockupCanvas(2400); if (!c) throw new Error("Tải ảnh và chọn mẫu trước"); saveBlob(await toBlob(c, "image/jpeg", 0.92), "Mockup-CD-Scrapbook.jpg"); toast("Đã tải xuống"); }
    catch (e) { toast(e instanceof Error ? e.message : "Xuất ảnh thất bại", "err"); }
    setBusy(false);
  }
  async function order() {
    if (!doc) return toast("Tải ảnh và chọn mẫu trước", "err");
    setBusy(true);
    try {
      await savePendingDisc(await printBlob());
      router.push(`/san-pham/in-cd-theo-yeu-cau${boxPackageId ? `?goi=${encodeURIComponent(boxPackageId)}` : ""}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Không tạo được file in", "err"); setBusy(false); }
  }

  return (
    <ScrapbookEditor mode="customer" st={st} assets={assets} frames={frames} frameSets={frameSets} fonts={fonts} topics={T} wishes={W} tab={tab} setTab={setTab}
      guides={guides} setGuides={setGuides} onRestore={restore} canRestore={!!st.applied && !!doc} maxW="max-w-[1200px]"
      toolbar={<Toggle checked={boxView} onChange={(v) => { setBoxView(v); st.setEditLayer(null); st.setSel(null); }} label="Xem trong hộp" />}
      empty={<div className="grid aspect-square w-full max-w-[420px] place-items-center rounded-full border-[1.5px] border-dashed border-[#d4d4d8] bg-white text-center text-[14px] text-[#71717a]"><span><ImageIcon size={24} className="mx-auto mb-2" />Tải lên {MIN_PHOTOS}–{MAX_PHOTOS} ảnh<br />để web tự làm mặt đĩa scrapbook</span></div>}
      overlay={boxView && doc ? (boxUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={boxUrl} alt="Mặt đĩa trên nền" className="max-h-full max-w-full rounded-[12px] border border-[#e5e5e7]" />
        : <p className="text-[13px] text-[#71717a]">Đang dựng...</p>) : undefined}
      photoTab={(
        <>
          <PhotoPanel photos={photos} used={st.used} max={MAX_PHOTOS} hint={`JPG, PNG, HEIC · ${MIN_PHOTOS} đến ${MAX_PHOTOS} ảnh · ảnh chỉ xử lý trên máy bạn`}
            onAdd={(f) => { st.addFiles(f); }} onReplace={st.replacePhoto} onRemove={st.removePhoto} onReorder={st.reorderPhotos} />
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-[#18181b]">Chọn mẫu</p>
              {doc && <button type="button" onClick={shuffle} title="Rải lại sticker" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /> Xáo trộn</button>}
            </div>
            <TemplateGallery groups={groups} current={st.applied} onPick={(id) => apply(id, photos)} round />
          </section>
        </>
      )}
      bottom={(
        <div className="flex h-14 shrink-0 items-center gap-3 border-t border-[#efeff1] bg-[#f7f7f8] px-4">
          <div className="min-w-0 flex-1"><BgPicker value={bg} onChange={setBg} shop={backgrounds} /></div>
          <DownloadMenu busy={busy} up items={[
            { label: "File in mặt đĩa (PNG 300 DPI)", icon: <Download size={16} />, onClick: downloadPrint },
            { label: "Ảnh mockup (JPG)", icon: <Box size={16} />, onClick: downloadMockup },
          ]} />
          <Button size="sm" icon={<ShoppingBag size={16} />} onClick={order} disabled={!doc || busy}>Đặt in CD này</Button>
        </div>
      )} />
  );
}
