"use client";

/* Trang "Booklet Scrapbook" (/thiet-ke/booklet-scrapbook): dùng chung bộ máy của CD Scrapbook (lib/scrapbook) trên các bề mặt
   trang / cặp trang: Trang 1 (bìa, đơn) → 2–3 → 4–5 → … → trang cuối (đơn). Mỗi cặp trang mở đôi là 1 surface "spread" để ảnh,
   sticker, băng dính vắt qua gáy. Trái: tab Ảnh (ảnh, số trang, bộ mẫu) · Sticker · Chữ (lời chúc có sẵn). Phải: cuốn sách to nhất
   có thể (1 trang = min(cao × 0.85, rộng × 0.92 / 2)), thumbnail các trang 48px, bấm đúp 1 trang để xem riêng (Esc thoát).
   Thanh dưới: Nền · Tải về (các trang .zip, dàn trang in .zip, ảnh mockup) · Đặt in. Ảnh khách chỉ xử lý trên trình duyệt. */
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
import { Box, ChevronLeft, ChevronRight, Dices, Download, FileStack, Image as ImageIcon, LayoutTemplate, Redo2, RotateCcw, Save, ShoppingBag, Undo2 } from "lucide-react";
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
import { applyFrames, autoDecorate, resolveFrameSets } from "@/lib/scrapbook/generate";
import { BOOKLET_PAGES, SPREAD_KINDS, bookletSets, spreadTemplate, type BookletSet } from "@/lib/scrapbook/booklet";
import { loadScrapFromAccount, saveScrapToAccount } from "@/lib/scrapbook/account";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import { STYLES, type Frame, type FrameSet, type ScrapAsset, type Template, type TemplateSetting, type Wish, type WishTopic } from "@/lib/scrapbook/types";
import { BgPicker } from "@/components/mockup-viewer/BgPicker";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { StickerTab } from "./StickerTab";
import { TextTab } from "./TextTab";
import { SurfaceView } from "./SurfaceView";
import { TemplateGallery, type GalleryGroup } from "./TemplateGallery";
import { PhotoPanel, PickPhotoModal, RightsModal, readPhoto, type Photo } from "./parts";
import { FramePicker } from "./FramePicker";
import { setFrameLibrary } from "@/lib/scrapbook/decor";
import { UserStickerModal } from "./UserStickerModal";
import { customizeText, useScrapStudio, type UserSticker } from "./useScrapStudio";
import { clone } from "./useScrapDoc";

const MAX = 40;
const pad = (n: number) => String(n).padStart(2, "0");
const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = JPG_QUALITY) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));
const withPhotos = (t: Template, list: { id: string }[]): Template => ({ ...clone(t), layers: clone(t.layers).map((l) => (l.k === "photo" ? { ...l, photo: list[l.slot]?.id ?? "" } : l)) });
/** số trang của bề mặt i (bìa = 1, cặp i = 2i–2i+1, trang cuối = n) */
const pagesOf = (i: number, n: number, count: number) => (i === 0 ? [1] : i === count - 1 ? [n] : [i * 2, i * 2 + 1]);

export function BookletScrapStudio({ assets, settings, fonts, glyphs, frames, frameSets, stickerCfg, topics, wishes, backgrounds, packIds }: {
  assets: ScrapAsset[]; settings: TemplateSetting[]; fonts: CutoutFont[]; glyphs: Glyph[]; frames: Frame[]; frameSets: FrameSet[]; stickerCfg: StickerCfg;
  topics: WishTopic[]; wishes: Wish[]; backgrounds: MockupBackground[]; packIds: Record<number, string>;
}) {
  setStickerConfig(stickerCfg); // cài đặt sticker tự rải của admin (trước khi sinh mẫu)
  setFrameLibrary(frameSets); // tên bộ khung → ưu tiên khung hợp phong cách
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"anh" | "sticker" | "chu">("anh");
  const [pages, setPages] = useState<number>(8);
  const [rightsOk, setRightsOk] = useState(false);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [guides, setGuides] = useState(true);
  const [bg, setBg] = useState<BgChoice>({ kind: "gradient", g: GRADIENTS[0] });
  const [busy, setBusy] = useState(false);
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const [user, setUser] = useState(false);
  const [designId, setDesignId] = useState<string | null>(params.get("design"));
  const paths = useRef<Record<string, string>>({});
  const extra = useMemo(() => ({ pages, rightsOk }), [pages, rightsOk]);
  const st = useScrapStudio({
    prefix: "bscrap", max: MAX, assets, frames, fonts, glyphs, defaultText: { main: "Our Memories", sub: "" }, extra, wantAllFonts: tab === "chu",
    onLoad: (m) => { if (m.pages && (BOOKLET_PAGES as readonly number[]).includes(m.pages)) setPages(m.pages); setRightsOk(!!m.rightsOk); },
  });
  const { doc, photos } = st;

  // chọn 1 lớp chữ trên trang → mở tab Chữ (hiện Cài đặt chữ)
  useEffect(() => { if (st.sel !== null && st.isTextLayer(st.L[st.sel])) setTab("chu"); }, [st.sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const spreadSettings = useMemo(() => settings.filter((s) => s.surface_type === "spread"), [settings]);
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
      paths.current = r.data.paths ?? {};
      setPages(r.data.pages); setRightsOk(r.data.rightsOk);
      st.hydrate({ photos: ph, stickers: us, text: r.data.text, adjust: r.data.adjust, doc: r.data.doc, applied: r.data.applied });
    })();
  }, [st.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- bộ mẫu cho số trang đang chọn ----------
  const sets = useMemo(() => bookletSets(pages, assets, frames, spreadSettings), [pages, assets, frames, spreadSettings]);
  const samples = useMemo(() => samplePhotos(), []);
  const thumbPhotos = useMemo(() => Array.from({ length: 48 }, (_, i) => photos[i]?.img ?? samples[i % samples.length]), [photos, samples]);
  const tText = st.text; // tiêu đề bìa = 1 lớp chữ bình thường của mẫu (bấm để sửa, chọn rồi xoá nếu không muốn)
  const ro = useMemo(() => ({ ...st.renderOpts, text: tText }), [st.renderOpts, tText]);
  const pKey = photos.map((p) => p.id).join(",");
  const groups: GalleryGroup[] = useMemo(() => [{
    id: String(pages), title: `Booklet ${pages} trang`, chip: `${pages} trang`, match: false,
    items: sets.map((s) => ({
      id: s.id, label: STYLES.find((x) => x.id === s.style)?.name ?? s.style, sub: `Cần ${s.photoCount} ảnh`, key: `${s.id}|${pKey}|${tText.main}|${Object.keys(st.assetImgs).length}|${Object.keys(st.frameImgs).length}`,
      make: () => {
        const c = document.createElement("canvas"); c.width = 360; c.height = 120;
        const x = c.getContext("2d")!; x.fillStyle = "#f4f4f5"; x.fillRect(0, 0, 360, 120);
        const o = { photos: thumbPhotos, text: tText, assets: st.renderOpts.assets, frames: st.frameImgs };
        x.drawImage(renderSurface({ template: s.surfaces[0], ...o, size: 116 }).canvas, 0, 2);
        if (s.surfaces[1]) x.drawImage(renderSurface({ template: s.surfaces[1], ...o, size: 236 }).canvas, 122, 2);
        return c.toDataURL("image/jpeg", 0.85);
      },
    })),
  }], [pages, sets, pKey, tText, thumbPhotos, st.assetImgs, st.frameImgs, st.renderOpts.assets]);
  const apply = useCallback((s: BookletSet, list: Photo[], ask = true) => {
    if (ask && st.D.edited && !window.confirm("Áp bộ mẫu mới sẽ thay bố cục hiện tại (giữ sticker và chữ bạn tự thêm). Tiếp tục?")) return;
    const next = s.surfaces.map((t, i) => {
      const d = customizeText(withPhotos(t, list), st.text), mine = st.doc?.[i]?.layers.filter((l) => l.user && l.k !== "photo") ?? [];
      return { ...d, layers: [...d.layers, ...mine] };
    });
    st.D.begin(); st.D.setDoc(next); st.D.setEdited(false); st.setApplied(s.id); st.setSel(null); st.setEditLayer(null);
    if (st.active >= next.length) st.setActive(0);
  }, [st]);
  // lần đầu tải ảnh: tự áp bộ mẫu cần số ảnh gần nhất
  useEffect(() => {
    if (!st.ready || doc || !photos.length || params.get("design")) return;
    const best = [...sets].sort((a, b) => Math.abs(a.photoCount - photos.length) - Math.abs(b.photoCount - photos.length))[0];
    if (best) apply(best, photos, false);
  }, [st.ready, doc, photos, sets, apply, params]);
  function changePages(n: number) {
    if (n === pages) return;
    if (doc && st.D.edited && !window.confirm(`Đổi sang ${n} trang sẽ dựng lại bố cục (giữ ảnh đã tải). Tiếp tục?`)) return;
    setPages(n);
    if (doc) {
      const style = sets.find((s) => s.id === st.applied)?.style ?? "polaroid";
      const s = bookletSets(n, assets, frames, spreadSettings).find((x) => x.style === style);
      if (s) apply(s, photos, false);
    }
  }
  const cur = st.cur;
  /** đổi bố cục riêng cặp trang đang xem (giữ ảnh của cặp, ảnh dư quay về danh sách) */
  function relayout() {
    if (!cur || cur.surface !== "spread") return;
    const style = cur.style, k = SPREAD_KINDS.findIndex((x) => x.id === cur.kind), kind = SPREAD_KINDS[(k + 1) % SPREAD_KINDS.length].id;
    const seed = Math.floor(Math.random() * 1e6);
    let t = spreadTemplate(kind, style, seed, assets, spreadSettings);
    t = autoDecorate({ ...t, layers: applyFrames(resolveFrameSets(t.layers, frames, seed), frames, seed, style) }, seed, assets);
    const ids = cur.layers.flatMap((l) => (l.k === "photo" && l.photo ? [l.photo] : []));
    const mine = cur.layers.filter((l) => l.user && l.k !== "photo");
    const next = withPhotos(t, ids.map((id) => ({ id })));
    st.D.begin(); st.D.patchSurface(st.active, () => ({ ...next, layers: [...next.layers, ...mine] })); st.D.setEdited(true); st.setSel(null);
    toast(`Đã đổi sang kiểu “${SPREAD_KINDS.find((x) => x.id === kind)?.name}”`);
  }
  function shuffle() { if (!cur) return; st.D.begin(); st.D.patchSurface(st.active, (t) => autoDecorate(t, Math.floor(Math.random() * 1e6), assets)); st.setSel(null); }
  function restore() {
    const s = sets.find((x) => x.id === st.applied);
    if (!s || !window.confirm("Khôi phục bố cục gốc của bộ mẫu? Các chỉnh sửa, sticker và chữ đã thêm sẽ bị bỏ (ảnh đã tải vẫn giữ).")) return;
    st.D.begin(); st.D.setDoc(s.surfaces.map((t) => customizeText(withPhotos(t, photos), st.text))); st.D.setEdited(false); st.setSel(null);
  }

  // ---------- khung xem: cuốn sách to nhất có thể ----------
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 500 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const r = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    r.observe(el);
    return () => r.disconnect();
  }, []);
  const pagePx = Math.max(120, Math.floor(Math.min(box.h * 0.85, (box.w * 0.92) / 2)));
  const count = doc?.length ?? 0;
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    if (!doc) return;
    const t = setTimeout(() => setThumbs(doc.map((s) => renderSurface({ template: s, ...ro, size: s.surface === "spread" ? 96 : 48 }).canvas.toDataURL("image/jpeg", 0.8))), 400);
    return () => clearTimeout(t);
  }, [doc, ro]);
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
  const dlPages = () => run(async () => { const cs = await pageCanvases(cmToPx(12)); const files = []; for (const [i, c] of cs.entries()) files.push({ name: `${pad(i + 1)}.jpg`, blob: await toBlob(c) }); await saveZip(files, "Booklet-Scrapbook-cac-trang.zip"); toast("Đã tải xuống"); });
  const dlImposed = () => run(async () => {
    const cs = await pageCanvases(cmToPx(12)), px = cmToPx(12), files = [];
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
    saveBlob(await toBlob(c, "image/jpeg", 0.92), "Mockup-Booklet-Scrapbook.jpg"); toast("Đã tải xuống");
  });
  const orderId = packIds[pages];
  const order = () => run(async () => {
    const cs = await pageCanvases(cmToPx(12)), px = cmToPx(12);
    const files: PendingFile[] = [];
    for (const [i, c] of cs.entries()) files.push({ kind: "booklet", page: i + 1, name: `booklet-trang-${pad(i + 1)}.jpg`, blob: await toBlob(c), w: px, h: px });
    await savePendingFiles(files); // giữ trên máy, gắn vào đơn ngay sau khi đặt
    router.push(`/san-pham/in-cd-theo-yeu-cau${orderId ? `?goi=${encodeURIComponent(orderId)}` : ""}`);
  });
  const saveAccount = () => run(async () => {
    if (!doc) throw new Error("Tải ảnh và chọn mẫu trước");
    const thumb = renderSurface({ template: doc[0], ...ro, size: 360 }).canvas.toDataURL("image/jpeg", 0.8);
    const files = [...photos.map((p) => ({ id: p.id, blob: p.blob })), ...st.ustickers.map((s) => ({ id: s.id, blob: s.blob }))];
    const r = await saveScrapToAccount({ v: 1, kind: "booklet-scrapbook", pages, showTitle: true, rightsOk, text: st.text, adjust: st.adjust, doc, applied: st.applied, photoIds: photos.map((p) => p.id), stickerIds: st.ustickers.map((s) => s.id), paths: paths.current },
      files, { id: designId, name: st.text.main || "Booklet Scrapbook", thumbnail: thumb });
    paths.current = r.paths; setDesignId(r.id);
    toast("Đã lưu vào Thiết kế của tôi", "ok", { label: "Xem", href: "/thiet-ke-cua-toi" });
  });

  const tabBtn = (id: typeof tab, label: string) => (
    <button key={id} type="button" onClick={() => { setTab(id); if (id !== "chu" && st.sel !== null && st.isTextLayer(st.L[st.sel])) { st.setEditText(null); st.setSel(null); } }} className={cx("flex-1 rounded-[8px] px-3 py-1.5 text-[13px] font-medium", tab === id ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]")}>{label}</button>
  );
  const nos = pagesOf(st.active, pages, count);
  const label = nos.length === 1 ? `Trang ${nos[0]}${st.active === 0 ? " (bìa)" : ""}` : `Trang ${nos[0]}–${nos[1]}`;
  const go = (i: number) => { st.setActive(Math.max(0, Math.min(count - 1, i))); st.setSel(null); st.setEditLayer(null); };
  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col md:min-h-0 md:flex-row md:border-x md:border-[#e5e5e7]">
      <aside className="order-2 space-y-5 border-[#e5e5e7] bg-white p-6 md:order-1 md:w-[34%] md:min-w-[340px] md:shrink-0 md:overflow-y-auto md:border-r">
        <div className="flex rounded-[10px] border border-[#e5e5e7] p-1">{tabBtn("anh", "Ảnh")}{tabBtn("sticker", "Sticker")}{tabBtn("chu", "Chữ")}</div>
        {tab === "anh" && (
          <>
            <PhotoPanel photos={photos} used={st.used} max={MAX} hint="JPG, PNG, HEIC · mỗi trang 1–2 ảnh · ảnh chỉ xử lý trên máy bạn"
              onAdd={(f) => { st.addFiles(f); }} onReplace={st.replacePhoto} onRemove={st.removePhoto} onReorder={st.reorderPhotos} onAddSlot={doc ? () => st.setAddSlotOpen(true) : undefined} />
            <section>
              <p className="mb-2 text-[14px] font-semibold">Số trang</p>
              <div className="flex gap-1.5">
                {BOOKLET_PAGES.map((n) => <button key={n} type="button" onClick={() => changePages(n)} className={cx("h-8 min-w-[56px] rounded-full border px-3 text-[13px] font-medium", pages === n ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b]")}>{n} trang</button>)}
              </div>
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[14px] font-semibold">Chọn bộ mẫu</p>
                {doc && <button type="button" onClick={shuffle} title="Rải lại sticker trang đang xem" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /> Xáo trộn</button>}
              </div>
              <TemplateGallery groups={groups} current={st.applied} aspect="3 / 1" cols="grid-cols-2" onPick={(id) => { const s = sets.find((x) => x.id === id); if (s) apply(s, photos); }} />
            </section>
          </>
        )}
        {tab === "sticker" && (
          <StickerTab assets={assets} onAdd={(a) => st.addAsset(a)} decor={frames.filter((f) => st.frameImgs[f.id]).map((f) => ({ id: f.id, url: f.url, name: f.name }))} onAddDecor={(id) => st.addAsset(`f:${id}`)} mine={st.ustickers.map((s) => ({ id: s.id, url: s.url }))}
            onUpload={(f) => st.setStickerFiles(f)} onAddMine={(id) => st.addAsset(`u:${id}`)} onRemoveMine={st.removeUserSticker} />
        )}
        {tab === "chu" && (
          <TextTab layer={st.sel !== null && st.isTextLayer(st.L[st.sel]) ? st.L[st.sel] : null} fonts={fonts} previews={st.fontPreviews} onAdd={() => st.addText()}
            onPatch={(v) => { if (st.sel !== null) st.patchLayer(st.sel, v); }} onBegin={st.D.begin} onDuplicate={() => { if (st.sel !== null) st.duplicate(st.sel); }} onRemove={() => { if (st.sel !== null) st.removeLayer(st.sel); }}
            topics={T} wishes={W} onWish={st.addWish} wishOpen={st.wishOpen} onWishOpen={st.setWishOpen} />
        )}
      </aside>

      <section className="relative order-1 flex min-h-[460px] min-w-0 flex-1 flex-col md:order-2 md:min-h-0">
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
          <button type="button" onClick={() => { if (st.D.undo()) st.setSel(null); }} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!st.D.canUndo}><Undo2 size={13} /></button>
          <button type="button" onClick={() => { if (st.D.redo()) st.setSel(null); }} title="Làm lại" aria-label="Làm lại" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!st.D.canRedo}><Redo2 size={13} /></button>
          <button type="button" onClick={restore} disabled={!st.applied || !doc} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#e5e5e7] bg-white px-2.5 text-[12px] font-medium disabled:opacity-40"><RotateCcw size={12} /> Khôi phục mẫu</button>
          {cur?.surface === "spread" && <button type="button" onClick={relayout} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#e5e5e7] bg-white px-2.5 text-[12px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><LayoutTemplate size={12} /> Đổi bố cục trang này</button>}
          <span className="flex-1" />
          <Toggle checked={guides} onChange={setGuides} label="Guideline" />
        </div>
        <div ref={area} className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden px-2 py-1">
          {!cur ? (
            <div className="grid aspect-[2/1] w-full max-w-[520px] place-items-center rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-white text-center text-[14px] text-[#71717a]">
              <span><ImageIcon size={24} className="mx-auto mb-2" />Tải ảnh lên để web tự dàn booklet scrapbook</span>
            </div>
          ) : st.ready && (
            <SurfaceView key={st.active} t={cur} width={cur.surface === "spread" ? pagePx * 2 : pagePx} render={ro} guides={guides} sel={st.sel} onSel={st.setSel} editLayer={st.editLayer} onEditLayer={st.setEditLayer}
              begin={st.D.begin} setLayers={st.setLayers} adjustOf={(id) => st.adjust[id]} setAdjust={(id, a) => st.setAdjust((c) => ({ ...c, [id]: a }))}
              onDropAsset={(id, at) => { if (id.startsWith("u:") || id.startsWith("f:")) st.addAsset(id, at); else { const a = assets.find((x) => x.id === id); if (a) st.addAsset(a, at); } }}
              onDropPhoto={(pid, i) => st.assignPhoto(st.active, i, pid)} onEmptySlot={(i) => st.setPickFor(i)} editText={st.editText} onEditText={(i) => st.setEditText(i)} selectAllText={st.selectAll} textValue={st.textValue} onTextValue={st.setTextValue}
              onBackgroundDbl={(at) => setZoomPage(nos[cur.surface === "spread" && at.x >= 120 ? 1 : 0])} tools={st.tools} />
          )}
        </div>
        {doc && (
          <div className="px-3">
            <div className="flex items-center justify-center gap-1.5">
              <button type="button" onClick={() => go(st.active - 1)} disabled={st.active === 0} aria-label="Trang trước" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="min-w-[96px] text-center text-[12px] tabular-nums text-[#3f3f46]">{label} / {pages}</span>
              <button type="button" onClick={() => go(st.active + 1)} disabled={st.active >= count - 1} aria-label="Trang sau" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
            <div className="no-scrollbar mt-1 flex justify-center gap-1.5 overflow-x-auto pb-1">
              {doc.map((s, i) => (
                <button key={i} type="button" onClick={() => go(i)} className={cx("shrink-0 rounded-[4px] border p-px", i === st.active ? "border-[#ff5fa2]" : "border-[#e5e5e7]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[i] ? <img src={thumbs[i]} alt="" className="h-12" style={{ width: s.surface === "spread" ? 96 : 48 }} /> : <span className="block h-12 bg-[#ececef]" style={{ width: s.surface === "spread" ? 96 : 48 }} />}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex h-14 shrink-0 items-center gap-2 border-t border-[#efeff1] bg-[#f7f7f8] px-3">
          <div className="min-w-0 flex-1"><BgPicker value={bg} onChange={setBg} shop={backgrounds} /></div>
          {user && <Button variant="secondary" size="sm" icon={<Save size={16} />} onClick={saveAccount} loading={busy} disabled={!doc}>Lưu</Button>}
          <DownloadMenu busy={busy} up items={[
            { label: "Các trang (.zip)", icon: <FileStack size={16} />, onClick: dlPages },
            { label: "Dàn trang in (.zip)", icon: <Download size={16} />, onClick: dlImposed },
            { label: "Ảnh mockup (JPG)", icon: <Box size={16} />, onClick: dlMockup },
          ]} />
          <Button size="sm" icon={<ShoppingBag size={16} />} disabled={!doc || busy} onClick={() => { if (rightsOk) order(); else setRightsOpen(true); }}>Đặt in booklet này</Button>
        </div>
      </section>
     </div>
      {zoomPage !== null && zoomUrl && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4" onClick={() => setZoomPage(null)} role="dialog" aria-modal>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt={`Trang ${zoomPage}`} className="max-h-[90dvh] max-w-[90vw] shadow-2xl" />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] text-white/80">Trang {zoomPage} · bấm ra ngoài hoặc Esc để thoát</p>
        </div>
      )}
      {rightsOpen && <RightsModal onClose={() => setRightsOpen(false)} onOk={() => { setRightsOk(true); setRightsOpen(false); order(); }} />}
      {st.pickFor !== null && (
        <PickPhotoModal photos={photos} used={st.used} onClose={() => st.setPickFor(null)}
          onPick={(pid) => { st.assignPhoto(st.active, st.pickFor!, pid); st.setPickFor(null); }}
          onUpload={async (f) => { const i = st.pickFor!; const [p] = await st.addFiles([f]); if (p) st.assignPhoto(st.active, i, p.id); st.setPickFor(null); }} />
      )}
      {st.frameFor !== null && st.L[st.frameFor]?.k === "photo" && (
        <FramePicker frames={frames} sets={frameSets} loaded={st.frameImgs} title="Đổi khung" current={(st.L[st.frameFor] as { frame?: string }).frame ?? null} onPick={(c) => st.setFrame(st.frameFor!, c)} onClose={() => st.setFrameFor(null)} />
      )}
      {st.addSlotOpen && <FramePicker frames={frames} sets={frameSets} loaded={st.frameImgs} title="Thêm ô ảnh" allowNone={false} onPick={st.addSlot} onClose={() => st.setAddSlotOpen(false)} />}
      {st.stickerFiles && <UserStickerModal files={st.stickerFiles} onAdd={(b) => st.addUserSticker(b)} onClose={() => st.setStickerFiles(null)} />}
    </div>
  );
}
