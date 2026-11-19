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
import { Box, Dices, Download, Image as ImageIcon, Redo2, RotateCcw, ShoppingBag, Undo2 } from "lucide-react";
import { GRADIENTS, paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import type { MockupBackground } from "@/lib/mockup/types";
import { defaultGlass } from "@/lib/mockup/types";
import { renderSystem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { saveBlob } from "@/lib/imageTools";
import { savePendingDisc } from "@/lib/scrapbook/pending";
import { loadFonts, renderSurface } from "@/lib/scrapbook/render";
import { templatesFor } from "@/lib/scrapbook/templates";
import { autoDecorate } from "@/lib/scrapbook/generate";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import { MAX_PHOTOS, MIN_PHOTOS, PRINT_PX, STYLES, type Frame, type FrameSet, type ScrapAsset, type Template, type TemplateSetting, type Wish, type WishTopic } from "@/lib/scrapbook/types";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import { BgPicker } from "@/components/mockup-viewer/BgPicker";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { useFitBox } from "@/components/mockup-viewer/useFitBox";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { StickerTab } from "./StickerTab";
import { TextTab } from "./TextTab";
import { SurfaceView } from "./SurfaceView";
import { TemplateGallery, type GalleryGroup } from "./TemplateGallery";
import { PhotoPanel, PickPhotoModal, type Photo } from "./parts";
import { AddFrameFlow, FramePicker } from "./FramePicker";
import { setFrameLibrary } from "@/lib/scrapbook/decor";
import { UserStickerModal } from "./UserStickerModal";
import { customizeText, useScrapStudio } from "./useScrapStudio";
import { clone } from "./useScrapDoc";

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));
const NO_EXTRA = {};
/** chép mẫu thành thiết kế của khách: ô ảnh thứ i ← ảnh thứ i của khách (thiếu thì ô trống "+") */
export const fromTemplate = (t: Template, photos: { id: string }[]): Template => ({ ...clone(t), layers: clone(t.layers).map((l) => (l.k === "photo" ? { ...l, photo: photos[l.slot]?.id ?? "" } : l)) });

export function ScrapbookStudio({ assets, settings, fonts, glyphs, frames, frameSets, stickerCfg, topics, wishes, backgrounds, boxPackageId }: {
  assets: ScrapAsset[]; settings: TemplateSetting[]; fonts: CutoutFont[]; glyphs: Glyph[]; frames: Frame[]; frameSets: FrameSet[]; stickerCfg: StickerCfg;
  topics: WishTopic[]; wishes: Wish[]; backgrounds: MockupBackground[]; boxPackageId: string | null;
}) {
  const T = topics.length ? topics : DEFAULT_TOPICS, W = wishes.length ? wishes : DEFAULT_WISHES;
  setStickerConfig(stickerCfg); // cài đặt sticker tự rải của admin (trước khi sinh mẫu)
  setFrameLibrary(frameSets); // tên bộ khung → ưu tiên khung hợp phong cách
  const router = useRouter();
  const [tab, setTab] = useState<"anh" | "sticker" | "chu">("anh");
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

  // chọn 1 lớp chữ trên trang → mở tab Chữ (hiện Cài đặt chữ)
  useEffect(() => { if (st.sel !== null && st.isTextLayer(st.L[st.sel])) setTab("chu"); }, [st.sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const { area, width } = useFitBox(1);

  // ---------- mẫu: tất cả mẫu 5–10 ảnh ----------
  const all = useMemo(() => Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => templatesFor(MIN_PHOTOS + i, settings, assets, {}, false, frames)).flat(), [settings, assets, frames]);
  const fit = Math.min(MAX_PHOTOS, Math.max(MIN_PHOTOS, photos.length));
  const samples = useMemo(() => samplePhotos(), []);
  const thumbPhotos = useMemo(() => Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i]?.img ?? samples[i]), [photos, samples]);
  const pKey = photos.map((p) => p.id).join(",");
  const groups: GalleryGroup[] = useMemo(() => Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => MIN_PHOTOS + i).map((n) => ({
    id: String(n), title: `${n} ảnh`, chip: String(n), match: photos.length > 0 && n === fit,
    items: all.filter((t) => t.n === n).map((t) => ({
      id: t.id, label: STYLES.find((s) => s.id === t.style)?.name ?? t.style, key: `${t.id}|${pKey}|${st.text.main}|${Object.keys(st.assetImgs).length}|${Object.keys(st.frameImgs).length}`,
      make: () => renderSurface({ template: t, photos: thumbPhotos, text: st.text, assets: st.renderOpts.assets, frames: st.frameImgs, size: 200 }).canvas.toDataURL("image/jpeg", 0.85),
    })),
  })), [all, fit, photos.length, pKey, thumbPhotos, st.text, st.assetImgs, st.frameImgs, st.renderOpts.assets]);
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

  const tabBtn = (id: typeof tab, label: string) => (
    <button key={id} type="button" onClick={() => { setTab(id); if (id !== "chu" && st.sel !== null && st.isTextLayer(st.L[st.sel])) { st.setEditText(null); st.setSel(null); } }} className={cx("flex-1 rounded-[8px] px-3 py-1.5 text-[13px] font-medium", tab === id ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]")}>{label}</button>
  );
  const t0 = doc?.[0];
  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col md:min-h-0 md:flex-row md:border-x md:border-[#e5e5e7]">
      {/* ---------- Trái 36%: 3 tab ---------- */}
      <aside className="order-2 space-y-5 border-[#e5e5e7] bg-white p-6 md:order-1 md:w-[36%] md:min-w-[360px] md:shrink-0 md:overflow-y-auto md:border-r">
        <div className="flex rounded-[10px] border border-[#e5e5e7] p-1">{tabBtn("anh", "Ảnh")}{tabBtn("sticker", "Sticker")}{tabBtn("chu", "Chữ")}</div>

        {tab === "anh" && (
          <>
            <button type="button" onClick={() => (doc ? st.setAddSlotOpen(true) : toast("Tải ảnh và chọn mẫu trước khi thêm khung ảnh.", "err"))}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#ff5fa2] text-[14px] font-semibold text-white hover:bg-[#f0468f]">+ Thêm khung ảnh</button>
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
        {tab === "sticker" && (
          <StickerTab assets={assets} onAdd={(a) => st.addAsset(a)} mine={st.ustickers.map((s) => ({ id: s.id, url: s.url }))}
            onUpload={(f) => st.setStickerFiles(f)} onAddMine={(id) => st.addAsset(`u:${id}`)} onRemoveMine={st.removeUserSticker} />
        )}
        {tab === "chu" && (
          <TextTab layer={st.sel !== null && st.isTextLayer(st.L[st.sel]) ? st.L[st.sel] : null} fonts={fonts} previews={st.fontPreviews} colors={st.colors} onCustomColor={st.addColor}
            onPaper={() => { if (st.sel !== null) st.wishToText(st.sel); }} onAdd={() => st.addText()}
            onPatch={(v) => { if (st.sel !== null) st.patchLayer(st.sel, v); }} onBegin={st.D.begin} onDuplicate={() => { if (st.sel !== null) st.duplicate(st.sel); }} onRemove={() => { if (st.sel !== null) st.removeLayer(st.sel); }}
            topics={T} wishes={W} onWish={st.addWish} wishOpen={st.wishOpen} onWishOpen={st.setWishOpen} />
        )}
      </aside>

      {/* ---------- Phải: mặt đĩa ---------- */}
      <section className="relative order-1 flex min-h-[420px] min-w-0 flex-1 flex-col md:order-2 md:min-h-0 md:overflow-hidden">
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 pt-3 md:absolute md:inset-x-0 md:top-0 md:z-10">
          <button type="button" onClick={() => { if (st.D.undo()) st.setSel(null); }} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác" className="grid h-8 w-8 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!st.D.canUndo}><Undo2 size={14} /></button>
          <button type="button" onClick={() => { if (st.D.redo()) st.setSel(null); }} title="Làm lại (Ctrl+Shift+Z)" aria-label="Làm lại" className="grid h-8 w-8 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!st.D.canRedo}><Redo2 size={14} /></button>
          <button type="button" onClick={restore} disabled={!st.applied || !doc} className="inline-flex h-8 items-center gap-1 rounded-full border border-[#e5e5e7] bg-white px-3 text-[12px] font-medium disabled:opacity-40"><RotateCcw size={13} /> Khôi phục mẫu</button>
          <span className="flex-1" />
          <Toggle checked={guides} onChange={setGuides} label="Hiển thị guideline" />
          <Toggle checked={boxView} onChange={(v) => { setBoxView(v); st.setEditLayer(null); st.setSel(null); }} label="Xem trong hộp" />
        </div>
        <div ref={area} className="relative flex min-h-[300px] flex-1 items-center justify-center p-4 md:absolute md:inset-x-6 md:bottom-[72px] md:top-14 md:p-0">
          {!t0 ? (
            <div className="grid aspect-square w-full max-w-[420px] place-items-center rounded-full border-[1.5px] border-dashed border-[#d4d4d8] bg-white text-center text-[14px] text-[#71717a]">
              <span><ImageIcon size={24} className="mx-auto mb-2" />Tải lên {MIN_PHOTOS}–{MAX_PHOTOS} ảnh<br />để web tự làm mặt đĩa scrapbook</span>
            </div>
          ) : boxView ? (
            // eslint-disable-next-line @next/next/no-img-element
            boxUrl ? <img src={boxUrl} alt="Mặt đĩa trên nền" className="max-h-full max-w-full rounded-[12px] border border-[#e5e5e7]" style={{ width: width || undefined }} /> : <p className="text-[13px] text-[#71717a]">Đang dựng...</p>
          ) : st.ready && (
            <SurfaceView t={t0} width={width || 400} render={st.renderOpts} guides={guides} sel={st.sel} onSel={st.setSel} editLayer={st.editLayer} onEditLayer={st.setEditLayer}
              begin={st.D.begin} setLayers={st.setLayers} adjustOf={(id) => st.adjust[id]} setAdjust={(id, a) => st.setAdjust((c) => ({ ...c, [id]: a }))}
              onDropAsset={(id, at) => { if (id.startsWith("u:") || id.startsWith("f:")) st.addAsset(id, at); else { const a = assets.find((x) => x.id === id); if (a) st.addAsset(a, at); } }}
              onDropPhoto={(pid, i) => st.assignPhoto(0, i, pid)} onEmptySlot={(i) => st.setPickFor(i)} editText={st.editText} onEditText={(i) => st.setEditText(i)} selectAllText={st.selectAll} textValue={st.textValue} onTextValue={st.setTextValue} tools={st.tools} />
          )}
        </div>
        <div className="flex h-16 shrink-0 items-center gap-3 border-t border-[#efeff1] bg-[#f7f7f8] px-4 md:absolute md:inset-x-0 md:bottom-0 md:border-0">
          <div className="min-w-0 flex-1"><BgPicker value={bg} onChange={setBg} shop={backgrounds} /></div>
          <DownloadMenu busy={busy} up items={[
            { label: "File in mặt đĩa (PNG 300 DPI)", icon: <Download size={16} />, onClick: downloadPrint },
            { label: "Ảnh mockup (JPG)", icon: <Box size={16} />, onClick: downloadMockup },
          ]} />
          <Button size="sm" icon={<ShoppingBag size={16} />} onClick={order} disabled={!doc || busy}>Đặt in CD này</Button>
        </div>
      </section>
     </div>
      {st.pickFor !== null && (
        <PickPhotoModal photos={photos} used={st.used} onClose={() => st.setPickFor(null)}
          onPick={(pid) => { st.assignPhoto(st.active, st.pickFor!, pid); st.setPickFor(null); }}
          onUpload={async (f) => { const i = st.pickFor!; const [p] = await st.addFiles([f]); if (p) st.assignPhoto(st.active, i, p.id); st.setPickFor(null); }} />
      )}
      {st.frameFor !== null && st.L[st.frameFor]?.k === "photo" && (
        <FramePicker frames={frames} sets={frameSets} loaded={st.frameImgs} title="Đổi khung" current={(st.L[st.frameFor] as { frame?: string }).frame ?? null} onPick={(c) => st.setFrame(st.frameFor!, c)} onClose={() => st.setFrameFor(null)} />
      )}
      {st.addSlotOpen && (
        <AddFrameFlow frames={frames} sets={frameSets} loaded={st.frameImgs} photos={photos} used={st.used} onClose={() => st.setAddSlotOpen(false)}
          onDone={(c, pid) => st.addSlot(c, pid)} onUpload={async (f) => { const [p] = await st.addFiles([f]); return p?.id ?? null; }} />
      )}
      {st.stickerFiles && <UserStickerModal files={st.stickerFiles} onAdd={(b) => st.addUserSticker(b)} onClose={() => st.setStickerFiles(null)} />}
    </div>
  );
}
