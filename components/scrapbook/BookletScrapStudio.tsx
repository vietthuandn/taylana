"use client";

/* Trang "Booklet Template" (/thiet-ke/booklet): dùng chung bộ máy của CD Template (lib/scrapbook). Booklet 2 trang = 2 trang đơn;
   4 / 8 / 12 trang = Trang 1 (đơn) → 2–3 → 4–5 → … (trang đôi, ảnh / sticker vắt qua gáy) → trang cuối (đơn). Mở ra là các trang trống.
   Mục "Mẫu": mặc định mẫu theo trang đang chọn (Trang đơn 3 cột / Trang đôi 2 cột, theo danh mục) — chọn = thay toàn bộ trang đó;
   "Đổi mẫu" = các BỘ mẫu (Trình tạo template) đúng số trang — chọn = thay cả cuốn. Ảnh tự điền vào ô trống theo thứ tự.
   Thanh dưới: Số trang 2 · 4 · 8 · 12 · Lưu · Tải về · Đặt in. Ảnh khách chỉ xử lý trên trình duyệt. */
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
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Box, Download, Eye, FileStack, LayoutTemplate, Save, ShoppingBag } from "lucide-react";
import { GRADIENTS, paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import type { MockupBackground } from "@/lib/mockup/types";
import { defaultGlass } from "@/lib/mockup/types";
import { renderSystem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { saveBlob, saveZip } from "@/lib/imageTools";
import { impose, impositionZipName, printGuide, sideFileName } from "@/lib/imposition";
import { cmToPx, JPG_QUALITY } from "@/lib/printSpecs";
import { savePendingFiles, type PendingFile } from "@/lib/pendingOrderFiles";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { loadFonts, renderSurface } from "@/lib/scrapbook/render";
import { BUNDLE_PAGES, blankBooklet, bundleSlots, fillDoc, fillSlots, groupByCategory, libTemplate, type Bundle, type DesignTpl, type Library } from "@/lib/scrapbook/library";
import { loadScrapFromAccount, saveScrapToAccount } from "@/lib/scrapbook/account";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import type { AssetGroupRow, Frame, FrameSet, ScrapAsset, Template, Wish, WishTopic } from "@/lib/scrapbook/types";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { Button, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { ScrapbookEditor, type EditorTab } from "./ScrapbookEditor";
import { LibraryGrid } from "./LibraryGrid";
import { PhotoPanel, RightsModal, readPhoto, type Photo } from "./parts";
import { SaveDesignDialog } from "./SaveDesignDialog";
import type { PrintRef } from "@/lib/designs";
import { setFrameLibrary } from "@/lib/scrapbook/decor";
import { customizeText, usedStickers, useScrapStudio, type UserSticker } from "./useScrapStudio";

const MAX = 40;
const pad = (n: number) => String(n).padStart(2, "0");
const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = JPG_QUALITY) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));
/** số trang của bề mặt i (booklet 2 trang: 1, 2 · còn lại: bìa = 1, cặp i = 2i–2i+1, trang cuối = n) */
const pagesOf = (i: number, n: number, count: number) => (n === 2 ? [i + 1] : i === 0 ? [1] : i === count - 1 ? [n] : [i * 2, i * 2 + 1]);

export function BookletScrapStudio({ assets, assetGroups = [], library, fonts, glyphs, frames, frameSets, topics, wishes, backgrounds, packIds }: {
  assets: ScrapAsset[]; assetGroups?: AssetGroupRow[]; library: Library; fonts: CutoutFont[]; glyphs: Glyph[]; frames: Frame[]; frameSets: FrameSet[];
  topics: WishTopic[]; wishes: Wish[]; backgrounds: MockupBackground[]; packIds: Record<number, string>;
}) {
  void backgrounds;
  setFrameLibrary(frameSets);
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<EditorTab>("mau");
  const [bundleMode, setBundleMode] = useState(false); // mục Mẫu: false = mẫu theo trang · true = bộ mẫu ("Đổi mẫu")
  const [peek, setPeek] = useState<Bundle | null>(null);
  const [pages, setPages] = useState<number>(8);
  const [rightsOk, setRightsOk] = useState(false);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [guides, setGuides] = useState(true);
  const [bg] = useState<BgChoice>({ kind: "gradient", g: GRADIENTS[0] }); // nền ảnh mockup tải về
  const [busy, setBusy] = useState(false);
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const [user, setUser] = useState(false);
  const [designId, setDesignId] = useState<string | null>(params.get("design"));
  const paths = useRef<Record<string, string>>({});
  const extra = useMemo(() => ({ pages, rightsOk }), [pages, rightsOk]);
  const st = useScrapStudio({
    prefix: "bscrap", max: MAX, assets, frames, fonts, glyphs, defaultText: { main: "Our Memories", sub: "" }, extra, wantAllFonts: tab === "chu",
    onLoad: (m) => { if (m.pages && (BUNDLE_PAGES as readonly number[]).includes(m.pages)) setPages(m.pages); setRightsOk(!!m.rightsOk); },
  });
  const { doc, photos } = st;

  const T = topics.length ? topics : DEFAULT_TOPICS, W = wishes.length ? wishes : DEFAULT_WISHES;

  // ---------- đăng nhập + mở thiết kế đã lưu (?design=) ----------
  useEffect(() => {
    if (!hasSupabase) return;
    createClient().auth.getUser().then(({ data }) => setUser(!!data.user));
  }, []);
  useEffect(() => {
    const id = params.get("design");
    if (!st.ready || !id || !hasSupabase) return;
    (async () => {
      const r = await loadScrapFromAccount(id).catch(() => null);
      if (!r) return;
      const ph: Photo[] = [], us: UserSticker[] = [];
      for (const pid of r.data.photoIds) { const b = r.blobs[pid]; if (b) { try { ph.push(await readPhoto(b, "anh.jpg", pid)); } catch { /* bỏ */ } } }
      for (const sid of r.data.stickerIds) { const b = r.blobs[sid]; if (b) { try { const p = await readPhoto(b, "sticker.png", sid); us.push({ id: sid, blob: b, url: p.url, img: p.img }); } catch { /* bỏ */ } } }
      paths.current = r.data.paths ?? {}; printsRef.current = r.data.prints ?? [];
      setPages(r.data.pages); setRightsOk(r.data.rightsOk);
      st.hydrate({ photos: ph, stickers: us, text: r.data.text, adjust: r.data.adjust, doc: r.data.doc, applied: r.data.applied, colors: r.data.colors });
    })();
  }, [st.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- cấu trúc trang trống khi chưa có thiết kế ----------
  useEffect(() => {
    if (!st.ready || doc || params.get("design")) return;
    st.D.setDoc(blankBooklet(pages)); st.D.reset(); st.D.setEdited(false); st.setActive(0);
  }, [st.ready, doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const tText = st.text; // tiêu đề bìa = 1 lớp chữ bình thường của mẫu (bấm để sửa, chọn rồi xoá nếu không muốn)
  const ro = useMemo(() => ({ ...st.renderOpts, text: tText }), [st.renderOpts, tText]);
  const cur = st.cur;
  const singles = useMemo(() => library.templates.filter((t) => t.kind === "booklet_single"), [library.templates]);
  const spreads = useMemo(() => library.templates.filter((t) => t.kind === "booklet_spread"), [library.templates]);
  const bundles = useMemo(() => library.bundles.filter((b) => b.page_count === pages), [library.bundles, pages]);
  const tplById = useMemo(() => new Map(library.templates.map((t) => [t.id, t])), [library.templates]);
  const unused = () => photos.filter((p) => !st.used.has(p.id)).map((p) => p.id);
  const dirty = () => !!doc && (st.D.edited || st.D.canUndo || doc.some((t) => t.layers.length > 0));

  /** chọn 1 mẫu trang → THAY toàn bộ trang / cặp trang đang chọn, điền ảnh chưa dùng vào ô */
  const applyPage = useCallback(async (d: DesignTpl) => {
    const i = st.active, t0 = doc?.[i];
    if (!t0) return;
    if (t0.layers.length && !(await confirmDialog({ title: "Thay trang này bằng mẫu?", message: "Mọi thứ đã thêm trên trang này (ảnh, sticker, chữ) sẽ bị xoá và thay bằng mẫu. Ảnh của trang quay về danh sách Ảnh.", confirmText: "Thay trang", cancelText: "Huỷ" }))) return;
    const freed = new Set(t0.layers.flatMap((l) => (l.k === "photo" && l.photo ? [l.photo] : [])));
    const avail = photos.filter((p) => !st.used.has(p.id) || freed.has(p.id)).map((p) => p.id);
    const next = customizeText(fillSlots(libTemplate(d, t0.surface === "page" ? t0.gutter : undefined), avail).t, st.text);
    st.setEditText(null); st.setSel(null); st.setEditLayer(null);
    st.D.begin(); st.D.patchSurface(i, () => next); st.D.setEdited(true);
  }, [st, doc, photos]); // eslint-disable-line react-hooks/exhaustive-deps
  /** dựng cả cuốn từ 1 bộ mẫu (ô thiếu mẫu → trang trống), điền ảnh theo thứ tự qua các trang */
  const fromBundle = (b: Bundle) => bundleSlots(b.page_count).map((sl, k) => { const d = tplById.get(b.template_ids[k]); return d ? libTemplate(d, sl.gutter) : blankBooklet(b.page_count)[k]; });
  const applyBundle = useCallback(async (b: Bundle) => {
    if (dirty() && !(await confirmDialog({ title: "Đổi sang bộ mẫu này?", message: "Toàn bộ trang, sticker, chữ và chỉnh sửa sẽ bị thay bằng bộ mẫu. Ảnh bạn đã tải vẫn được giữ và tự điền vào các ô.", confirmText: "Đổi mẫu", cancelText: "Huỷ" }))) return;
    const next = fillDoc(fromBundle(b), photos.map((p) => p.id)).map((t) => customizeText(t, st.text));
    st.setEditText(null); st.setSel(null); st.setEditLayer(null);
    st.D.setDoc(next); st.D.setEdited(false); st.D.reset();
    st.setApplied(b.id); st.setActive(0); setPeek(null);
  }, [st, photos, tplById]); // eslint-disable-line react-hooks/exhaustive-deps
  async function changePages(n: number) {
    if (n === pages) return;
    if (!(await confirmDialog({ title: `Đổi sang booklet ${n} trang?`, message: "Cấu trúc trang sẽ được dựng lại (các trang trống). Ảnh bạn đã tải vẫn được giữ trong danh sách Ảnh.", confirmText: "Đổi số trang", cancelText: "Huỷ" }))) return;
    setPages(n);
    st.setEditText(null); st.setSel(null); st.setEditLayer(null);
    st.D.setDoc(blankBooklet(n)); st.D.setEdited(false); st.D.reset(); st.setApplied(null); st.setActive(0);
  }
  async function restore() {
    const b = library.bundles.find((x) => x.id === st.applied);
    if (!b || !(await confirmDialog({ title: "Khôi phục bộ mẫu gốc?", message: "Các chỉnh sửa, sticker và chữ bạn đã thêm sẽ bị bỏ. Ảnh bạn đã tải vẫn được giữ.", confirmText: "Khôi phục", danger: true }))) return;
    st.D.begin(); st.D.setDoc(fillDoc(fromBundle(b), photos.map((p) => p.id)).map((t) => customizeText(t, st.text))); st.D.setEdited(false); st.setSel(null);
  }
  /** tải ảnh → tự điền vào các ô trống theo thứ tự trang */
  async function addPhotos(f: File[]) {
    const out = await st.addFiles(f);
    if (out.length) st.D.setDoc((d) => d && fillDoc(d, out.map((p) => p.id)));
  }

  const count = doc?.length ?? 0;
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomPage(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---------- xuất file ----------
  async function pageCanvases(px: number) {
    if (!doc) throw new Error("Tải ảnh và chọn mẫu trước");
    await loadFonts();
    const out: HTMLCanvasElement[] = [];
    for (const s of doc) {
      const c = renderSurface({ template: s, ...ro, size: s.surface === "spread" ? px * 2 : px, mode: "print" }).canvas;
      if (s.surface !== "spread") { out.push(c); continue; }
      for (const half of [0, 1]) { const h = document.createElement("canvas"); h.width = px; h.height = px; h.getContext("2d")!.drawImage(c, -half * px, 0); out.push(h); }
    }
    return out;
  }
  const zoomUrl = useMemo(() => {
    if (zoomPage === null || !doc) return "";
    const i = doc.findIndex((_, k) => pagesOf(k, pages, count).includes(zoomPage)), s = doc[i];
    if (!s) return "";
    const px = Math.min(1800, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.9 * Math.min(2, window.devicePixelRatio || 1)));
    const c = renderSurface({ template: s, ...ro, size: s.surface === "spread" ? px * 2 : px }).canvas;
    if (s.surface !== "spread") return c.toDataURL("image/jpeg", 0.92);
    const half = pagesOf(i, pages, count).indexOf(zoomPage), h = document.createElement("canvas"); h.width = px; h.height = px; h.getContext("2d")!.drawImage(c, -half * px, 0);
    return h.toDataURL("image/jpeg", 0.92);
  }, [zoomPage, doc, ro, pages, count]);
  async function run(fn: () => Promise<void>) { setBusy(true); try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : "Có lỗi, bạn thử lại nhé.", "err"); } setBusy(false); }
  const dlPages = () => run(async () => { const cs = await pageCanvases(cmToPx(12)); const files = []; for (const [i, c] of cs.entries()) files.push({ name: `${pad(i + 1)}.jpg`, blob: await toBlob(c) }); await saveZip(files, "Booklet-Template-cac-trang.zip"); toast("Đã tải xuống"); });
  const dlImposed = () => run(async () => {
    const cs = await pageCanvases(cmToPx(12)), px = cmToPx(12), files = [];
    if (pages === 2) { // 2 trang = 1 tờ 12 × 12 cm in 2 mặt
      for (const [i, c] of cs.entries()) files.push({ name: `${pad(i + 1)}_MatTruoc-Sau_trang-${pad(i + 1)}.jpg`.replace("MatTruoc-Sau", i ? "MatSau" : "MatTruoc"), blob: await toBlob(c) });
      await saveZip(files, impositionZipName(pages)); toast("Đã tải xuống"); return;
    }
    for (const s of impose(pages)) {
      const c = document.createElement("canvas"); c.width = px * 2; c.height = px;
      const x = c.getContext("2d")!; x.drawImage(cs[s.left - 1], 0, 0); x.drawImage(cs[s.right - 1], px, 0);
      files.push({ name: sideFileName(s), blob: await toBlob(c) });
    }
    files.push({ name: "HUONG-DAN-IN.txt", blob: new Blob([printGuide(pages)], { type: "text/plain;charset=utf-8" }) });
    await saveZip(files, impositionZipName(pages)); toast("Đã tải xuống");
  });
  const dlMockup = () => run(async () => {
    const cs = await pageCanvases(600);
    await loadSprites();
    const c = renderSystem(2400, { pack: "booklet", frontOut: cs[0] as unknown as HTMLImageElement, pages: cs as unknown as HTMLImageElement[] },
      { arrange: "single", single: "booklet", seed: 1, tray: "clear", glass: defaultGlass }, (ctx, w, h) => paintBackground(ctx, w, h, bg));
    saveBlob(await toBlob(c, "image/jpeg", 0.92), "Mockup-Booklet-Template.jpg"); toast("Đã tải xuống");
  });
  // Lưu vào "Thiết kế của tôi" (kèm file in từng trang — để Tải / Đặt đơn ở đó)
  const printsRef = useRef<PrintRef[]>([]);
  const saveAccount = async () => {
    if (!doc) throw new Error("Tải ảnh và chọn mẫu trước");
    const px = cmToPx(12), cs = await pageCanvases(px), prints = [];
    for (const [i, c] of cs.entries()) prints.push({ kind: "booklet" as const, page: i + 1, name: `booklet-trang-${pad(i + 1)}.jpg`, blob: await toBlob(c), w: px, h: px });
    const thumb = renderSurface({ template: doc[0], ...ro, size: 360 }).canvas.toDataURL("image/jpeg", 0.8);
    const files = [...photos.map((p) => ({ id: p.id, blob: p.blob })), ...usedStickers(doc, st.ustickers).map((x) => ({ id: x.id, blob: x.blob }))];
    const r = await saveScrapToAccount({ v: 1, kind: "booklet-scrapbook", pages, showTitle: true, rightsOk, text: st.text, adjust: st.adjust, doc, applied: st.applied, photoIds: photos.map((p) => p.id), stickerIds: usedStickers(doc, st.ustickers).map((x) => x.id), paths: paths.current, colors: st.colors, prints: printsRef.current },
      files, { id: designId, name: `Booklet ${pages} trang`, thumbnail: thumb }, prints);
    paths.current = r.paths; printsRef.current = r.prints; setDesignId(r.id);
    toast("Đã lưu vào Thiết kế của tôi", "ok", { label: "Xem", href: "/thiet-ke-cua-toi" });
  };
  const [saveOpen, setSaveOpen] = useState(false);

  const nos = pagesOf(st.active, pages, count);
  const isSpread = cur?.surface === "spread";
  const bundleThumbs = (b: Bundle) => b.template_ids.map((id) => tplById.get(id)?.thumbnail_url ?? null);
  const templateTab = bundleMode ? (
    <section className="space-y-3">
      <button type="button" onClick={() => setBundleMode(false)} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#52525b] hover:text-[var(--c-primary)]"><ArrowLeft size={14} /> Mẫu theo trang</button>
      <p className="text-[12px] text-[#71717a]">Bộ mẫu booklet {pages} trang — chọn 1 bộ để thay cả cuốn, ảnh tự điền qua các trang.</p>
      {bundles.length ? groupByCategory(bundles, library.categories.filter((c) => c.scope === "booklet_bundle")).map((g) => (
        <div key={g.cat?.id ?? "o"}>
          <p className="mb-2 text-[13px] font-semibold">{g.cat?.name ?? "Khác"}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.items.map((b) => (
              <div key={b.id} className={cx("rounded-[10px] border bg-white p-1", st.applied === b.id ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/25" : "border-[#e5e5e7]")}>
                <button type="button" onClick={() => applyBundle(b)} className="block w-full text-left">
                  <span className="grid aspect-square place-items-center overflow-hidden rounded-[6px] bg-[#f4f4f5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {b.thumbnail_url || bundleThumbs(b)[0] ? <img src={b.thumbnail_url ?? bundleThumbs(b)[0]!} alt="" className="h-full w-full object-contain" loading="lazy" /> : <span className="text-[10px] text-[#a1a1aa]">{b.name}</span>}
                  </span>
                  <span className="mt-1 block truncate px-0.5 text-[11px] font-medium">{b.name}</span>
                </button>
                <button type="button" onClick={() => setPeek(peek?.id === b.id ? null : b)} className="mt-0.5 inline-flex items-center gap-1 px-0.5 text-[11px] text-[var(--c-primary)]"><Eye size={11} /> Xem các trang</button>
              </div>
            ))}
          </div>
        </div>
      )) : <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">Chưa có bộ mẫu {pages} trang.</p>}
      {peek && (
        <div className="rounded-[10px] border border-[#e5e5e7] p-2">
          <p className="mb-1.5 text-[12px] font-semibold">{peek.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {bundleSlots(peek.page_count).map((sl, k) => (
              <figure key={k} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {bundleThumbs(peek)[k] ? <img src={bundleThumbs(peek)[k]!} alt="" className={cx("h-12 rounded-[3px] border border-[#e5e5e7] object-contain", sl.kind === "booklet_spread" ? "w-24" : "w-12")} /> : <span className={cx("block h-12 rounded-[3px] bg-[#f4f4f5]", sl.kind === "booklet_spread" ? "w-24" : "w-12")} />}
                <figcaption className="text-[10px] text-[#71717a]">{sl.label}</figcaption>
              </figure>
            ))}
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => applyBundle(peek)}>Dùng bộ mẫu này</Button>
        </div>
      )}
    </section>
  ) : (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{isSpread ? `Mẫu trang đôi · trang ${nos.join("–")}` : `Mẫu trang đơn · trang ${nos[0] ?? 1}`}</p>
        <button type="button" onClick={() => setBundleMode(true)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"><LayoutTemplate size={13} /> Đổi mẫu</button>
      </div>
      {!st.applied && bundles.length > 0 && !doc?.some((t) => t.layers.length) && (
        <button type="button" onClick={() => setBundleMode(true)} className="block w-full rounded-[10px] border border-dashed border-[var(--c-primary)] bg-[var(--c-secondary)] p-3 text-left text-[12px] text-[var(--c-primary-dark)]">Có {bundles.length} bộ mẫu {pages} trang làm sẵn — bấm để chọn nhanh cả cuốn.</button>
      )}
      <p className="text-[12px] text-[#71717a]">Chọn mẫu để thay toàn bộ {isSpread ? "cặp trang" : "trang"} đang xem — ảnh chưa dùng tự điền vào các ô.</p>
      <LibraryGrid items={isSpread ? spreads : singles} cats={library.categories.filter((c) => c.scope === (isSpread ? "booklet_spread" : "booklet_single"))} cols={isSpread ? 2 : 3} onPick={applyPage} />
    </section>
  );
  return (
    <>
      <ScrapbookEditor mode="customer" st={st} assets={assets} assetGroups={assetGroups} frames={frames} frameSets={frameSets} fonts={fonts} topics={T} wishes={W} tab={tab} setTab={setTab}
        render={ro} guides={guides} setGuides={setGuides}
        pageLabel={(i, n) => { const no = pagesOf(i, pages, n); return `${no.length === 1 ? `Trang ${no[0]}${i === 0 ? " (bìa)" : ""}` : `Trang ${no[0]}–${no[1]}`} / ${pages}`; }}
        templateTab={templateTab}
        onBackgroundDbl={(at) => setZoomPage(nos[cur?.surface === "spread" && at.x >= 120 ? 1 : 0])}
        photoTab={(
          <PhotoPanel photos={photos} used={st.used} max={MAX} hint="JPG, PNG, HEIC · ảnh chỉ xử lý trên máy bạn · tự điền vào ô trống của các trang"
            onAdd={(f) => { addPhotos(f); }} onReplace={st.replacePhoto} onRemove={st.removePhoto} onReorder={st.reorderPhotos} onInsert={(id) => st.addAsset(`p:${id}`)} />
        )}
        bottom={(
          <div className="flex h-14 shrink-0 items-center gap-2 border-t border-[#efeff1] bg-[#f7f7f8] px-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              <span className="shrink-0 text-[13px] font-medium text-[#3f3f46]">Số trang:</span>
              {BUNDLE_PAGES.map((n) => <button key={n} type="button" onClick={() => changePages(n)} className={cx("h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium", pages === n ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]")}>{n}</button>)}
            </div>
            <DownloadMenu busy={busy} up items={[
              { label: "Các trang (.zip)", icon: <FileStack size={16} />, onClick: dlPages },
              ...(pages === 2 ? [] : [{ label: "Dàn trang in (.zip)", icon: <Download size={16} />, onClick: dlImposed }]),
            ]} />
            <Button size="sm" icon={<Save size={16} />} disabled={!doc || busy} onClick={() => { if (rightsOk) setSaveOpen(true); else setRightsOpen(true); }}>Lưu</Button>
          </div>
        )} />
      {zoomPage !== null && zoomUrl && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4" onClick={() => setZoomPage(null)} role="dialog" aria-modal>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt={`Trang ${zoomPage}`} className="max-h-[90dvh] max-w-[90vw] shadow-2xl" />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] text-white/80">Trang {zoomPage} · bấm ra ngoài hoặc Esc để thoát</p>
        </div>
      )}
      {rightsOpen && <RightsModal onClose={() => setRightsOpen(false)} onOk={() => { setRightsOk(true); setRightsOpen(false); setSaveOpen(true); }} />}
      {saveOpen && <SaveDesignDialog onClose={() => setSaveOpen(false)} onSave={async () => { setBusy(true); try { await saveAccount(); } catch (e) { toast(e instanceof Error ? e.message : "Lưu thất bại", "err"); throw e; } finally { setBusy(false); } }} />}
    </>
  );
}
