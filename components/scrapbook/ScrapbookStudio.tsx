"use client";

/* Trang "CD Template" (/thiet-ke/cd-template): mở ra là mặt đĩa TRẮNG. Cột công cụ: Mẫu (mẫu cố định của admin, nhóm theo
   danh mục) · Ảnh · Sticker · Chữ · Nền. Chọn mẫu trước hoặc tải ảnh trước đều được: áp mẫu = thay toàn bộ thiết kế (hỏi lại nếu
   đã chỉnh), điền ảnh đã tải vào các ô theo thứ tự (thiếu ảnh → ô "+", dư ảnh → ở lại danh sách); tải thêm ảnh → tự điền ô trống.
   Không rải sticker ngẫu nhiên. Ảnh khách chỉ xử lý trên trình duyệt. */
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
import { Box, Download, ShoppingBag } from "lucide-react";
import { GRADIENTS, paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import type { MockupBackground } from "@/lib/mockup/types";
import { defaultGlass } from "@/lib/mockup/types";
import { renderSystem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { saveBlob } from "@/lib/imageTools";
import { savePendingDisc } from "@/lib/scrapbook/pending";
import { loadFonts, renderSurface } from "@/lib/scrapbook/render";
import { blankTemplate, fillDoc, fillSlots, libTemplate, type DesignTpl, type Library } from "@/lib/scrapbook/library";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import { PRINT_PX, type AssetGroupRow, type Frame, type FrameSet, type ScrapAsset, type Template, type Wish, type WishTopic } from "@/lib/scrapbook/types";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import { BgPicker } from "@/components/mockup-viewer/BgPicker";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { ScrapbookEditor, type EditorTab } from "./ScrapbookEditor";
import { LibraryGrid } from "./LibraryGrid";
import { PhotoPanel } from "./parts";
import { setFrameLibrary } from "@/lib/scrapbook/decor";
import { customizeText, useScrapStudio } from "./useScrapStudio";
import { clone } from "./useScrapDoc";

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));
const NO_EXTRA = {};
/** chép mẫu thành thiết kế của khách: ô ảnh thứ i ← ảnh thứ i của khách (thiếu thì ô trống "+") */
export const fromTemplate = (t: Template, photos: { id: string }[]): Template => ({ ...clone(t), layers: clone(t.layers).map((l) => (l.k === "photo" ? { ...l, photo: photos[l.slot]?.id ?? "" } : l)) });

const MAX = 30; // số ảnh tối đa (mẫu có bao nhiêu ô cũng được)
export function ScrapbookStudio({ assets, assetGroups = [], library, fonts, glyphs, frames, frameSets, topics, wishes, backgrounds, boxPackageId, kind = "cd" }: {
  assets: ScrapAsset[]; assetGroups?: AssetGroupRow[]; library: Library; fonts: CutoutFont[]; glyphs: Glyph[]; frames: Frame[]; frameSets: FrameSet[];
  topics: WishTopic[]; wishes: Wish[]; backgrounds: MockupBackground[]; boxPackageId: string | null;
  /** cd = CD Template (mặt đĩa) · back = Back cover Template (bìa sau 15 × 11,7 cm) */
  kind?: "cd" | "back";
}) {
  const isBack = kind === "back";
  const T = topics.length ? topics : DEFAULT_TOPICS, W = wishes.length ? wishes : DEFAULT_WISHES;
  setFrameLibrary(frameSets);
  const router = useRouter();
  const [tab, setTab] = useState<EditorTab>("mau");
  const [guides, setGuides] = useState(true);
  const [boxView, setBoxView] = useState(false);
  const [bg, setBg] = useState<BgChoice>({ kind: "gradient", g: GRADIENTS[0] });
  const [busy, setBusy] = useState(false);
  const st = useScrapStudio({
    prefix: isBack ? "scrapbook-back" : "scrapbook", max: MAX, assets, frames, fonts, glyphs, defaultText: { main: "Happy Birthday", sub: "" }, extra: NO_EXTRA, wantAllFonts: tab === "chu",
    // bản nháp cũ: mẫu đã sửa (work) → thiết kế, ô ảnh theo thứ tự ảnh
    onLoad: (meta, list) => (meta.work ? [fromTemplate(meta.work, list)] : undefined),
  });
  const { doc, photos } = st;


  // ---------- mặt đĩa trắng khi chưa có thiết kế ----------
  useEffect(() => { if (st.ready && !doc) { st.D.setDoc([blankTemplate(kind)]); st.D.reset(); st.D.setEdited(false); } }, [st.ready, doc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- mẫu cố định của admin ----------
  const tpls = library.templates;
  const dirty = () => !!doc && (st.D.edited || st.D.canUndo || doc.some((t) => t.layers.length > 0));
  const apply = useCallback(async (d: DesignTpl) => {
    if (dirty() && !(await confirmDialog({ title: "Áp mẫu này?", message: "Toàn bộ thiết kế hiện tại (sticker, chữ, ô ảnh) sẽ được thay bằng mẫu. Ảnh bạn đã tải vẫn được giữ và tự điền vào các ô của mẫu.", confirmText: "Áp mẫu" }))) return;
    const t = customizeText(fillSlots(libTemplate(d), photos.map((p) => p.id)).t, st.text);
    st.D.begin(); st.D.setDoc([t]); st.D.setEdited(false); st.setApplied(d.id); st.setSel(null); st.setEditLayer(null);
  }, [st, photos]); // eslint-disable-line react-hooks/exhaustive-deps
  async function restore() {
    const d = tpls.find((x) => x.id === st.applied);
    if (!d) return;
    if (!(await confirmDialog({ title: "Khôi phục mẫu gốc?", message: "Các chỉnh sửa, sticker và chữ bạn đã thêm sẽ bị bỏ. Ảnh bạn đã tải vẫn được giữ.", confirmText: "Khôi phục", danger: true }))) return;
    st.D.begin(); st.D.setDoc([customizeText(fillSlots(libTemplate(d), photos.map((p) => p.id)).t, st.text)]); st.D.setEdited(false); st.setSel(null);
  }
  /** tải ảnh → tự điền vào các ô trống theo thứ tự */
  async function addPhotos(f: File[]) {
    const out = await st.addFiles(f);
    if (out.length) st.D.setDoc((d) => d && fillDoc(d, out.map((p) => p.id)));
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
    if (!doc) throw new Error("Chưa có thiết kế");
    await loadFonts();
    if (isBack) return toBlob(renderSurface({ template: doc[0], ...st.renderOpts, size: Math.round((150 / 25.4) * 300), mode: "print" }).canvas, "image/png"); // bìa sau 15 cm, 300 dpi
    return toBlob(renderSurface({ template: doc[0], ...st.renderOpts, size: PRINT_PX, mode: "print", fullDisc: true }).canvas, "image/png"); // không khoét lỗ giữa
  };
  async function downloadPrint() {
    setBusy(true);
    try { saveBlob(await printBlob(), isBack ? "Bia-sau-15x11.7cm-300dpi.png" : "Mat-dia-CD-Template-12x12cm-300dpi.png"); toast("Đã tải xuống"); } catch (e) { toast(e instanceof Error ? e.message : "Xuất file thất bại", "err"); }
    setBusy(false);
  }
  async function downloadMockup() {
    setBusy(true);
    try { const c = await mockupCanvas(2400); if (!c) throw new Error("Chưa có thiết kế"); saveBlob(await toBlob(c, "image/jpeg", 0.92), "Mockup-CD-Template.jpg"); toast("Đã tải xuống"); }
    catch (e) { toast(e instanceof Error ? e.message : "Xuất ảnh thất bại", "err"); }
    setBusy(false);
  }
  async function order() {
    if (!doc) return toast("Chưa có thiết kế", "err");
    setBusy(true);
    try {
      await savePendingDisc(await printBlob());
      router.push(`/san-pham/in-cd-theo-yeu-cau${boxPackageId ? `?goi=${encodeURIComponent(boxPackageId)}` : ""}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Không tạo được file in", "err"); setBusy(false); }
  }

  return (
    <ScrapbookEditor mode="customer" st={st} assets={assets} assetGroups={assetGroups} frames={frames} frameSets={frameSets} fonts={fonts} topics={T} wishes={W} tab={tab} setTab={setTab}
      guides={guides} setGuides={setGuides}
      toolbar={isBack ? undefined : <Toggle checked={boxView} onChange={(v) => { setBoxView(v); st.setEditLayer(null); st.setSel(null); }} label="Xem trong hộp" />}
      overlay={boxView && doc ? (boxUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={boxUrl} alt="Mặt đĩa trên nền" className="max-h-full max-w-full rounded-[12px] border border-[#e5e5e7]" />
        : <p className="text-[13px] text-[#71717a]">Đang dựng...</p>) : undefined}
      templateTab={(
        <section className="space-y-3">
          <p className="text-[12px] text-[#71717a]">Chọn 1 mẫu — ảnh bạn đã tải tự điền vào các ô theo thứ tự. Chọn mẫu trước rồi tải ảnh sau cũng được.</p>
          <LibraryGrid items={tpls} cats={library.categories} current={st.applied} onPick={apply} round={!isBack} cols={isBack ? 2 : 3} aspect={isBack ? "aspect-[150/117]" : undefined} />
        </section>
      )}
      photoTab={(
        <PhotoPanel photos={photos} used={st.used} max={MAX} hint="JPG, PNG, HEIC · ảnh chỉ xử lý trên máy bạn · tự điền vào ô trống của mẫu"
          onAdd={(f) => { addPhotos(f); }} onReplace={st.replacePhoto} onRemove={st.removePhoto} onReorder={st.reorderPhotos} />
      )}
      bottom={(
        <div className="flex h-14 shrink-0 items-center gap-3 border-t border-[#efeff1] bg-[#f7f7f8] px-4">
          <span className="flex-1" />
          <Button size="sm" variant="secondary" icon={<Download size={16} />} onClick={downloadPrint} loading={busy}>Tải file in (PNG)</Button>
          {isBack ? <Button size="sm" icon={<ShoppingBag size={16} />} href="/dat-don">Đặt in</Button>
            : <Button size="sm" icon={<ShoppingBag size={16} />} onClick={order} disabled={!doc || busy}>Đặt in CD này</Button>}
        </div>
      )} />
  );
}
