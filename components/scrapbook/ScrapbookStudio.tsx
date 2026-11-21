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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import { useRouter } from "next/navigation";
import { Box, Download, Save, ShoppingBag } from "lucide-react";
import { GRADIENTS, paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import type { MockupBackground } from "@/lib/mockup/types";
import { defaultGlass } from "@/lib/mockup/types";
import { renderSystem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { saveBlob, saveZip } from "@/lib/imageTools";
import { cx } from "@/components/ui/styles";
import { loadFonts, renderSurface } from "@/lib/scrapbook/render";
import { BACK_FACES, backSlots, backTemplate, blankBack, blankTemplate, fillDoc, fillSlots, groupByCategory, libTemplate, type Bundle, type DesignTpl, type Library } from "@/lib/scrapbook/library";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import { PRINT_PX, type AssetGroupRow, type Frame, type FrameSet, type ScrapAsset, type Template, type Wish, type WishTopic } from "@/lib/scrapbook/types";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import { BgPicker } from "@/components/mockup-viewer/BgPicker";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { ScrapbookEditor, type EditorTab } from "./ScrapbookEditor";
import { LibraryGrid, LiveThumb } from "./LibraryGrid";
import { PhotoPanel, readPhoto, type Photo } from "./parts";
import { SaveDesignDialog } from "./SaveDesignDialog";
import { loadScrapFromAccount, saveScrapToAccount, type PrintFile } from "@/lib/scrapbook/account";
import type { PrintRef } from "@/lib/designs";
import { hasSupabase } from "@/lib/supabase/env";
import { setFrameLibrary } from "@/lib/scrapbook/decor";
import { customizeText, usedStickers, useScrapStudio, type UserSticker } from "./useScrapStudio";
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
  // bìa sau: số mặt (1 = mặt ngoài · 2 = mặt ngoài + mặt trong, mặc định 2) · mục Mẫu đang xem bộ mẫu 2 mặt?
  const [faces, setFaces] = useState(2);
  const [bundleMode, setBundleMode] = useState(false);
  const extra = useMemo(() => (isBack ? { faces } : NO_EXTRA), [isBack, faces]);
  const st = useScrapStudio({
    prefix: isBack ? "scrapbook-back" : "scrapbook", max: MAX, assets, frames, fonts, glyphs, defaultText: { main: "Happy Birthday", sub: "" }, extra, wantAllFonts: tab === "chu",
    // bản nháp cũ: mẫu đã sửa (work) → thiết kế, ô ảnh theo thứ tự ảnh
    onLoad: (meta, list) => { if (isBack) { if (meta.faces === 1 || meta.faces === 2) setFaces(meta.faces); return undefined; } return meta.work ? [fromTemplate(meta.work, list)] : undefined; },
  });
  const { doc, photos } = st;


  // ---------- mặt đĩa trắng khi chưa có thiết kế ----------
  useEffect(() => { if (st.ready && !doc) { st.D.setDoc(isBack ? blankBack(faces) : [blankTemplate(kind)]); st.D.reset(); st.D.setEdited(false); } }, [st.ready, doc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- mẫu cố định của admin ----------
  const tpls = library.templates;
  const dirty = () => !!doc && (st.D.edited || st.D.canUndo || doc.some((t) => t.layers.length > 0));
  const apply = useCallback(async (d: DesignTpl) => {
    if (isBack) { // bìa sau: thay mặt đang chọn (giữ đúng mặt ngoài / mặt trong)
      const i = st.active, t0 = doc?.[i];
      if (!t0) return;
      if (t0.layers.length && !(await confirmDialog({ title: "Thay mặt này bằng mẫu?", message: "Mọi thứ đã thêm trên mặt này sẽ được thay bằng mẫu. Ảnh của mặt này quay về danh sách Ảnh.", confirmText: "Thay mặt" }))) return;
      const freed = new Set(t0.layers.flatMap((l) => (l.k === "photo" && l.photo ? [l.photo] : [])));
      const avail = photos.filter((p) => !st.used.has(p.id) || freed.has(p.id)).map((p) => p.id);
      const next = customizeText(fillSlots(backTemplate(d, t0.side), avail).t, st.text);
      st.setEditText(null); st.setSel(null); st.setEditLayer(null);
      st.D.begin(); st.D.patchSurface(i, () => next); st.D.setEdited(true); st.setApplied(d.id);
      return;
    }
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
  // ---------- bìa sau: số mặt + bộ mẫu 2 mặt ----------
  const bundles = useMemo(() => library.bundles.filter((b) => b.page_count === 2), [library.bundles]);
  const tplById = useMemo(() => new Map(tpls.map((t) => [t.id, t])), [tpls]);
  async function changeFaces(n: number) {
    if (n === faces || !doc) return;
    if (n === 1 && doc[1]?.layers.length && !(await confirmDialog({ title: "Chỉ in 1 mặt?", message: "Thiết kế ở Mặt trong sẽ bị bỏ. Ảnh bạn đã tải vẫn được giữ.", confirmText: "Bỏ mặt trong", danger: true }))) return;
    setFaces(n); st.setSel(null); st.setEditLayer(null); st.setEditText(null);
    st.D.begin(); st.D.setDoc((d) => d && (n === 1 ? d.slice(0, 1) : [d[0], blankBack(2)[1]])); st.setActive(0);
  }
  const applyBundle = useCallback(async (b: Bundle) => {
    if (dirty() && !(await confirmDialog({ title: "Dùng bộ mẫu 2 mặt này?", message: "Cả Mặt ngoài và Mặt trong sẽ được thay bằng bộ mẫu. Ảnh bạn đã tải vẫn được giữ và tự điền vào các ô.", confirmText: "Dùng bộ mẫu" }))) return;
    const next = backSlots(2).map((sl, k) => { const d = tplById.get(b.template_ids[k]); return d ? backTemplate(d, sl.side) : blankBack(2)[k]; });
    st.setEditText(null); st.setSel(null); st.setEditLayer(null);
    st.D.begin(); st.D.setDoc(fillDoc(next, photos.map((p) => p.id)).map((t) => customizeText(t, st.text))); st.D.setEdited(false);
    st.setApplied(b.id); st.setActive(0); setBundleMode(false);
  }, [st, photos, tplById]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const printBlob = async (i = 0) => {
    if (!doc) throw new Error("Chưa có thiết kế");
    await loadFonts();
    if (isBack) return toBlob(renderSurface({ template: doc[i], ...st.renderOpts, size: Math.round((150 / 25.4) * 300), mode: "print" }).canvas, "image/png"); // bìa sau 15 cm, 300 dpi
    return toBlob(renderSurface({ template: doc[0], ...st.renderOpts, size: PRINT_PX, mode: "print", fullDisc: true }).canvas, "image/png"); // không khoét lỗ giữa
  };
  async function downloadPrint() {
    setBusy(true);
    try {
      if (isBack && doc && doc.length > 1) await saveZip([{ name: "1-Bia-sau-mat-ngoai.png", blob: await printBlob(0) }, { name: "2-Bia-sau-mat-trong.png", blob: await printBlob(1) }], "Bia-sau-2-mat-15x11.7cm-300dpi.zip");
      else saveBlob(await printBlob(), isBack ? "Bia-sau-15x11.7cm-300dpi.png" : "Mat-dia-CD-Template-12x12cm-300dpi.png");
      toast("Đã tải xuống");
    } catch (e) { toast(e instanceof Error ? e.message : "Xuất file thất bại", "err"); }
    setBusy(false);
  }
  async function downloadMockup() {
    setBusy(true);
    try { const c = await mockupCanvas(2400); if (!c) throw new Error("Chưa có thiết kế"); saveBlob(await toBlob(c, "image/jpeg", 0.92), "Mockup-CD-Template.jpg"); toast("Đã tải xuống"); }
    catch (e) { toast(e instanceof Error ? e.message : "Xuất ảnh thất bại", "err"); }
    setBusy(false);
  }
  // ---------- Lưu vào "Thiết kế của tôi" (kèm file in — để Tải / Đặt đơn ở đó) · mở lại bằng ?design=<id> ----------
  const [saveOpen, setSaveOpen] = useState(false);
  const [designId, setDesignId] = useState<string | null>(null);
  const paths = useRef<Record<string, string>>({});
  const printsRef = useRef<PrintRef[]>([]);
  const scrapKind = isBack ? "back-scrapbook" : "cd-scrapbook";
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("design");
    if (!st.ready || !id || !hasSupabase) return;
    (async () => {
      const r = await loadScrapFromAccount(id, scrapKind).catch(() => null);
      if (!r) return;
      const ph: Photo[] = [], us: UserSticker[] = [];
      for (const pid of r.data.photoIds) { const b = r.blobs[pid]; if (b) { try { ph.push(await readPhoto(b, "anh.jpg", pid)); } catch { /* bỏ */ } } }
      for (const sid of r.data.stickerIds) { const b = r.blobs[sid]; if (b) { try { const p = await readPhoto(b, "sticker.png", sid); us.push({ id: sid, blob: b, url: p.url, img: p.img }); } catch { /* bỏ */ } } }
      paths.current = r.data.paths ?? {}; printsRef.current = r.data.prints ?? [];
      if (isBack && (r.data.faces === 1 || r.data.faces === 2)) setFaces(r.data.faces);
      setDesignId(id);
      st.hydrate({ photos: ph, stickers: us, text: r.data.text, adjust: r.data.adjust, doc: r.data.doc, applied: r.data.applied, colors: r.data.colors });
    })();
  }, [st.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  async function saveAccount() {
    if (!doc) throw new Error("Chưa có thiết kế");
    const prints: PrintFile[] = [];
    if (isBack) {
      const w = Math.round((150 / 25.4) * 300), h = Math.round((117 / 25.4) * 300);
      for (let i = 0; i < doc.length; i++) prints.push({ kind: "back", page: doc.length > 1 ? i + 1 : null, name: `bia-sau-${i ? "mat-trong" : "mat-ngoai"}.png`, blob: await printBlob(i), w, h });
    } else prints.push({ kind: "disc", page: null, name: "mat-dia.png", blob: await printBlob(), w: PRINT_PX, h: PRINT_PX });
    const thumb = renderSurface({ template: doc[0], ...st.renderOpts, size: 360 }).canvas.toDataURL("image/jpeg", 0.8);
    const files = [...photos.map((p) => ({ id: p.id, blob: p.blob })), ...usedStickers(doc, st.ustickers).map((x) => ({ id: x.id, blob: x.blob }))];
    const r = await saveScrapToAccount({ v: 1, kind: scrapKind, pages: 0, faces: isBack ? doc.length : undefined, showTitle: false, rightsOk: true, text: st.text, adjust: st.adjust, doc, applied: st.applied,
      photoIds: photos.map((p) => p.id), stickerIds: usedStickers(doc, st.ustickers).map((x) => x.id), paths: paths.current, colors: st.colors, prints: printsRef.current },
      files, { id: designId, name: isBack ? `Bìa sau ${doc.length} mặt` : "Mặt đĩa CD", thumbnail: thumb }, prints);
    paths.current = r.paths; printsRef.current = r.prints; setDesignId(r.id);
    toast("Đã lưu vào Thiết kế của tôi", "ok", { label: "Xem", href: "/thiet-ke-cua-toi" });
  }


  return (
    <>
    <ScrapbookEditor mode="customer" st={st} assets={assets} assetGroups={assetGroups} frames={frames} frameSets={frameSets} fonts={fonts} topics={T} wishes={W} tab={tab} setTab={setTab}
      guides={guides} setGuides={setGuides}
      toolbar={isBack ? undefined : <Toggle checked={boxView} onChange={(v) => { setBoxView(v); st.setEditLayer(null); st.setSel(null); }} label="Xem trong hộp" />}
      overlay={boxView && doc ? (boxUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={boxUrl} alt="Mặt đĩa trên nền" className="max-h-full max-w-full rounded-[12px] border border-[#e5e5e7]" />
        : <p className="text-[13px] text-[#71717a]">Đang dựng...</p>) : undefined}
      pageLabel={isBack ? (i) => backSlots(2)[i]?.label ?? "" : undefined}
      templateTab={isBack ? (bundleMode ? (
        <section className="space-y-3">
          <button type="button" onClick={() => setBundleMode(false)} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#52525b] hover:text-[var(--c-primary)]"><ArrowLeft size={14} /> Mẫu theo mặt</button>
          <p className="text-[12px] text-[#71717a]">Bộ mẫu 2 mặt — Mặt ngoài và Mặt trong thiết kế đồng bộ. Chọn 1 bộ để thay cả 2 mặt.</p>
          {bundles.length ? groupByCategory(bundles, library.categories.filter((c) => c.scope === "back_bundle")).map((g) => (
            <div key={g.cat?.id ?? "o"}>
              <p className="mb-2 text-[13px] font-semibold">{g.cat?.name ?? "Khác"}</p>
              <div className="space-y-2">
                {g.items.map((b) => (
                  <button key={b.id} type="button" onClick={() => applyBundle(b)} className={cx("block w-full rounded-[10px] border bg-white p-1.5 text-left", st.applied === b.id ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/25" : "border-[#e5e5e7] hover:border-[var(--c-primary)]")}>
                    <span className="grid grid-cols-2 gap-1.5">
                      {backSlots(2).map((sl, k) => { const d = tplById.get(b.template_ids[k]); return (
                        <span key={k} className="grid aspect-[150/117] place-items-center overflow-hidden rounded-[6px] bg-[#f4f4f5]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {d?.thumbnail_url ? <img src={d.thumbnail_url} alt="" className="h-full w-full object-contain" /> : d ? <LiveThumb t={d} /> : <span className="text-[10px] text-[#a1a1aa]">{sl.label}</span>}
                        </span>
                      ); })}
                    </span>
                    <span className="mt-1 block truncate px-0.5 text-[11px] font-medium">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )) : <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">Chưa có bộ mẫu 2 mặt.</p>}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">Mẫu cho {backSlots(2)[st.active]?.label ?? "Mặt ngoài"}</p>
            {faces === 2 && <button type="button" onClick={() => setBundleMode(true)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"><LayoutTemplate size={13} /> Bộ mẫu 2 mặt</button>}
          </div>
          {faces === 2 && <p className="text-[12px] text-[#71717a]">Bấm vào từng mặt ở thanh dưới khung thiết kế để chọn mẫu cho mặt đó.</p>}
          <LibraryGrid items={tpls} cats={library.categories.filter((c) => c.scope === "back")} current={st.applied} onPick={apply} cols={2} aspect="aspect-[150/117]" />
        </section>
      )) : (
        <section className="space-y-3">
          <p className="text-[12px] text-[#71717a]">Chọn 1 mẫu — ảnh bạn đã tải tự điền vào các ô theo thứ tự. Chọn mẫu trước rồi tải ảnh sau cũng được.</p>
          <LibraryGrid items={tpls} cats={library.categories} current={st.applied} onPick={apply} round />
        </section>
      )}
      photoTab={(
        <PhotoPanel photos={photos} used={st.used} max={MAX} hint="JPG, PNG, HEIC · ảnh chỉ xử lý trên máy bạn · tự điền vào ô trống của mẫu"
          onAdd={(f) => { addPhotos(f); }} onReplace={st.replacePhoto} onRemove={st.removePhoto} onReorder={st.reorderPhotos} onInsert={(id) => st.addAsset(`p:${id}`)} />
      )}
      bottom={(
        <div className="flex h-14 shrink-0 items-center gap-3 border-t border-[#efeff1] bg-[#f7f7f8] px-4">
          {isBack ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="shrink-0 text-[13px] font-medium text-[#3f3f46]">Số mặt:</span>
              {BACK_FACES.map((n) => <button key={n} type="button" onClick={() => changeFaces(n)} className={cx("h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium", faces === n ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]")}>{n}</button>)}
            </div>
          ) : <span className="flex-1" />}
          <Button size="sm" variant="secondary" icon={<Download size={16} />} onClick={downloadPrint} loading={busy}>Tải file in (PNG)</Button>
          <Button size="sm" icon={<Save size={16} />} onClick={() => setSaveOpen(true)} disabled={!doc || busy}>Lưu</Button>
        </div>
      )} />
    {saveOpen && <SaveDesignDialog onClose={() => setSaveOpen(false)} onSave={async () => { setBusy(true); try { await saveAccount(); } catch (e) { toast(e instanceof Error ? e.message : "Lưu thất bại", "err"); throw e; } finally { setBusy(false); } }} />}
    </>
  );
}
