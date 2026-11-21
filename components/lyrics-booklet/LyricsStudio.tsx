"use client";

/* Trang "Booklet Lyrics" (/thiet-ke/booklet-lyrics): khách nhập album, tracklist + lyrics, tải ảnh → web tự dàn booklet
   (lyrics 3 cột + ô ảnh) và bìa sau có tracklist. Trái 64% = xem trước (cặp trang như sách), phải 36% = panel nhập liệu.
   Mọi xử lý trên trình duyệt; chỉ tải lên khi khách đặt đơn (hoặc bấm Lưu khi đã đăng nhập). */
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/oswald/700.css";
import "@fontsource/anton/400.css";
import "@fontsource/dancing-script/700.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/400-italic.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/400-italic.css";
import "@fontsource/inter/700.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ClipboardList, ChevronLeft, ListMusic, Search, Undo2, X, ChevronRight, Dices, Download, FileStack, GripVertical, Image as ImageIcon, Minus, Plus, RefreshCw, Save, ShoppingBag, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { saveBlob, saveZip } from "@/lib/imageTools";
import { impose, impositionZipName, printGuide, sideFileName } from "@/lib/imposition";
import { cmToPx, JPG_QUALITY } from "@/lib/printSpecs";
import { savePendingFiles, type PendingFile } from "@/lib/pendingOrderFiles";
import { lineCount, minLyricPages } from "@/lib/lyricsBooklet/capacity";
import { cleanLyrics } from "@/lib/lyricsBooklet/clean";
import { bestMatch, fmtDuration, lyricsOf, norm, searchLyrics, type LrcResult } from "@/lib/lyricsBooklet/lrclib";
import { parseTrackList, splitAlbumLyrics, type Segment, type TrackRow } from "@/lib/lyricsBooklet/parse";
import { FEATURE_LYRICS_SUGGEST } from "@/lib/features";
import { buildBooklet } from "@/lib/lyricsBooklet/layout";
import { longRule } from "@/lib/lyricsBooklet/capacity";
import { repeatGroups } from "@/lib/lyricsBooklet/format";
import { flowLayout, flowPages, inBox, loadBookletFonts, paletteFromImage, renderBack, renderPage, type Ctx, type PageHit } from "@/lib/lyricsBooklet/render";
import { loadFromAccount, loadLocal, saveLocal, saveToAccount, type LyricsDoc } from "@/lib/lyricsBooklet/doc";
import { BACKS, LAYOUTS, MAX_LINE_CHARS, MAX_SONGS, PACKS, type Adjust, type Album, type BackId, type LayoutId, type LyricsSettings, type Song, DEFAULT_FORMAT, FONT_SIZES, type LyricsFormat, type LyricStyle } from "@/lib/lyricsBooklet/types";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { SaveDesignDialog } from "@/components/scrapbook/SaveDesignDialog";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";

type Photo = { id: string; blob: Blob; url: string; img: HTMLCanvasElement };
const uid = () => Math.random().toString(36).slice(2, 10);
const ACCEPT = "image/*";
const newSong = (i: number): Song => ({ id: uid(), title: `Bài ${i + 1}`, duration: "", lyrics: "", note: "", titleOnly: false });
async function readPhoto(blob: Blob, id = uid()): Promise<Photo> {
  const url = URL.createObjectURL(blob);
  const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("bad")); i.src = url; });
  const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, c.width, c.height);
  return { id, blob, url, img: c };
}
const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = JPG_QUALITY) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));
const pad = (n: number) => String(n).padStart(2, "0");

export function LyricsStudio({ settings, packIds }: { settings: LyricsSettings; packIds: Record<number, string> }) {
  const router = useRouter();
  const params = useSearchParams();
  const layouts = LAYOUTS.filter((l) => settings.layouts[l.id]);
  const backs = BACKS.filter((b) => settings.backs[b.id]);
  const [album, setAlbum] = useState<Album>({ title: "", artist: "", coverText: true });
  const [songs, setSongs] = useState<Song[]>(() => Array.from({ length: 5 }, (_, i) => newSong(i)));
  const [pack, setPack] = useState(8);
  const [packPicked, setPackPicked] = useState(false);
  const [layout, setLayout] = useState<LayoutId>(layouts[0]?.id ?? "minimal");
  const [back, setBack] = useState<BackId>(backs[0]?.id ?? "classic");
  const [paletteId, setPaletteId] = useState("auto");
  const [fmt, setFmt] = useState<LyricsFormat>(DEFAULT_FORMAT); // cỡ chữ lời + kiểu lời (cả booklet)
  const [seeds, setSeeds] = useState<Partial<Record<LayoutId, number>>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [backPhoto, setBackPhoto] = useState<Photo | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<Photo | null>(null); // ảnh bìa riêng (trang 1)
  const [rightsOk, setRightsOk] = useState(false); // đã tick cam kết bản quyền (lưu theo thiết kế)
  const [rightsOpen, setRightsOpen] = useState(false);
  const [rightsTick, setRightsTick] = useState(false);
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});
  const [tab, setTab] = useState<"booklet" | "back">("booklet");
  const [spread, setSpread] = useState(0);
  const [guides, setGuides] = useState(true);
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [modal, setModal] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [finding, setFinding] = useState<{ i: number; n: number } | null>(null);
  const [summary, setSummary] = useState<{ found: string[]; missing: string[]; error?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [designId, setDesignId] = useState<string | null>(params.get("design"));
  const [photoPaths, setPhotoPaths] = useState<Record<string, string>>({});
  const [dragSong, setDragSong] = useState<number | null>(null);
  const [dragPhoto, setDragPhoto] = useState<number | null>(null);
  const [thumbs, setThumbs] = useState<{ pages: string[]; layouts: Record<string, string>; backs: Record<string, string> }>({ pages: [], layouts: {}, backs: {} });
  const fileIn = useRef<HTMLInputElement>(null), replaceIn = useRef<HTMLInputElement>(null), backIn = useRef<HTMLInputElement>(null), coverIn = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 500 });
  const hits = useRef<Record<number, PageHit[]>>({});
  const drag = useRef<{ mode: "pan" | "press" | "swap"; page: number; slot: number; sx: number; sy: number; adj0?: Adjust; rot: number } | null>(null);

  // ---------- khởi động: font, bản nháp / thiết kế đã lưu, đăng nhập ----------
  useEffect(() => {
    let off = false;
    (async () => {
      await loadBookletFonts(settings.titleFont, settings.bodyFont);
      const id = params.get("design");
      const saved = id && hasSupabase ? await loadFromAccount(id).catch(() => null) : await loadLocal();
      if (saved && !off) {
        const { doc } = saved;
        const map: Record<string, Photo> = {};
        for (const p of saved.photos) { try { map[p.id] = await readPhoto(p.blob, p.id); } catch { /* bỏ ảnh lỗi */ } }
        setAlbum({ title: doc.album.title ?? "", artist: doc.album.artist ?? "", coverText: doc.album.coverText !== false });
        // bản nháp cũ: lời gợi ý "chờ duyệt" → điền thẳng (đánh dấu nguồn LRCLIB)
        const sg = doc.songs.map(({ pending, ...x }) => (pending ? { ...x, src: "lrclib" as const } : x));
        setSongs(sg.length ? sg : [newSong(0)]); setRightsOk(!!doc.rightsOk); setPack(doc.pack); setPackPicked(true);
        if (layouts.some((l) => l.id === doc.layout)) setLayout(doc.layout);
        if (backs.some((b) => b.id === doc.back)) setBack(doc.back);
        setPaletteId(doc.paletteId); setFmt({ ...DEFAULT_FORMAT, ...(doc.fmt ?? {}) }); setSeeds(doc.seeds ?? {}); setAdjust(doc.adjust ?? {}); setPhotoPaths(doc.photoPaths ?? {});
        // bản nháp cũ (chưa có ảnh bìa riêng): ảnh đầu tiên là ảnh bìa
        const legacy = doc.coverPhotoId === undefined;
        const list = doc.photoIds.map((i) => map[i]).filter(Boolean);
        setCoverPhoto(legacy ? list[0] ?? null : doc.coverPhotoId ? map[doc.coverPhotoId] ?? null : null);
        setPhotos(legacy ? list.slice(1) : list);
        setBackPhoto(doc.backPhotoId ? map[doc.backPhotoId] ?? null : null);
      }
      if (hasSupabase) { const { data } = await createClient().auth.getUser(); if (!off) setUser(!!data.user); }
      if (!off) setReady(true);
    })();
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const doc = useMemo<LyricsDoc>(() => ({
    v: 1, kind: "lyrics-booklet", album, songs, pack, layout, back, paletteId, seeds, adjust, fmt,
    photoIds: photos.map((p) => p.id), backPhotoId: backPhoto?.id ?? null, coverPhotoId: coverPhoto?.id ?? null, rightsOk, photoPaths,
  }), [album, songs, pack, layout, back, paletteId, seeds, adjust, fmt, photos, backPhoto, coverPhoto, rightsOk, photoPaths]);
  const allPhotos = useMemo(() => [...photos, ...(backPhoto ? [backPhoto] : []), ...(coverPhoto ? [coverPhoto] : [])].map((p) => ({ id: p.id, blob: p.blob })), [photos, backPhoto, coverPhoto]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { saveLocal(doc, allPhotos).catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [ready, doc, allPhotos]);

  const lay = songs;
  const chain = fmt.flow === "chain";
  // ---------- sức chứa / gói: bài dài đo theo CHIỀU CAO THẬT (font, cỡ chữ, kiểu lời, độ rộng cột) ----------
  const rule = useMemo(() => longRule({ bodyFont: settings.bodyFont, titleFont: settings.titleFont, minPt: settings.minFontPt, fmt }), [settings.bodyFont, settings.titleFont, settings.minFontPt, fmt, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Nối đuôi": sức chứa = tổng chiều cao chữ của tất cả bài trên tổng số cột (3 cột / trang lyrics)
  const mctx = useMemo(() => ({ songs: lay, bodyFont: settings.bodyFont, titleFont: settings.titleFont, minPt: settings.minFontPt, fmt }), [lay, settings.bodyFont, settings.titleFont, settings.minFontPt, fmt, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const flow = useMemo(() => (chain ? (() => { const f = flowLayout(mctx); return { cols: f.cols.length, endCol: f.endCol }; })() : null), [chain, mctx]);
  const need = chain ? flowPages(mctx) : minLyricPages(lay, rule);
  const fitsN = (n: number) => n - 1 >= need;
  const auto = PACKS.find(fitsN) ?? null;
  useEffect(() => { if (!packPicked && auto && auto !== pack) setPack(auto); }, [auto, pack, packPicked]);
  const fits = fitsN(pack);
  const setCount = (n: number) => setSongs((cur) => (n > cur.length ? [...cur, ...Array.from({ length: n - cur.length }, (_, i) => newSong(cur.length + i))] : cur.slice(0, n)));

  // ---------- dàn trang ----------
  const seed = seeds[layout] ?? 1;
  const built = useMemo(() => buildBooklet(layout, pack, lay, album, seed, rule, flow), [layout, pack, lay, album, seed, rule, flow]);
  const coverImg = coverPhoto?.img ?? null;
  const palette = useMemo(() => (paletteId === "auto" ? paletteFromImage(coverImg ?? photos[0]?.img ?? null) ?? settings.palettes[0] : settings.palettes.find((p) => p.id === paletteId) ?? settings.palettes[0]), [paletteId, coverImg, photos, settings.palettes]);
  const slotImgs = useMemo(() => photos.map((p) => p.img), [photos]);
  const slotAdj = useMemo(() => Object.fromEntries(photos.map((p, i) => [i, adjust[p.id]])), [photos, adjust]);
  const coverAdj = coverPhoto ? adjust[coverPhoto.id] : undefined;
  const ctx: Ctx = useMemo(() => ({ songs: lay, album, photos: slotImgs, adjust: slotAdj, palette, titleFont: settings.titleFont, bodyFont: settings.bodyFont, minPt: settings.minFontPt, fmt, cover: coverImg, coverAdj }), [lay, album, slotImgs, slotAdj, palette, settings, fmt, coverImg, coverAdj]);
  const spreads = useMemo(() => { const s: number[][] = [[1]]; for (let p = 2; p < pack; p += 2) s.push([p, p + 1]); s.push([pack]); return s; }, [pack]);
  const cur = spreads[Math.min(spread, spreads.length - 1)];
  useEffect(() => { if (spread > spreads.length - 1) setSpread(spreads.length - 1); }, [spread, spreads.length]);

  // khung xem trước vừa vùng còn trống
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // cuốn sách to nhất có thể: 1 trang = min(cao × 0.85, rộng × 0.92 / 2)
  const pagePx = Math.max(140, Math.floor(tab === "back" ? Math.min(box.w, box.h * (150 / 117)) - 8 : Math.min(box.h * 0.85, (box.w * 0.92) / 2)));
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomPage(null); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const zoomUrl = useMemo(() => {
    if (zoomPage === null || typeof window === "undefined") return "";
    const page = built.pages.find((p) => p.no === zoomPage);
    if (!page) return "";
    return renderPage(page, ctx, Math.min(1800, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.9 * Math.min(2, window.devicePixelRatio || 1)))).canvas.toDataURL("image/jpeg", 0.92);
  }, [zoomPage, built, ctx]);
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  const [views, setViews] = useState<Record<number, string>>({});
  const [backView, setBackView] = useState("");
  useEffect(() => {
    if (!ready) return;
    const out: Record<number, string> = {};
    for (const no of cur) {
      const page = built.pages.find((p) => p.no === no);
      if (!page) continue;
      const r = renderPage(page, { ...ctx, guides, editSlot, hoverSlot }, pagePx * dpr);
      hits.current[no] = r.hits;
      out[no] = r.canvas.toDataURL("image/jpeg", 0.9);
    }
    setViews(out);
  }, [ready, cur, built, ctx, guides, editSlot, hoverSlot, pagePx, dpr]);
  useEffect(() => {
    if (!ready || tab !== "back") return;
    setBackView(renderBack(back, { ...ctx, guides }, backPhoto?.img ?? null, Math.min(1800, pagePx * dpr)).toDataURL("image/jpeg", 0.9));
  }, [ready, tab, back, ctx, guides, backPhoto, pagePx, dpr]);
  // thumbnail: các trang, các mẫu dàn trang, các mẫu bìa sau (dựng từ chính dữ liệu của khách)
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const pages = built.pages.map((p) => renderPage(p, ctx, 110).canvas.toDataURL("image/jpeg", 0.8));
      const layThumbs: Record<string, string> = {};
      for (const l of layouts) {
        const b = buildBooklet(l.id, pack, lay, album, seeds[l.id] ?? 1, rule, flow);
        const c = document.createElement("canvas"); c.width = 240; c.height = 120;
        const x = c.getContext("2d")!;
        b.pages.filter((p) => p.no === 2 || p.no === 3).forEach((p) => x.drawImage(renderPage(p, ctx, 120).canvas, p.no === 2 ? 0 : 120, 0));
        layThumbs[l.id] = c.toDataURL("image/jpeg", 0.8);
      }
      const bk: Record<string, string> = {};
      for (const b of backs) bk[b.id] = renderBack(b.id, ctx, backPhoto?.img ?? null, 180).toDataURL("image/jpeg", 0.8);
      setThumbs({ pages, layouts: layThumbs, backs: bk });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, built, ctx, pack, lay, album, seeds, backPhoto, flow]);

  // ---------- tìm lời gợi ý cho tất cả bài chưa có lời (LRCLIB, xếp hàng 2 giây / lần) ----------
  async function findAll(list: Song[]) {
    const todo = list.filter((x) => !x.lyrics.trim() && !x.titleOnly && x.title.trim());
    if (!todo.length) return toast("Bài nào cũng đã có lời rồi.");
    const found: string[] = [], missing: string[] = [];
    let error = "";
    for (const [i, x] of todo.entries()) {
      setFinding({ i: i + 1, n: todo.length });
      const artist = x.artist || album.artist;
      try {
        let r = bestMatch(await searchLyrics(x.title, artist), x.title, artist, x.duration);
        if (!r && x.alt) r = bestMatch(await searchLyrics(x.alt, x.title), x.alt, x.title, x.duration); // "Ca sĩ - Tên bài": thử chiều ngược lại
        if (r) {
          const text = lyricsOf(r);
          // lời tìm được (đã dọn) điền thẳng vào bài — dàn vào booklet ngay, khách mở ra sửa được bất cứ lúc nào
          setSongs((c) => c.map((y) => (y.id === x.id ? { ...y, lyrics: text, src: "lrclib", duration: y.duration || fmtDuration(r!.duration) } : y)));
          found.push(x.title);
        } else missing.push(x.title);
      } catch (e) { error = e instanceof Error ? e.message : "Lỗi mạng"; missing.push(...todo.slice(i).map((y) => y.title)); break; }
    }
    setFinding(null);
    setSummary({ found, missing, error });
  }

  // ---------- ảnh ----------
  async function addFiles(list: FileList | File[]) {
    const out: Photo[] = [];
    for (const f of Array.from(list)) { try { out.push(await readPhoto(f)); } catch { toast(`Không đọc được ảnh "${f.name}"${/heic|heif/i.test(f.name) ? " (trình duyệt này chưa đọc được HEIC)" : ""}.`, "err"); } }
    setPhotos((c) => [...c, ...out]);
  }
  const swapSlots = (a: number, b: number) => setPhotos((c) => { const x = [...c]; if (!x[a] || !x[b]) return c; [x[a], x[b]] = [x[b], x[a]]; return x; });

  // ---------- tương tác trên trang ----------
  const toMM = (el: HTMLElement, e: { clientX: number; clientY: number }) => { const r = el.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 120, y: ((e.clientY - r.top) / r.height) * 120 }; };
  const hitAt = (no: number, x: number, y: number) => [...(hits.current[no] ?? [])].reverse().find((h) => inBox(x, y, h));
  function onDown(no: number, e: React.PointerEvent<HTMLImageElement>) {
    const p = toMM(e.currentTarget, e), h = hitAt(no, p.x, p.y);
    if (!h) { setEditSlot(null); return; }
    if (h.k === "song") { setEditSlot(null); setModal(h.song); return; }
    if (h.k === "cover") { setEditSlot(null); if (!coverPhoto) coverIn.current?.click(); return; }
    if (!photos[h.slot]) { fileIn.current?.click(); return; } // ô trống: bấm để tải ảnh
    e.currentTarget.setPointerCapture(e.pointerId);
    const ph = photos[h.slot];
    drag.current = editSlot === h.slot ? { mode: "pan", page: no, slot: h.slot, sx: p.x, sy: p.y, adj0: adjust[ph.id] ?? { dx: 0, dy: 0, zoom: 1 }, rot: h.rot } : { mode: "press", page: no, slot: h.slot, sx: p.x, sy: p.y, rot: h.rot };
  }
  const targetAt = (e: { clientX: number; clientY: number }) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const no = Number(el?.dataset?.page);
    if (!el || !no) return null;
    const p = toMM(el, e), h = hitAt(no, p.x, p.y);
    return h && h.k === "photo" ? h.slot : null;
  };
  function onMove(e: React.PointerEvent<HTMLImageElement>) {
    const d = drag.current;
    if (!d) return;
    const p = toMM(e.currentTarget, e);
    if (d.mode === "pan") {
      const ph = photos[d.slot];
      if (!ph) return;
      const a = (-d.rot * Math.PI) / 180, dx = p.x - d.sx, dy = p.y - d.sy;
      setAdjust((c) => ({ ...c, [ph.id]: { ...d.adj0!, dx: d.adj0!.dx + dx * Math.cos(a) - dy * Math.sin(a), dy: d.adj0!.dy + dx * Math.sin(a) + dy * Math.cos(a) } }));
    } else {
      if (d.mode === "press" && Math.hypot(p.x - d.sx, p.y - d.sy) > 2.5) d.mode = "swap";
      if (d.mode === "swap") { const t = targetAt(e); setHoverSlot(t !== null && t !== d.slot ? t : null); }
    }
  }
  function onUp(e: React.PointerEvent<HTMLImageElement>) {
    const d = drag.current;
    drag.current = null; setHoverSlot(null);
    if (!d) return;
    if (d.mode === "press") setEditSlot(d.slot);
    if (d.mode === "swap") { const t = targetAt(e); if (t !== null && t !== d.slot) { swapSlots(d.slot, t); toast("Đã đổi chỗ 2 ảnh"); } }
  }
  const zoom = useCallback((dz: number) => {
    if (editSlot === null) return;
    const ph = photos[editSlot];
    if (!ph) return;
    setAdjust((c) => { const a = c[ph.id] ?? { dx: 0, dy: 0, zoom: 1 }; return { ...c, [ph.id]: { ...a, zoom: Math.min(3, Math.max(1, Math.round((a.zoom + dz) * 100) / 100)) } }; });
  }, [editSlot, photos]);

  // ---------- xuất file / lưu / đặt in ----------
  const pageBlobs = async () => {
    await loadBookletFonts(settings.titleFont, settings.bodyFont);
    const px = cmToPx(12), out: Blob[] = [], canv: HTMLCanvasElement[] = [];
    for (const p of built.pages) { const c = renderPage(p, { ...ctx, mode: "print" }, px).canvas; canv.push(c); out.push(await toBlob(c)); }
    return { blobs: out, canvases: canv };
  };
  const backBlob = async () => toBlob(renderBack(back, { ...ctx, mode: "print" }, backPhoto?.img ?? null, cmToPx(15)));
  async function run(fn: () => Promise<void>) { setBusy(true); try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : "Có lỗi, bạn thử lại nhé.", "err"); } setBusy(false); }
  const dlPages = () => run(async () => { const { blobs } = await pageBlobs(); await saveZip(blobs.map((b, i) => ({ name: `${pad(i + 1)}.jpg`, blob: b })), "Booklet-Lyrics-cac-trang.zip"); toast("Đã tải xuống"); });
  const dlImposed = () => run(async () => {
    const { canvases } = await pageBlobs();
    const px = cmToPx(12), files = [];
    for (const s of impose(pack)) {
      const c = document.createElement("canvas"); c.width = px * 2; c.height = px;
      const x = c.getContext("2d")!; x.drawImage(canvases[s.left - 1], 0, 0); x.drawImage(canvases[s.right - 1], px, 0);
      files.push({ name: sideFileName(s), blob: await toBlob(c) });
    }
    files.push({ name: "HUONG-DAN-IN.txt", blob: new Blob([printGuide(pack)], { type: "text/plain;charset=utf-8" }) });
    await saveZip(files, impositionZipName(pack)); toast("Đã tải xuống");
  });
  const dlBack = () => run(async () => { saveBlob(await backBlob(), "Bia-sau-tracklist-15x11.7cm.jpg"); toast("Đã tải xuống"); });
  const orderId = packIds[pack];
  const order = () => run(async () => {
    if (!fits) throw new Error(`Lyrics dài quá, cần tối thiểu ${PACKS.find((n) => n - 1 >= need) ?? 16} trang`);
    const { blobs } = await pageBlobs();
    const px = cmToPx(12);
    const files: PendingFile[] = blobs.map((b, i) => ({ kind: "booklet", page: i + 1, name: `booklet-trang-${pad(i + 1)}.jpg`, blob: b, w: px, h: px }));
    files.push({ kind: "back", page: null, name: "bia-sau-tracklist.jpg", blob: await backBlob(), w: cmToPx(15), h: cmToPx(11.7) });
    await savePendingFiles(files); // giữ trên máy, gắn vào đơn ngay sau khi đặt
    router.push(`/san-pham/in-cd-theo-yeu-cau?goi=${encodeURIComponent(orderId!)}`);
  });
  const saveAccount = () => run(async () => {
    const cover = renderPage(built.pages[0], ctx, 360).canvas.toDataURL("image/jpeg", 0.8);
    const r = await saveToAccount(doc, allPhotos, { id: designId, name: album.title || "Booklet Lyrics", thumbnail: cover });
    setDesignId(r.id); setPhotoPaths(r.paths);
    toast("Đã lưu vào Thiết kế của tôi", "ok", { label: "Xem", href: "/thiet-ke-cua-toi" });
  });

  const label = cur.length === 1 ? `Trang ${cur[0]} / ${pack}` : `Trang ${cur[0]}–${cur[1]} / ${pack}`;
  const minPack = PACKS.find((n) => n - 1 >= need);

  return (
    <div data-fit-screen data-editor="" className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     <EditorHeader h={{ busy, onSave: () => setSaveOpen(true), guides: { value: guides, onChange: setGuides }, downloads: [
       { label: "Các trang booklet (.zip)", onClick: dlPages }, { label: "Dàn trang in (.zip)", onClick: dlImposed }, { label: "Bìa sau (JPG)", onClick: dlBack },
     ] }} />
     {saveOpen && <SaveDesignDialog onClose={() => setSaveOpen(false)} onSave={async () => { await saveAccount(); setUser(true); }} />}
     <div className="flex w-full flex-1 flex-col md:min-h-0 md:flex-row">
      {/* ---------- Trái ~64%: xem trước ---------- */}
      <section className="relative flex min-h-[460px] min-w-0 flex-1 flex-col md:order-2 md:min-h-0">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
            {(["booklet", "back"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setTab(k); setEditSlot(null); }}
                className={cx("rounded-[6px] px-3 py-1.5 text-[13px] font-medium", tab === k ? "bg-[var(--c-secondary)] text-[var(--c-primary)]" : "text-[#52525b]")}>{k === "booklet" ? "Booklet" : "Bìa sau"}</button>
            ))}
          </div>
        </div>
        <div ref={area} className="relative flex min-h-[300px] flex-1 items-center justify-center px-2 py-1">
          {tab === "booklet" ? (
            <div className="flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
              {cur.map((no) => (
                // eslint-disable-next-line @next/next/no-img-element
                views[no] ? <img key={no} src={views[no]} alt={`Trang ${no}`} data-page={no} draggable={false}
                  className={cx("block touch-none select-none", editSlot !== null ? "cursor-move" : "cursor-pointer")} style={{ width: pagePx, height: pagePx }}
                  onPointerDown={(e) => onDown(no, e)} onDoubleClick={() => { setEditSlot(null); setModal(null); setZoomPage(no); }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setHoverSlot(null); }} />
                  : <div key={no} className="animate-pulse bg-[#ececef]" style={{ width: pagePx, height: pagePx }} />
              ))}
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            backView ? <img src={backView} alt="Bìa sau" className="block shadow-[0_10px_30px_rgba(0,0,0,0.12)]" style={{ width: pagePx, height: pagePx * (117 / 150) }} /> : null
          )}
          {editSlot !== null && tab === "booklet" && (
            <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[12px] text-[#52525b] shadow">
              <span className="px-1">Ảnh {editSlot + 1}: kéo để dịch</span>
              <button type="button" onClick={() => zoom(-0.1)} aria-label="Thu nhỏ" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Minus size={14} /></button>
              <button type="button" onClick={() => zoom(0.1)} aria-label="Phóng to" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Plus size={14} /></button>
              <button type="button" onClick={() => setEditSlot(null)} className="rounded-full bg-[var(--c-primary)] px-2.5 py-1 font-medium text-white">Xong</button>
            </div>
          )}
        </div>
        {tab === "booklet" && (
          <div className="px-4">
            <div className="flex items-center justify-center gap-1.5">
              <button type="button" onClick={() => setSpread((s) => Math.max(0, s - 1))} disabled={spread === 0} aria-label="Trang trước" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="min-w-[96px] text-center text-[12px] tabular-nums text-[#3f3f46]">{label}</span>
              <button type="button" onClick={() => setSpread((s) => Math.min(spreads.length - 1, s + 1))} disabled={spread >= spreads.length - 1} aria-label="Trang sau" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
            <div className="no-scrollbar mt-1 flex justify-center gap-1.5 overflow-x-auto pb-1">
              {spreads.map((sp, i) => (
                <button key={i} type="button" onClick={() => setSpread(i)} className={cx("flex shrink-0 gap-px rounded-[6px] border p-0.5", i === spread ? "border-[var(--c-primary)]" : "border-[#e5e5e7]")}>
                  {sp.map((no) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    thumbs.pages[no - 1] ? <img key={no} src={thumbs.pages[no - 1]} alt="" className="h-12 w-12" /> : <span key={no} className="h-12 w-12 bg-[#ececef]" />
                  ))}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* hành động */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-2">
          {orderId
            ? <Button size="sm" icon={<ShoppingBag size={16} />} onClick={() => { if (rightsOk) order(); else { setRightsTick(false); setRightsOpen(true); } }} disabled={busy || !fits}>Đặt in booklet này</Button>
            : <Button size="sm" href="/lien-he">Liên hệ tiệm để in {pack} trang</Button>}
        </div>
      </section>

      {/* ---------- Trái: panel nhập liệu (full màn hình, giống các trình thiết kế khác) ---------- */}
      <aside className="space-y-6 border-[#e5e5e7] bg-white p-6 md:order-1 md:w-[380px] md:shrink-0 md:overflow-y-auto md:border-r">
        <Section title="Thông tin album">
          <div className="grid gap-2">
            {/* ảnh bìa riêng — dùng cho trang 1, không lấy từ mục Ảnh */}
            <div className="flex items-center gap-3">
              {coverPhoto ? (
                <div className="group relative aspect-square w-24 shrink-0 overflow-hidden rounded-[8px] border border-[#e5e5e7]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverPhoto.url} alt="Ảnh bìa" className="h-full w-full object-cover" draggable={false} />
                  <div className="absolute bottom-1 right-1 flex gap-1 md:inset-0 md:items-center md:justify-center md:bg-black/40 md:opacity-0 md:group-hover:opacity-100">
                    <button type="button" title="Thay ảnh" aria-label="Thay ảnh bìa" onClick={() => coverIn.current?.click()} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#18181b] shadow"><RefreshCw size={12} /></button>
                    <button type="button" title="Xoá" aria-label="Xoá ảnh bìa" onClick={() => setCoverPhoto(null)} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#dc2626] shadow"><Trash2 size={12} /></button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => coverIn.current?.click()} onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { try { setCoverPhoto(await readPhoto(f)); } catch { toast("Không đọc được ảnh.", "err"); } } }}
                  className="grid aspect-square w-24 shrink-0 place-items-center rounded-[8px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] text-center text-[12px] font-medium text-[#52525b] hover:border-[var(--c-primary)]">
                  <span><Plus size={16} className="mx-auto mb-0.5 text-[#a1a1aa]" />Ảnh bìa</span>
                </button>
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-medium">Ảnh bìa</p>
                <p className="text-[12px] text-[#71717a]">Dùng cho trang 1 (bìa booklet).</p>
                <Toggle checked={album.coverText !== false} onChange={(v) => setAlbum({ ...album, coverText: v })} label="Chèn tên album lên bìa" />
              </div>
              <input ref={coverIn} type="file" accept={ACCEPT} className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setCoverPhoto(await readPhoto(f)); } catch { toast("Không đọc được ảnh.", "err"); } } }} />
            </div>
            {album.coverText !== false && (
              <>
                <In value={album.title} onChange={(v) => setAlbum({ ...album, title: v })} placeholder="Tên album" />
                <In value={album.artist} onChange={(v) => setAlbum({ ...album, artist: v })} placeholder="Tên nghệ sĩ (hoặc “Dành tặng …”)" />
              </>
            )}
          </div>
        </Section>

        <Section title="Số bài và số trang">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#52525b]">Số bài</span>
              <button type="button" onClick={() => setCount(Math.max(1, songs.length - 1))} disabled={songs.length <= 1} aria-label="Bớt bài" className="grid h-8 w-8 place-items-center rounded-full border border-[#e5e5e7] disabled:opacity-40"><Minus size={14} /></button>
              <span className="w-6 text-center text-[15px] font-semibold tabular-nums">{songs.length}</span>
              <button type="button" onClick={() => setCount(Math.min(MAX_SONGS, songs.length + 1))} disabled={songs.length >= MAX_SONGS} aria-label="Thêm bài" className="grid h-8 w-8 place-items-center rounded-full border border-[#e5e5e7] disabled:opacity-40"><Plus size={14} /></button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-[13px] text-[#52525b]">Số trang</span>
              {PACKS.map((n) => {
                const ok = fitsN(n);
                return (
                  <button key={n} type="button" disabled={!ok} title={ok ? `${n} trang` : `Không đủ chỗ để dàn trang cho ${songs.length} bài`} onClick={() => { setPack(n); setPackPicked(true); setSpread(0); }}
                    className={cx("h-8 min-w-[40px] rounded-full border px-3 text-[13px] font-medium", pack === n ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b]", !ok && "cursor-not-allowed opacity-40")}>{n}</button>
                );
              })}
            </div>
          </div>
          {!fits && minPack && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#dc2626]">
              Lyrics dài quá, cần tối thiểu {minPack} trang
              <button type="button" onClick={() => { setPack(minPack); setPackPicked(true); }} className="rounded-full border border-[#dc2626] px-2.5 py-0.5 text-[12px]">Đổi sang {minPack} trang</button>
            </p>
          )}
          {!fits && !minPack && <p className="mt-2 text-[13px] font-medium text-[#dc2626]">Lyrics dài quá cho booklet 16 trang — bớt bài, chọn cỡ chữ nhỏ hơn hoặc kiểu “Rút gọn lặp” / “Liền dòng”.</p>}
          {/* cỡ chữ lời + kiểu lời (cả booklet) — đổi thì tính lại sức chứa */}
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-[#52525b]">Cỡ chữ lời</span>
              {FONT_SIZES.map((f) => <button key={f.id} type="button" onClick={() => setFmt({ ...fmt, size: f.id })} className={fchip(fmt.size === f.id)}>{f.name}</button>)}
            </div>
            {fmt.size === "xsmall" && <p className="text-[12px] text-[#ea7a12]">Chữ dưới 6pt có thể khó đọc khi in.</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-[#52525b]">Kiểu lời</span>
              {LYRIC_STYLES.map(([k, t]) => <button key={k} type="button" onClick={() => setFmt({ ...fmt, style: k })} className={fchip(fmt.style === k)}>{t}</button>)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-[#52525b]">Xếp bài</span>
              {([["block", "Mỗi bài 1 khối"], ["chain", "Nối đuôi"]] as const).map(([k, t]) => <button key={k} type="button" onClick={() => setFmt({ ...fmt, flow: k })} className={fchip((fmt.flow ?? "block") === k)}>{t}</button>)}
            </div>
            {chain && fmt.style === "original" && <p className="text-[12px] text-[#71717a]">Chọn Rút gọn lặp hoặc Liền dòng để tiết kiệm diện tích hơn.</p>}
            {fmt.style !== "original" && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#52525b]">
                <label className="flex items-center gap-1.5">Nhãn đoạn lặp
                  <select value={fmt.lang} onChange={(e) => setFmt({ ...fmt, lang: e.target.value as "en" | "vi" })} className="h-7 rounded-[6px] border border-[#e5e5e7] px-1">
                    <option value="en">English (Chorus…)</option><option value="vi">Tiếng Việt (Điệp khúc…)</option>
                  </select>
                </label>
                {fmt.style === "inline" && (
                  <>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={fmt.paraBreak === "newline"} onChange={(e) => setFmt({ ...fmt, paraBreak: e.target.checked ? "newline" : "slashes" })} className="accent-[var(--c-primary)]" /> Xuống dòng giữa các đoạn</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={fmt.titleInline} onChange={(e) => setFmt({ ...fmt, titleInline: e.target.checked })} className="accent-[var(--c-primary)]" /> Tên bài liền dòng với lời</label>
                  </>
                )}
              </div>
            )}
          </div>
        </Section>

        <Section title="Tracklist">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setImportOpen(true)} className={chip}><ListMusic size={13} /> Dán danh sách bài</button>
            <button type="button" onClick={() => setAlbumOpen(true)} className={chip}><ClipboardList size={13} /> Dán lời cả album</button>
            {FEATURE_LYRICS_SUGGEST && <button type="button" onClick={() => findAll(songs)} disabled={!!finding} className={chip}><Search size={13} /> Tìm lời cho tất cả</button>}
          </div>
          {finding && (
            <div className="mb-2">
              <p className="mb-1 text-[12px] text-[#52525b]">Đang tìm {finding.i} / {finding.n}...</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]"><div className="h-full bg-[var(--c-primary)] transition-[width]" style={{ width: `${(finding.i / finding.n) * 100}%` }} /></div>
            </div>
          )}
          <ol className="space-y-1.5">
            {songs.map((s, i) => {
              const has = !!s.lyrics.trim() || s.titleOnly;
              return (
                <li key={s.id} draggable onDragStart={() => setDragSong(i)} onDragEnd={() => setDragSong(null)} onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (dragSong !== null && dragSong !== i) setSongs((c) => { const a = [...c]; const [x] = a.splice(dragSong, 1); a.splice(i, 0, x); return a; }); setDragSong(null); }}
                  className={cx("flex items-center gap-2 rounded-[8px] border border-[#e5e5e7] px-2 py-1.5", dragSong === i && "opacity-40")}>
                  <GripVertical size={14} className="shrink-0 cursor-grab text-[#a1a1aa]" />
                  <span className="w-5 shrink-0 text-right text-[13px] tabular-nums text-[#71717a]">{i + 1}</span>
                  <input value={s.title} onChange={(e) => setSongs((c) => c.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} aria-label={`Tên bài ${i + 1}`}
                    className="min-w-0 flex-1 rounded-[6px] px-1.5 py-1 text-[14px] outline-none focus:bg-[#fafafa]" />
                  <input value={s.duration} onChange={(e) => setSongs((c) => c.map((x) => (x.id === s.id ? { ...x, duration: e.target.value.slice(0, 6) } : x)))} placeholder="3:45" aria-label="Thời lượng"
                    className="w-14 shrink-0 rounded-[6px] px-1.5 py-1 text-center text-[13px] tabular-nums outline-none focus:bg-[#fafafa]" />
                  <button type="button" onClick={() => setModal(i)} title={has ? "Sửa lyrics" : "Thêm lyrics"} aria-label={has ? "Sửa lyrics" : "Thêm lyrics"}
                    className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", has ? "bg-[#ecfdf3] text-[#16a34a]" : "border border-[#e5e5e7] text-[#52525b] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]")}>
                    {has ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section title="Mẫu dàn trang" right={<span className="text-[12px] text-[#71717a]">Cần {built.photoCount} ảnh</span>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {layouts.map((l) => (
              <button key={l.id} type="button" onClick={() => { setLayout(l.id); setEditSlot(null); }}
                className={cx("rounded-[10px] border p-1 text-center", layout === l.id ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbs.layouts[l.id] ? <img src={thumbs.layouts[l.id]} alt="" className="aspect-[2/1] w-full rounded-[6px]" /> : <span className="block aspect-[2/1] w-full rounded-[6px] bg-[#f4f4f5]" />}
                <span className="mt-1 block truncate text-[12px] text-[#52525b]">{l.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setSeeds((s) => ({ ...s, [layout]: Math.floor(Math.random() * 1e6) }))}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium text-[#52525b] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"><Dices size={14} /> Xáo trộn</button>
            <span className="ml-2 text-[12px] text-[#71717a]">Màu:</span>
            {[{ id: "auto", name: "Tự động (theo ảnh bìa)", bg: paletteFromImage(coverImg ?? photos[0]?.img ?? null)?.bg ?? "#eee" }, ...settings.palettes].map((p) => (
              <button key={p.id} type="button" onClick={() => setPaletteId(p.id)} title={p.name} aria-label={p.name}
                className={cx("h-7 w-7 rounded-full border", paletteId === p.id ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/30" : "border-[#d4d4d8]")} style={{ background: p.bg }}>
                {p.id === "auto" && <span className="text-[9px] font-bold text-[#52525b]">A</span>}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Ảnh" right={<span className={cx("text-[12px]", photos.length < built.photoCount ? "text-[#ea7a12]" : "text-[#71717a]")}>Đã có {photos.length} / {built.photoCount} ảnh</span>}>
          <button type="button" onClick={() => fileIn.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
            className="grid w-full place-items-center rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] px-4 py-4 text-center hover:border-[var(--c-primary)]">
            <Upload size={18} className="mb-1 text-[#a1a1aa]" />
            <span className="text-[14px] font-medium">Kéo thả hoặc chọn nhiều ảnh</span>
            <span className="text-[12px] text-[#71717a]">Dùng cho các ô ảnh bên trong booklet · ảnh chỉ xử lý trên máy bạn</span>
          </button>
          <input ref={fileIn} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={replaceIn} type="file" accept={ACCEPT} className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; const id = replaceId.current; if (f && id) { try { const p = await readPhoto(f); setPhotos((c) => c.map((x) => (x.id === id ? p : x))); } catch { toast("Không đọc được ảnh.", "err"); } } }} />
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {photos.map((p, i) => (
                <div key={p.id} draggable onDragStart={() => setDragPhoto(i)} onDragEnd={() => setDragPhoto(null)} onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (dragPhoto !== null && dragPhoto !== i) setPhotos((c) => { const a = [...c]; const [x] = a.splice(dragPhoto, 1); a.splice(i, 0, x); return a; }); setDragPhoto(null); }}
                  className={cx("group relative aspect-square cursor-grab overflow-hidden rounded-[8px] border border-[#e5e5e7]", dragPhoto === i && "opacity-40")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" draggable={false} />
                  <span className="pointer-events-none absolute left-1 top-1 rounded-[4px] bg-black/70 px-1 text-[10px] font-medium leading-[15px] text-white">{i + 1}</span>
                  <div className="absolute bottom-1 right-1 flex gap-1 md:inset-0 md:items-center md:justify-center md:bg-black/40 md:opacity-0 md:group-hover:opacity-100">
                    <button type="button" title="Thay ảnh" aria-label="Thay ảnh" onClick={() => { replaceId.current = p.id; replaceIn.current?.click(); }} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#18181b] shadow"><RefreshCw size={12} /></button>
                    <button type="button" title="Xoá" aria-label="Xoá" onClick={() => setPhotos((c) => c.filter((x) => x.id !== p.id))} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#dc2626] shadow"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Bìa sau">
          {album.coverText === false && (
            <div className="mb-3 grid gap-2">
              <In value={album.title} onChange={(v) => setAlbum({ ...album, title: v })} placeholder="Tên album (in ở gáy và bìa sau)" />
              <In value={album.artist} onChange={(v) => setAlbum({ ...album, artist: v })} placeholder="Tên nghệ sĩ (in ở gáy)" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {backs.map((b) => (
              <button key={b.id} type="button" onClick={() => { setBack(b.id); setTab("back"); }}
                className={cx("rounded-[10px] border p-1 text-center", back === b.id ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbs.backs[b.id] ? <img src={thumbs.backs[b.id]} alt="" className="aspect-[150/117] w-full rounded-[6px]" /> : <span className="block aspect-[150/117] w-full rounded-[6px] bg-[#f4f4f5]" />}
                <span className="mt-1 block truncate text-[12px] text-[#52525b]">{b.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ImageIcon size={14} />} onClick={() => backIn.current?.click()}>{backPhoto ? "Đổi ảnh nền bìa sau" : "Ảnh nền bìa sau (không bắt buộc)"}</Button>
            {backPhoto && <button type="button" onClick={() => setBackPhoto(null)} className="text-[12px] text-[#dc2626] hover:text-[#b91c1c]">Bỏ ảnh</button>}
            <input ref={backIn} type="file" accept={ACCEPT} className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setBackPhoto(await readPhoto(f)); } catch { toast("Không đọc được ảnh.", "err"); } } }} />
          </div>
        </Section>
      </aside>
     </div>
      {modal !== null && songs[modal] && (
        <SongModal index={modal} song={songs[modal]} maxLines={settings.maxLines} defaultArtist={album.artist} lang={fmt.lang} globalStyle={fmt.style} onClose={() => setModal(null)}
          onSave={(s) => { setSongs((c) => c.map((x, i) => (i === modal ? s : x))); setModal(null); }} />
      )}
      {importOpen && (
        <ImportModal defaultArtist={album.artist} current={songs.length} onClose={() => setImportOpen(false)}
          onConfirm={(rows, mode, suggest) => {
            setImportOpen(false);
            // bài đã có lyrics thì giữ nguyên lyrics nếu tên bài không đổi
            const byTitle = new Map(songs.map((x) => [norm(x.title), x]));
            const fresh = rows.map((r, i) => {
              const old = byTitle.get(norm(r.title));
              return old ? { ...old, title: r.title, artist: r.artist, alt: r.alt, duration: r.duration || old.duration } : { ...newSong(i), title: r.title, artist: r.artist, alt: r.alt, duration: r.duration };
            });
            const next = (mode === "replace" ? fresh : [...songs, ...fresh]).slice(0, MAX_SONGS);
            if (mode === "append" && songs.length + fresh.length > MAX_SONGS) toast(`Tối đa ${MAX_SONGS} bài — chỉ thêm ${MAX_SONGS - songs.length} bài đầu.`, "err");
            setSongs(next); setPackPicked(false);
            if (suggest && FEATURE_LYRICS_SUGGEST) setTimeout(() => findAll(next), 0);
          }} />
      )}
      {albumOpen && (
        <AlbumModal songs={songs} maxLines={settings.maxLines} onClose={() => setAlbumOpen(false)}
          onConfirm={(segs) => {
            setSongs((c) => c.map((x, i) => { const g = segs.find((sg) => sg.song === i); return g ? { ...x, lyrics: cleanLyrics(g.lyrics), src: undefined, titleOnly: false } : x; }));
            setAlbumOpen(false); toast(`Đã điền lời cho ${segs.length} bài`);
          }} />
      )}
      {zoomPage !== null && zoomUrl && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4" onClick={() => setZoomPage(null)} role="dialog" aria-modal>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt={`Trang ${zoomPage}`} className="max-h-[90dvh] max-w-[90vw] shadow-2xl" />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] text-white/80">Trang {zoomPage} · bấm ra ngoài hoặc Esc để thoát</p>
        </div>
      )}
      {rightsOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={() => setRightsOpen(false)}>
          <div className="w-full max-w-[420px] rounded-[14px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-semibold">Trước khi đặt in</p>
            <label className="mt-3 flex items-start gap-2 text-[14px] text-[#3f3f46]">
              <input type="checkbox" checked={rightsTick} onChange={(e) => setRightsTick(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-primary)]" />
              Tôi chịu trách nhiệm về bản quyền nội dung (lời bài hát, hình ảnh) trong thiết kế này.
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRightsOpen(false)}>Huỷ</Button>
              <Button disabled={!rightsTick} onClick={() => { setRightsOk(true); setRightsOpen(false); order(); }}>Tiếp tục</Button>
            </div>
          </div>
        </div>
      )}
      {summary && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={() => setSummary(null)}>
          <div className="w-full max-w-[460px] rounded-[14px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-semibold">Kết quả tìm lời gợi ý</p>
            {summary.error && <p className="mt-2 text-[13px] text-[#dc2626]">{summary.error}</p>}
            <p className="mt-3 text-[13px] font-medium text-[#16a34a]">Tìm được {summary.found.length} bài</p>
            {summary.found.length > 0 && <p className="text-[13px] text-[#52525b]">{summary.found.join(", ")}</p>}
            <p className="mt-2 text-[13px] font-medium text-[#ea7a12]">Không tìm được {summary.missing.length} bài</p>
            {summary.missing.length > 0 && <p className="text-[13px] text-[#52525b]">{summary.missing.join(", ")}</p>}
            <p className="mt-3 text-[12px] text-[#71717a]">Lời tìm được đã điền thẳng vào từng bài và dàn vào booklet. Bấm vào bài để xem và sửa nếu cần.</p>
            <div className="mt-4 flex justify-end"><Button onClick={() => setSummary(null)}>Đã hiểu</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const LYRIC_STYLES: [LyricStyle, string][] = [["original", "Nguyên bản"], ["collapse", "Rút gọn lặp"], ["inline", "Liền dòng /"]];
const fchip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[12px] font-medium", on ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
const chip = "inline-flex h-8 items-center gap-1 rounded-full border border-[#e5e5e7] px-2.5 text-[12px] font-medium text-[#52525b] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] disabled:opacity-50";

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2"><p className="text-[14px] font-semibold text-[#18181b]">{title}</p>{right}</div>
      {children}
    </section>
  );
}
function In({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={80} className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[var(--c-primary)]" />;
}

// ---------- Modal lyrics 1 bài ----------
function SongModal({ index, song, maxLines, defaultArtist, lang, globalStyle, onClose, onSave }: { index: number; song: Song; maxLines: number; defaultArtist: string; lang: "en" | "vi"; globalStyle: LyricStyle; onClose: () => void; onSave: (s: Song) => void }) {
  const [s, setS] = useState(song);
  const [err, setErr] = useState("");
  const [undo, setUndo] = useState<string | null>(null); // bản gốc trước khi dọn lời (nút Hoàn tác)
  const [results, setResults] = useState<LrcResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const artist = s.artist ?? defaultArtist;
  const lines = lineCount(s.lyrics);
  const raw = s.lyrics.replace(/\r/g, "").split("\n");
  const over = raw.length > maxLines || raw.some((l) => l.length > MAX_LINE_CHARS);
  function setLyrics(v: string) {
    const ls = v.replace(/\r/g, "").split("\n");
    if (ls.length > maxLines) { setErr(`Tối đa ${maxLines} dòng mỗi bài.`); return; }
    if (ls.some((l) => l.length > MAX_LINE_CHARS)) { setErr(`Mỗi dòng tối đa ${MAX_LINE_CHARS} ký tự.`); return; }
    setErr(""); setS({ ...s, lyrics: v });
  }
  // dán → tự dọn lời, giữ bản gốc để Hoàn tác
  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const t = e.clipboardData.getData("text");
    if (!t) return;
    e.preventDefault();
    const el = e.currentTarget, full = el.value.slice(0, el.selectionStart) + t + el.value.slice(el.selectionEnd);
    const cleaned = cleanLyrics(full);
    setUndo(full); setErr("");
    setS({ ...s, lyrics: cleaned, src: undefined });
  }
  async function find() {
    if (!s.title.trim()) return setSearchErr("Nhập tên bài trước khi tìm.");
    setSearching(true); setSearchErr(""); setResults(null);
    try { setResults((await searchLyrics(s.title, artist)).slice(0, 5)); }
    catch (e2) { setSearchErr(e2 instanceof Error ? e2.message : "Lỗi mạng"); }
    setSearching(false);
  }
  function pick(r: LrcResult) {
    const text = lyricsOf(r);
    setUndo(null); setErr(""); setResults(null);
    setS({ ...s, lyrics: text, src: "lrclib", duration: s.duration || fmtDuration(r.duration) });
  }
  const hasLyrics = !!s.lyrics.trim() && !s.titleOnly;
  const effStyle = s.style ?? globalStyle;
  const groups = useMemo(() => (effStyle === "original" ? [] : repeatGroups(s.lyrics, { lang, labels: s.labels })), [effStyle, s.lyrics, s.labels, lang]);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[#efeff1] px-5 py-3"><p className="text-[16px] font-semibold">Lyrics bài {index + 1}</p></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-2">
            <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="Tên bài" maxLength={80}
              className="h-10 min-w-[160px] flex-1 rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[var(--c-primary)]" />
            {FEATURE_LYRICS_SUGGEST && (
              <>
                <input value={artist} onChange={(e) => setS({ ...s, artist: e.target.value })} placeholder="Ca sĩ (không bắt buộc)" maxLength={80}
                  className="h-10 w-40 rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[var(--c-primary)]" />
                <Button variant="secondary" icon={<Search size={15} />} loading={searching} onClick={find}>Tìm lời gợi ý</Button>
              </>
            )}
          </div>
          {searchErr && <p className="text-[13px] text-[#dc2626]">{searchErr}</p>}
          {results && (results.length ? (
            <ul className="divide-y divide-[#efeff1] overflow-hidden rounded-[10px] border border-[#e5e5e7]">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => pick(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#fff5f9]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{r.trackName}</span>
                      <span className="block truncate text-[12px] text-[#71717a]">{[r.artistName, r.albumName].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-[#71717a]">{fmtDuration(r.duration)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#52525b]">Không tìm thấy lời cho bài này, bạn vui lòng dán lời vào ô bên dưới.</p>)}
          <div>
            {s.src === "lrclib" && hasLyrics && <p className="mb-1 text-[12px] text-[#a1a1aa]">Lời gợi ý từ cộng đồng LRCLIB, có thể chưa chính xác</p>}
            <textarea value={s.lyrics} onChange={(e) => setLyrics(e.target.value)} onPaste={onPaste} rows={12} placeholder="Dán lyrics vào đây — web tự dọn nhãn [Chorus], dòng rác, mốc thời gian; giữ nguyên ngắt dòng của bạn." disabled={s.titleOnly}
              className="w-full rounded-[8px] border border-[#e5e5e7] px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[var(--c-primary)] disabled:bg-[#fafafa]" />
            <div className="mt-1 flex items-center justify-between gap-2 text-[12px]">
              <span className="flex items-center gap-2">
                {undo !== null && <button type="button" onClick={() => { setS({ ...s, lyrics: undo }); setUndo(null); }} className="inline-flex items-center gap-1 font-medium text-[var(--c-primary)] hover:text-[#e0468a]"><Undo2 size={12} /> Hoàn tác (lấy lại bản gốc)</button>}
                <span className="text-[#dc2626]">{err || (over ? `Vượt giới hạn ${maxLines} dòng / ${MAX_LINE_CHARS} ký tự mỗi dòng — sửa bớt trước khi lưu.` : "")}</span>
              </span>
              <span className={cx("tabular-nums", lines >= maxLines ? "text-[#dc2626]" : "text-[#71717a]")}>{lines} / {maxLines} dòng</span>
            </div>
          </div>
          <input value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} placeholder="Ghi chú dưới bài (không bắt buộc, ví dụ “Sáng tác: …”)" maxLength={120}
            className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[var(--c-primary)]" />
          <label className="flex items-center gap-2 text-[13px] text-[#3f3f46]">
            <input type="checkbox" checked={s.titleOnly} onChange={(e) => setS({ ...s, titleOnly: e.target.checked })} className="h-4 w-4 accent-[var(--c-primary)]" /> Chỉ in tên bài
          </label>
          {/* kiểu lời riêng của bài + các đoạn lặp phát hiện được (chỉ đổi cách hiển thị, không sửa lời gốc) */}
          <label className="flex items-center gap-2 text-[13px] text-[#3f3f46]">Kiểu lời
            <select value={s.style ?? ""} onChange={(e) => setS({ ...s, style: (e.target.value || undefined) as LyricStyle | undefined })} className="h-8 rounded-[6px] border border-[#e5e5e7] px-1 text-[13px]">
              <option value="">Theo cài đặt chung</option>
              {LYRIC_STYLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
          {groups.length > 0 && (
            <div className="rounded-[8px] border border-[#e5e5e7] p-2">
              <p className="mb-1 text-[12px] font-medium text-[#52525b]">Đoạn lặp phát hiện được</p>
              <table className="w-full text-[12px]">
                <tbody>
                  {groups.map((g) => {
                    const off = s.noMerge?.includes(g.key);
                    return (
                      <tr key={g.key} className="border-t border-[#efeff1]">
                        <td className="py-1 pr-2"><input value={s.labels?.[g.key] ?? g.name} onChange={(e) => setS({ ...s, labels: { ...(s.labels ?? {}), [g.key]: e.target.value } })} className="h-7 w-28 rounded-[6px] border border-[#e5e5e7] px-1" aria-label="Tên nhãn" disabled={off} /></td>
                        <td className="truncate py-1 text-[#71717a]">×{g.count} · {g.preview}</td>
                        <td className="whitespace-nowrap py-1 pl-2"><label className="flex items-center gap-1"><input type="checkbox" checked={!!off} onChange={(e) => setS({ ...s, noMerge: e.target.checked ? [...(s.noMerge ?? []), g.key] : (s.noMerge ?? []).filter((k) => k !== g.key) })} className="accent-[var(--c-primary)]" /> Không gộp đoạn này</label></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#efeff1] px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button disabled={hasLyrics && over} onClick={() => onSave({ ...s, lyrics: cleanLyrics(s.lyrics) })}>Lưu</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Modal "Dán danh sách bài" ----------
function ImportModal({ defaultArtist, current, onClose, onConfirm }: {
  defaultArtist: string; current: number; onClose: () => void; onConfirm: (rows: TrackRow[], mode: "replace" | "append", suggest: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [common, setCommon] = useState(defaultArtist);
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [suggest, setSuggest] = useState(true);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const r = parseTrackList(text, common).map((x) => ({ ...x, artist: x.artist || common }));
    setCut(r.length > MAX_SONGS);
    setRows(r.slice(0, MAX_SONGS));
  }, [text, common]);
  const set = (i: number, v: Partial<TrackRow>) => setRows((c) => c.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[#efeff1] px-5 py-3"><p className="text-[16px] font-semibold">Dán danh sách bài</p></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <input value={common} onChange={(e) => setCommon(e.target.value)} placeholder="Ca sĩ chung (dùng cho dòng không ghi ca sĩ)" className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[var(--c-primary)]" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} autoFocus
            placeholder={"Drive By - May Jailer\nNext To Me - May Jailer\nA Star For Nick"}
            className="w-full rounded-[8px] border border-[#e5e5e7] px-3 py-2 text-[14px] outline-none focus:border-[var(--c-primary)]" />
          <p className="text-[12px] text-[#71717a]">Mỗi dòng 1 bài. Nhận “Tên bài - Ca sĩ”, “1. Tên bài”, “01) Tên bài”, “Tên bài (3:45)”.</p>
          {cut && <p className="text-[13px] text-[#ea7a12]">Chỉ lấy {MAX_SONGS} bài đầu (tối đa {MAX_SONGS} bài).</p>}
          {rows.length > 0 && (
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[12px] text-[#71717a]"><th className="w-8 py-1">#</th><th>Tên bài</th><th>Ca sĩ</th><th className="w-20">Thời lượng</th><th className="w-6" /></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-[#efeff1]">
                    <td className="py-1 tabular-nums text-[#71717a]">{i + 1}</td>
                    <td><input value={r.title} onChange={(e) => set(i, { title: e.target.value })} className="h-8 w-full rounded-[6px] px-1.5 outline-none focus:bg-[#fafafa]" /></td>
                    <td><input value={r.artist} onChange={(e) => set(i, { artist: e.target.value })} className="h-8 w-full rounded-[6px] px-1.5 outline-none focus:bg-[#fafafa]" /></td>
                    <td><input value={r.duration} onChange={(e) => set(i, { duration: e.target.value.slice(0, 6) })} className="h-8 w-full rounded-[6px] px-1.5 tabular-nums outline-none focus:bg-[#fafafa]" /></td>
                    <td><button type="button" onClick={() => setRows((c) => c.filter((_, j) => j !== i))} aria-label="Xoá dòng" className="text-[#a1a1aa] hover:text-[#dc2626]"><X size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {FEATURE_LYRICS_SUGGEST && (
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} className="h-4 w-4 accent-[var(--c-primary)]" /> Tìm lời gợi ý cho các bài này luôn</label>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#efeff1] px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button variant="secondary" disabled={!rows.length || current >= MAX_SONGS} onClick={() => onConfirm(rows, "append", suggest)}>Thêm vào cuối</Button>
          <Button disabled={!rows.length} onClick={() => onConfirm(rows, "replace", suggest)}>Thay tracklist hiện tại</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Modal "Dán lời cả album" ----------
function AlbumModal({ songs, maxLines, onClose, onConfirm }: { songs: Song[]; maxLines: number; onClose: () => void; onConfirm: (segs: Segment[]) => void }) {
  const [text, setText] = useState("");
  const [segs, setSegs] = useState<Segment[]>([]);
  useEffect(() => { setSegs(splitAlbumLyrics(text, songs.map((x) => x.title))); }, [text, songs]);
  const active = segs.filter((x) => x.song !== null);
  const tooLong = (x: Segment) => x.lyrics.split("\n").length > maxLines || x.lyrics.split("\n").some((l) => l.length > MAX_LINE_CHARS);
  const dup = new Set(active.map((x) => x.song)).size !== active.length;
  const blocked = !active.length || active.some(tooLong) || dup;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[#efeff1] px-5 py-3"><p className="text-[16px] font-semibold">Dán lời cả album</p></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} autoFocus placeholder="Dán 1 khối lời gồm nhiều bài — mỗi bài bắt đầu bằng 1 dòng là tên bài (trùng với tên trong tracklist)."
            className="w-full rounded-[8px] border border-[#e5e5e7] px-3 py-2 text-[14px] outline-none focus:border-[var(--c-primary)]" />
          {text.trim() && !segs.length && <p className="text-[13px] text-[#ea7a12]">Chưa nhận ra tên bài nào — kiểm tra tên bài trong tracklist có khớp với dòng tên bài trong khối lời không.</p>}
          {segs.length > 0 && (
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[12px] text-[#71717a]"><th className="py-1">Bài</th><th className="w-16">Số dòng</th><th>2 dòng đầu</th></tr></thead>
              <tbody>
                {segs.map((x, i) => {
                  const bad = x.song !== null && tooLong(x);
                  return (
                    <tr key={i} className={cx("border-t border-[#efeff1] align-top", bad && "bg-[#fef2f2]")}>
                      <td className="py-1.5 pr-2">
                        <select value={x.song === null ? "" : String(x.song)} onChange={(e) => setSegs((c) => c.map((y, j) => (j === i ? { ...y, song: e.target.value === "" ? null : Number(e.target.value) } : y)))}
                          className="h-8 w-full max-w-[200px] rounded-[6px] border border-[#e5e5e7] text-[12px]">
                          <option value="">— Bỏ đoạn này —</option>
                          {songs.map((sg, k) => <option key={sg.id} value={k}>{k + 1}. {sg.title}</option>)}
                        </select>
                      </td>
                      <td className={cx("py-1.5 tabular-nums", bad ? "font-semibold text-[#dc2626]" : "text-[#52525b]")}>{x.lyrics.split("\n").length}{bad ? ` > ${maxLines}` : ""}</td>
                      <td className="py-1.5 text-[12px] text-[#52525b]">{x.lyrics.split("\n").filter(Boolean).slice(0, 2).join(" / ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {dup && <p className="text-[13px] text-[#dc2626]">Có 2 đoạn cùng gán vào 1 bài — đổi bài hoặc bỏ bớt 1 đoạn.</p>}
          {active.some(tooLong) && <p className="text-[13px] text-[#dc2626]">Đoạn tô đỏ vượt giới hạn {maxLines} dòng / {MAX_LINE_CHARS} ký tự mỗi dòng — bỏ đoạn đó hoặc sửa khối lời rồi dán lại.</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#efeff1] px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button disabled={blocked} onClick={() => onConfirm(active)}>Điền lời cho {active.length} bài</Button>
        </div>
      </div>
    </div>
  );
}
