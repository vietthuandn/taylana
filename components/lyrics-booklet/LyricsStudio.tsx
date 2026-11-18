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
import { Check, ChevronLeft, ChevronRight, Dices, Download, FileStack, GripVertical, Image as ImageIcon, Minus, Plus, RefreshCw, Save, ShoppingBag, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { saveBlob, saveZip } from "@/lib/imageTools";
import { impose, sideFileName } from "@/lib/imposition";
import { cmToPx, JPG_QUALITY } from "@/lib/printSpecs";
import { savePendingFiles, type PendingFile } from "@/lib/pendingOrderFiles";
import { cleanLyrics, lineCount, minLyricPages, packFits, smallestPack } from "@/lib/lyricsBooklet/capacity";
import { buildBooklet } from "@/lib/lyricsBooklet/layout";
import { inBox, loadBookletFonts, paletteFromImage, renderBack, renderPage, type Ctx, type PageHit } from "@/lib/lyricsBooklet/render";
import { loadFromAccount, loadLocal, saveLocal, saveToAccount, type LyricsDoc } from "@/lib/lyricsBooklet/doc";
import { BACKS, LAYOUTS, MAX_LINE_CHARS, MAX_SONGS, PACKS, type Adjust, type Album, type BackId, type LayoutId, type LyricsSettings, type Song } from "@/lib/lyricsBooklet/types";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";

type Photo = { id: string; blob: Blob; url: string; img: HTMLCanvasElement };
const uid = () => Math.random().toString(36).slice(2, 10);
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
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
  const [album, setAlbum] = useState<Album>({ title: "", artist: "", year: "", credit: "" });
  const [songs, setSongs] = useState<Song[]>(() => Array.from({ length: 5 }, (_, i) => newSong(i)));
  const [pack, setPack] = useState(8);
  const [packPicked, setPackPicked] = useState(false);
  const [layout, setLayout] = useState<LayoutId>(layouts[0]?.id ?? "minimal");
  const [back, setBack] = useState<BackId>(backs[0]?.id ?? "classic");
  const [paletteId, setPaletteId] = useState("auto");
  const [seeds, setSeeds] = useState<Partial<Record<LayoutId, number>>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [backPhoto, setBackPhoto] = useState<Photo | null>(null);
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});
  const [tab, setTab] = useState<"booklet" | "back">("booklet");
  const [spread, setSpread] = useState(0);
  const [guides, setGuides] = useState(true);
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [modal, setModal] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(false);
  const [designId, setDesignId] = useState<string | null>(params.get("design"));
  const [photoPaths, setPhotoPaths] = useState<Record<string, string>>({});
  const [dragSong, setDragSong] = useState<number | null>(null);
  const [dragPhoto, setDragPhoto] = useState<number | null>(null);
  const [thumbs, setThumbs] = useState<{ pages: string[]; layouts: Record<string, string>; backs: Record<string, string> }>({ pages: [], layouts: {}, backs: {} });
  const fileIn = useRef<HTMLInputElement>(null), replaceIn = useRef<HTMLInputElement>(null), backIn = useRef<HTMLInputElement>(null);
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
        setAlbum(doc.album); setSongs(doc.songs.length ? doc.songs : [newSong(0)]); setPack(doc.pack); setPackPicked(true);
        if (layouts.some((l) => l.id === doc.layout)) setLayout(doc.layout);
        if (backs.some((b) => b.id === doc.back)) setBack(doc.back);
        setPaletteId(doc.paletteId); setSeeds(doc.seeds ?? {}); setAdjust(doc.adjust ?? {}); setPhotoPaths(doc.photoPaths ?? {});
        setPhotos(doc.photoIds.map((i) => map[i]).filter(Boolean));
        setBackPhoto(doc.backPhotoId ? map[doc.backPhotoId] ?? null : null);
      }
      if (hasSupabase) { const { data } = await createClient().auth.getUser(); if (!off) setUser(!!data.user); }
      if (!off) setReady(true);
    })();
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const doc = useMemo<LyricsDoc>(() => ({
    v: 1, kind: "lyrics-booklet", album, songs, pack, layout, back, paletteId, seeds, adjust,
    photoIds: photos.map((p) => p.id), backPhotoId: backPhoto?.id ?? null, photoPaths,
  }), [album, songs, pack, layout, back, paletteId, seeds, adjust, photos, backPhoto, photoPaths]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { saveLocal(doc, [...photos, ...(backPhoto ? [backPhoto] : [])].map((p) => ({ id: p.id, blob: p.blob }))).catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [ready, doc, photos, backPhoto]);

  // ---------- sức chứa / gói ----------
  const need = minLyricPages(songs, settings.longLines);
  const auto = smallestPack(songs, settings.longLines);
  useEffect(() => { if (!packPicked && auto && auto !== pack) setPack(auto); }, [auto, pack, packPicked]);
  const fits = packFits(pack, songs, settings.longLines);
  const setCount = (n: number) => setSongs((cur) => (n > cur.length ? [...cur, ...Array.from({ length: n - cur.length }, (_, i) => newSong(cur.length + i))] : cur.slice(0, n)));

  // ---------- dàn trang ----------
  const seed = seeds[layout] ?? 1;
  const built = useMemo(() => buildBooklet(layout, pack, songs, album, seed, settings.longLines), [layout, pack, songs, album, seed, settings.longLines]);
  const palette = useMemo(() => (paletteId === "auto" ? paletteFromImage(photos[0]?.img ?? null) ?? settings.palettes[0] : settings.palettes.find((p) => p.id === paletteId) ?? settings.palettes[0]), [paletteId, photos, settings.palettes]);
  const slotImgs = useMemo(() => photos.map((p) => p.img), [photos]);
  const slotAdj = useMemo(() => Object.fromEntries(photos.map((p, i) => [i, adjust[p.id]])), [photos, adjust]);
  const ctx: Ctx = useMemo(() => ({ songs, album, photos: slotImgs, adjust: slotAdj, palette, titleFont: settings.titleFont, bodyFont: settings.bodyFont, minPt: settings.minFontPt }), [songs, album, slotImgs, slotAdj, palette, settings]);
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
  const pagePx = Math.max(140, Math.floor(Math.min(tab === "back" ? box.w : box.w / 2, tab === "back" ? box.h * (150 / 117) : box.h) - 8));
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
      const lay: Record<string, string> = {};
      for (const l of layouts) {
        const b = buildBooklet(l.id, pack, songs, album, seeds[l.id] ?? 1, settings.longLines);
        const c = document.createElement("canvas"); c.width = 240; c.height = 120;
        const x = c.getContext("2d")!;
        b.pages.filter((p) => p.no === 2 || p.no === 3).forEach((p) => x.drawImage(renderPage(p, ctx, 120).canvas, p.no === 2 ? 0 : 120, 0));
        lay[l.id] = c.toDataURL("image/jpeg", 0.8);
      }
      const bk: Record<string, string> = {};
      for (const b of backs) bk[b.id] = renderBack(b.id, ctx, backPhoto?.img ?? null, 180).toDataURL("image/jpeg", 0.8);
      setThumbs({ pages, layouts: lay, backs: bk });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, built, ctx, pack, songs, album, seeds, backPhoto]);

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
    await saveZip(files, "Booklet-Lyrics-dan-trang-in.zip"); toast("Đã tải xuống");
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
    const r = await saveToAccount(doc, [...photos, ...(backPhoto ? [backPhoto] : [])].map((p) => ({ id: p.id, blob: p.blob })), { id: designId, name: album.title || "Booklet Lyrics", thumbnail: cover });
    setDesignId(r.id); setPhotoPaths(r.paths);
    toast("Đã lưu vào Thiết kế của tôi", "ok", { label: "Xem", href: "/thiet-ke-cua-toi" });
  });

  const label = cur.length === 1 ? `Trang ${cur[0]} / ${pack}` : `Trang ${cur[0]}–${cur[1]} / ${pack}`;
  const minPack = PACKS.find((n) => n - 1 >= need);

  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col md:min-h-0 md:flex-row md:border-x md:border-[#e5e5e7]">
      {/* ---------- Trái ~64%: xem trước ---------- */}
      <section className="relative flex min-h-[460px] min-w-0 flex-1 flex-col md:min-h-0">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
            {(["booklet", "back"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setTab(k); setEditSlot(null); }}
                className={cx("rounded-[6px] px-3 py-1.5 text-[13px] font-medium", tab === k ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]")}>{k === "booklet" ? "Booklet" : "Bìa sau"}</button>
            ))}
          </div>
          <div className="ml-auto"><Toggle checked={guides} onChange={setGuides} label="Hiển thị guideline" /></div>
        </div>
        <div ref={area} className="relative flex min-h-[300px] flex-1 items-center justify-center px-4 py-3">
          {tab === "booklet" ? (
            <div className="flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
              {cur.map((no) => (
                // eslint-disable-next-line @next/next/no-img-element
                views[no] ? <img key={no} src={views[no]} alt={`Trang ${no}`} data-page={no} draggable={false}
                  className={cx("block touch-none select-none", editSlot !== null ? "cursor-move" : "cursor-pointer")} style={{ width: pagePx, height: pagePx }}
                  onPointerDown={(e) => onDown(no, e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setHoverSlot(null); }} />
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
              <button type="button" onClick={() => setEditSlot(null)} className="rounded-full bg-[#ff5fa2] px-2.5 py-1 font-medium text-white">Xong</button>
            </div>
          )}
        </div>
        {tab === "booklet" && (
          <div className="px-4">
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" icon={<ChevronLeft size={16} />} onClick={() => setSpread((s) => Math.max(0, s - 1))} disabled={spread === 0}>Trước</Button>
              <span className="min-w-[120px] text-center text-[13px] tabular-nums text-[#3f3f46]">{label}</span>
              <Button variant="secondary" size="sm" onClick={() => setSpread((s) => Math.min(spreads.length - 1, s + 1))} disabled={spread >= spreads.length - 1}>Sau <ChevronRight size={16} /></Button>
            </div>
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
              {spreads.map((sp, i) => (
                <button key={i} type="button" onClick={() => setSpread(i)} className={cx("flex shrink-0 gap-px rounded-[6px] border p-0.5", i === spread ? "border-[#ff5fa2]" : "border-[#e5e5e7]")}>
                  {sp.map((no) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    thumbs.pages[no - 1] ? <img key={no} src={thumbs.pages[no - 1]} alt="" className="h-11 w-11" /> : <span key={no} className="h-11 w-11 bg-[#ececef]" />
                  ))}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* hành động */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
          {user && <Button variant="secondary" size="sm" icon={<Save size={16} />} onClick={saveAccount} loading={busy}>Lưu</Button>}
          <DownloadMenu busy={busy} up items={[
            { label: "Các trang booklet (.zip)", icon: <FileStack size={16} />, onClick: dlPages },
            { label: "Dàn trang in (.zip)", icon: <Download size={16} />, onClick: dlImposed },
            { label: "Bìa sau (JPG)", icon: <ImageIcon size={16} />, onClick: dlBack },
          ]} />
          {orderId
            ? <Button size="sm" icon={<ShoppingBag size={16} />} onClick={order} disabled={busy || !fits}>Đặt in booklet này</Button>
            : <Button size="sm" href="/lien-he">Liên hệ tiệm để in {pack} trang</Button>}
        </div>
      </section>

      {/* ---------- Phải 36%: panel nhập liệu ---------- */}
      <aside className="space-y-6 border-[#e5e5e7] bg-white p-6 md:w-[36%] md:min-w-[360px] md:shrink-0 md:overflow-y-auto md:border-l">
        <Section title="Thông tin album">
          <div className="grid gap-2">
            <In value={album.title} onChange={(v) => setAlbum({ ...album, title: v })} placeholder="Tên album" />
            <In value={album.artist} onChange={(v) => setAlbum({ ...album, artist: v })} placeholder="Tên nghệ sĩ (hoặc “Dành tặng …”)" />
            <In value={album.year} onChange={(v) => setAlbum({ ...album, year: v })} placeholder="Năm (không bắt buộc)" />
            <textarea value={album.credit} onChange={(e) => setAlbum({ ...album, credit: e.target.value })} placeholder="Lời cảm ơn / credit (không bắt buộc, in ở trang cuối)" rows={3}
              className="w-full rounded-[8px] border border-[#e5e5e7] px-3 py-2 text-[14px] outline-none focus:border-[#ff5fa2]" />
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
                const ok = packFits(n, songs, settings.longLines);
                return (
                  <button key={n} type="button" disabled={!ok} title={ok ? `${n} trang` : `Không đủ chỗ để dàn trang cho ${songs.length} bài`} onClick={() => { setPack(n); setPackPicked(true); setSpread(0); }}
                    className={cx("h-8 min-w-[40px] rounded-full border px-3 text-[13px] font-medium", pack === n ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b]", !ok && "cursor-not-allowed opacity-40")}>{n}</button>
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
          {!fits && !minPack && <p className="mt-2 text-[13px] font-medium text-[#dc2626]">Lyrics dài quá cho booklet 16 trang — bớt bài hoặc rút gọn lyrics.</p>}
        </Section>

        <Section title="Tracklist">
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
                    className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", has ? "bg-[#ecfdf3] text-[#16a34a]" : "border border-[#e5e5e7] text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]")}>
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
                className={cx("rounded-[10px] border p-1 text-center", layout === l.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbs.layouts[l.id] ? <img src={thumbs.layouts[l.id]} alt="" className="aspect-[2/1] w-full rounded-[6px]" /> : <span className="block aspect-[2/1] w-full rounded-[6px] bg-[#f4f4f5]" />}
                <span className="mt-1 block truncate text-[12px] text-[#52525b]">{l.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setSeeds((s) => ({ ...s, [layout]: Math.floor(Math.random() * 1e6) }))}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /> Xáo trộn</button>
            <span className="ml-2 text-[12px] text-[#71717a]">Màu:</span>
            {[{ id: "auto", name: "Tự động (theo ảnh bìa)", bg: paletteFromImage(photos[0]?.img ?? null)?.bg ?? "#eee" }, ...settings.palettes].map((p) => (
              <button key={p.id} type="button" onClick={() => setPaletteId(p.id)} title={p.name} aria-label={p.name}
                className={cx("h-7 w-7 rounded-full border", paletteId === p.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#d4d4d8]")} style={{ background: p.bg }}>
                {p.id === "auto" && <span className="text-[9px] font-bold text-[#52525b]">A</span>}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Ảnh" right={<span className={cx("text-[12px]", photos.length < built.photoCount ? "text-[#ea7a12]" : "text-[#71717a]")}>Đã có {photos.length} / {built.photoCount} ảnh</span>}>
          <button type="button" onClick={() => fileIn.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
            className="grid w-full place-items-center rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] px-4 py-4 text-center hover:border-[#ff5fa2]">
            <Upload size={18} className="mb-1 text-[#a1a1aa]" />
            <span className="text-[14px] font-medium">Kéo thả hoặc chọn nhiều ảnh</span>
            <span className="text-[12px] text-[#71717a]">Ảnh 1 luôn là ảnh bìa booklet · ảnh chỉ xử lý trên máy bạn</span>
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
                  <span className="pointer-events-none absolute left-1 top-1 rounded-[4px] bg-black/70 px-1 text-[10px] font-medium leading-[15px] text-white">{i === 0 ? "Bìa" : i + 1}</span>
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
          <div className="grid grid-cols-2 gap-2">
            {backs.map((b) => (
              <button key={b.id} type="button" onClick={() => { setBack(b.id); setTab("back"); }}
                className={cx("rounded-[10px] border p-1 text-center", back === b.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
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
        <SongModal index={modal} song={songs[modal]} maxLines={settings.maxLines} onClose={() => setModal(null)}
          onSave={(s) => { setSongs((c) => c.map((x, i) => (i === modal ? s : x))); setModal(null); }} />
      )}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2"><p className="text-[14px] font-semibold text-[#18181b]">{title}</p>{right}</div>
      {children}
    </section>
  );
}
function In({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={80} className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />;
}

// ---------- Modal lyrics 1 bài ----------
function SongModal({ index, song, maxLines, onClose, onSave }: { index: number; song: Song; maxLines: number; onClose: () => void; onSave: (s: Song) => void }) {
  const [s, setS] = useState(song);
  const [agree, setAgree] = useState(!!song.lyrics.trim());
  const [err, setErr] = useState("");
  const lines = lineCount(s.lyrics);
  function setLyrics(v: string) {
    const ls = v.replace(/\r/g, "").split("\n");
    if (ls.length > maxLines) { setErr(`Tối đa ${maxLines} dòng mỗi bài.`); return; }
    if (ls.some((l) => l.length > MAX_LINE_CHARS)) { setErr(`Mỗi dòng tối đa ${MAX_LINE_CHARS} ký tự.`); return; }
    setErr(""); setS({ ...s, lyrics: v });
  }
  const hasLyrics = !!s.lyrics.trim() && !s.titleOnly;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[#efeff1] px-5 py-3"><p className="text-[16px] font-semibold">Lyrics bài {index + 1}</p></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="Tên bài" maxLength={80}
            className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
          <div>
            <textarea value={s.lyrics} onChange={(e) => setLyrics(e.target.value)} rows={12} placeholder="Dán lyrics vào đây — giữ nguyên ngắt dòng của bạn, 1 dòng trống để ngăn đoạn." disabled={s.titleOnly}
              className="w-full rounded-[8px] border border-[#e5e5e7] px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[#ff5fa2] disabled:bg-[#fafafa]" />
            <div className="mt-1 flex justify-between text-[12px]">
              <span className="text-[#dc2626]">{err}</span>
              <span className={cx("tabular-nums", lines >= maxLines ? "text-[#dc2626]" : "text-[#71717a]")}>{lines} / {maxLines} dòng</span>
            </div>
          </div>
          <input value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} placeholder="Ghi chú dưới bài (không bắt buộc, ví dụ “Sáng tác: …”)" maxLength={120}
            className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
          <label className="flex items-center gap-2 text-[13px] text-[#3f3f46]">
            <input type="checkbox" checked={s.titleOnly} onChange={(e) => setS({ ...s, titleOnly: e.target.checked })} className="h-4 w-4 accent-[#ff5fa2]" /> Chỉ in tên bài
          </label>
          {hasLyrics && (
            <label className="flex items-start gap-2 text-[13px] text-[#3f3f46]">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff5fa2]" />
              Tôi có quyền sử dụng lời bài hát này và tự chịu trách nhiệm về bản quyền.
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#efeff1] px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button disabled={hasLyrics && !agree} onClick={() => onSave({ ...s, lyrics: cleanLyrics(s.lyrics) })}>Lưu</Button>
        </div>
      </div>
    </div>
  );
}
