"use client";

/* Trang "CD Scrapbook" (/thiet-ke/scrapbook): khách tải 5–10 ảnh → web tự dựng 5 mẫu mặt đĩa kiểu scrapbook xé dán.
   Trái 36%: 3 tab Ảnh (tải ảnh, thứ tự, chọn mẫu) · Sticker (thêm chất liệu) · Chữ (font thường / chữ cắt dán).
   Phải: mặt đĩa — sửa mẫu tự do: bấm chọn lớp, kéo di chuyển, kéo góc phóng / thu, núm xoay, bấm đúp ô ảnh để chỉnh ảnh trong khung,
   menu chuột phải / thanh công cụ nổi (Nhân bản · Lên trên · Xuống dưới · Xoá), Delete · Ctrl+D · Ctrl+Z / Ctrl+Shift+Z · mũi tên,
   đường gióng vào tâm đĩa + các vòng tròn đồng tâm. Ảnh của khách chỉ xử lý trên trình duyệt — chỉ tải lên khi đặt đơn. */
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
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Box, Copy, Dices, Download, Image as ImageIcon, Minus, Plus, Redo2, RefreshCw, RotateCcw, ShoppingBag, Trash2, Undo2, Upload } from "lucide-react";
import { GRADIENTS, paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import type { MockupBackground } from "@/lib/mockup/types";
import { defaultGlass } from "@/lib/mockup/types";
import { loadImg } from "@/lib/mockup/images";
import { renderSystem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { saveBlob } from "@/lib/imageTools";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { loadDraft, saveDraft } from "@/lib/scrapbook/draft";
import { savePendingDisc } from "@/lib/scrapbook/pending";
import { loadFonts, renderDisc, type TextHit } from "@/lib/scrapbook/render";
import { templatesFor } from "@/lib/scrapbook/templates";
import { applyBox, boxOf, inside, snap, type Box as LBox } from "@/lib/scrapbook/edit";
import { drawCutout, layoutCutout, loadCutoutFont, type CutoutFont, type Glyph, type LoadedFont } from "@/lib/scrapbook/cutout";
import { MAX_PHOTOS, MIN_PHOTOS, PRINT_PX, STYLES, type Adjust, type DiscText, type Layer, type ScrapAsset, type Style, type Template, type TemplateSetting } from "@/lib/scrapbook/types";
import { BgPicker } from "@/components/mockup-viewer/BgPicker";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { useFitBox } from "@/components/mockup-viewer/useFitBox";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { ASSET_DRAG, StickerTab } from "./StickerTab";
import { TextTab } from "./TextTab";

type Photo = { id: string; name: string; blob: Blob; url: string; img: HTMLCanvasElement };
type Snapshot = { work: Template | null; edited: boolean };
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

async function readPhoto(file: Blob, name: string, id = uid()): Promise<Photo> {
  const url = URL.createObjectURL(file);
  const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("bad")); i.src = url; });
  const k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, c.width, c.height);
  return { id, name, blob: file, url, img: c };
}
const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));
const keyOf = (t: Template | undefined) => (t ? `${t.n}-${t.style}-${t.seed}-${t.layers.length}` : "");

export function ScrapbookStudio({ assets, settings, fonts, glyphs, backgrounds, boxPackageId }: {
  assets: ScrapAsset[]; settings: TemplateSetting[]; fonts: CutoutFont[]; glyphs: Glyph[]; backgrounds: MockupBackground[]; boxPackageId: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"anh" | "sticker" | "chu">("anh");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [text, setText] = useState<DiscText>({ main: "Happy Birthday", sub: "" });
  const [style, setStyle] = useState<Style | null>(null);
  const [seeds, setSeeds] = useState<Partial<Record<Style, number>>>({});
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});
  const [work, setWork] = useState<Template | null>(null); // mẫu đang sửa tự do (null = mẫu gốc)
  const [edited, setEdited] = useState(false); // đã sửa lớp của mẫu (không tính sticker / chữ khách tự thêm)
  const [sel, setSel] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [guide, setGuide] = useState<{ center?: boolean; ring?: number } | null>(null);
  const [guides, setGuides] = useState(true);
  const [boxView, setBoxView] = useState(false);
  const [bg, setBg] = useState<BgChoice>({ kind: "gradient", g: GRADIENTS[0] });
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assetImgs, setAssetImgs] = useState<Awaited<ReturnType<typeof loadAssetImages>>>({});
  const [cutFonts, setCutFonts] = useState<Record<string, LoadedFont>>({});
  const [fontPreviews, setFontPreviews] = useState<Record<string, string>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const fileIn = useRef<HTMLInputElement>(null), replaceIn = useRef<HTMLInputElement>(null), replaceId = useRef<string | null>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const textBoxes = useRef<Record<number, LBox>>({});
  const undoS = useRef<Snapshot[]>([]), redoS = useRef<Snapshot[]>([]);
  const drag = useRef<{ mode: "move" | "scale" | "rotate" | "pan"; i: number; b0: LBox; sx: number; sy: number; adj0?: Adjust; layer0?: Layer } | null>(null);
  const { area, width } = useFitBox(1);

  // ---------- khởi động ----------
  useEffect(() => {
    let off = false;
    (async () => {
      await loadFonts();
      const [imgs, draft] = await Promise.all([loadAssetImages(assets), loadDraft()]);
      if (off) return;
      setAssetImgs(imgs);
      if (draft) {
        const list: Photo[] = [];
        for (const p of draft.photos) { try { list.push(await readPhoto(p.blob, p.name, p.id)); } catch { /* bỏ ảnh lỗi */ } }
        if (!off) {
          setPhotos(list); setText(draft.meta.text ?? { main: "Happy Birthday", sub: "" }); setStyle(draft.meta.style);
          setAdjust(draft.meta.adjust ?? {}); setSeeds(draft.meta.seeds ?? {}); setWork(draft.meta.work ?? null); setEdited(!!draft.meta.edited);
        }
      }
      if (!off) setReady(true);
    })();
    return () => { off = true; };
  }, [assets]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { saveDraft(photos.map((p) => ({ id: p.id, name: p.name, blob: p.blob })), { style, text, adjust, seeds, work, edited }).catch(() => {}); }, 700);
    return () => clearTimeout(t);
  }, [ready, photos, style, text, adjust, seeds, work, edited]);

  // ---------- mẫu ----------
  const n = photos.length;
  const usable = n >= MIN_PHOTOS && n <= MAX_PHOTOS;
  const templates = useMemo(() => (usable ? templatesFor(n, settings, assets, seeds) : []), [usable, n, settings, assets, seeds]);
  const tpl: Template | undefined = templates.find((t) => t.style === style) ?? templates[0];
  const tKey = keyOf(tpl);
  const doc: Template | undefined = work ?? tpl;
  // mẫu gốc đổi (đổi mẫu / xáo trộn / đổi số ảnh) → bỏ chỉnh sửa trên mẫu cũ, GIỮ sticker + chữ khách tự thêm
  useEffect(() => {
    if (!work || !tpl || work.id === tKey) return;
    const mine = work.layers.filter((l) => l.user);
    setWork(mine.length ? { ...clone(tpl), id: tKey, layers: [...clone(tpl).layers, ...mine] } : null);
    setEdited(false); setSel(null); undoS.current = []; redoS.current = [];
  }, [tKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const slotPhotos = useMemo(() => photos.map((p) => p.img), [photos]);
  const slotAdjust = useMemo(() => Object.fromEntries(photos.map((p, i) => [i, adjust[p.id]])), [photos, adjust]);

  // ---------- lịch sử + sửa lớp ----------
  const begin = useCallback(() => { undoS.current.push({ work: work ? clone(work) : null, edited }); if (undoS.current.length > 60) undoS.current.shift(); redoS.current = []; }, [work, edited]);
  const base = useCallback(() => (work ? work : tpl ? { ...clone(tpl), id: tKey } : null), [work, tpl, tKey]);
  /** sửa danh sách lớp (không tự lưu mốc hoàn tác — gọi begin() trước) */
  const setLayers = useCallback((fn: (L: Layer[]) => Layer[], touched?: Layer) => {
    const b = base();
    if (!b) return;
    setWork({ ...b, layers: fn(b.layers) });
    if (!touched || !touched.user) setEdited(true);
  }, [base]);
  const undo = useCallback(() => { const s = undoS.current.pop(); if (!s) return; redoS.current.push({ work: work ? clone(work) : null, edited }); setWork(s.work); setEdited(s.edited); setSel(null); }, [work, edited]);
  const redo = useCallback(() => { const s = redoS.current.pop(); if (!s) return; undoS.current.push({ work: work ? clone(work) : null, edited }); setWork(s.work); setEdited(s.edited); setSel(null); }, [work, edited]);
  const L = doc?.layers ?? [];
  const patchLayer = (i: number, v: Partial<Layer>) => setLayers((ls) => ls.map((l, j) => (j === i ? ({ ...l, ...v } as Layer) : l)), L[i]);
  function duplicate(i: number) {
    const l = L[i]; if (!l) return;
    begin();
    const c = { ...clone(l), x: l.x + 4, y: l.y + 4, user: true } as Layer;
    setLayers((ls) => [...ls, c], c); setSel(L.length); setMenu(null);
  }
  function removeLayer(i: number) {
    const l = L[i]; if (!l) return;
    if (l.k === "photo") { toast("Ô ảnh không xoá được — bạn có thể kéo nhỏ hoặc di chuyển.", "err"); return; }
    begin(); setLayers((ls) => ls.filter((_, j) => j !== i), l); setSel(null); setMenu(null);
  }
  function reorder(i: number, d: number) {
    const j = i + d; if (j < 0 || j >= L.length) return;
    begin(); setLayers((ls) => { const a = [...ls]; [a[i], a[j]] = [a[j], a[i]]; return a; }, L[i]); setSel(j); setMenu(null);
  }
  function addAsset(a: ScrapAsset, at = { x: 60, y: 60 }) {
    if (!doc) return toast("Tải ảnh và chọn mẫu trước khi thêm sticker.", "err");
    const im = assetImgs[a.id]?.img, ar = im ? im.height / im.width : 0.3;
    const base0 = { x: at.x, y: at.y, rot: 0, asset: a.id, user: true };
    const l: Layer = a.grp === "tape" ? { k: "tape", ...base0, w: 26, h: 26 * ar, color: "#ffffff", pattern: "plain", seed: 1 }
      : a.grp === "paper" ? { k: "paper", ...base0, w: 30, h: 30 * ar, paper: "note", color: "#ffffff", torn: false, seed: 1 }
      : a.grp === "doodle" ? { k: "doodle", ...base0, s: 16, shape: "arrow", color: "#3f3f46" }
      : { k: "sticker", ...base0, s: a.grp === "frame" ? 26 : 16, shape: "star", color: "#ff8fab" };
    begin(); setLayers((ls) => [...ls, l], l); setSel(L.length);
  }
  function addText() {
    if (!doc) return toast("Tải ảnh và chọn mẫu trước khi thêm chữ.", "err");
    const l: Layer = { k: "text", role: "custom", value: "Chữ của bạn", x: 60, y: 40, w: 80, size: 7, rot: 0, font: "hand", color: "#3f3f46", family: "Dancing Script", user: true };
    begin(); setLayers((ls) => [...ls, l], l); setSel(L.length);
  }
  function restore() {
    if (!work) return;
    if (!window.confirm("Khôi phục bố cục gốc của mẫu? Các chỉnh sửa, sticker và chữ đã thêm sẽ bị bỏ (ảnh đã tải vẫn giữ).")) return;
    begin(); setWork(null); setEdited(false); setSel(null);
  }
  function chooseStyle(st: Style) {
    if (st === tpl?.style) return;
    if (edited && !window.confirm("Đổi mẫu sẽ mất các chỉnh sửa trên mẫu hiện tại. Tiếp tục?")) return;
    setStyle(st); setEditSlot(null); setSel(null);
  }
  function shuffle() {
    if (!tpl) return;
    if (edited && !window.confirm("Xáo trộn sẽ mất các chỉnh sửa trên mẫu hiện tại. Tiếp tục?")) return;
    setSeeds((s) => ({ ...s, [tpl.style]: Math.floor(Math.random() * 1e6) }));
  }

  // ---------- ảnh ----------
  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return toast(`Tối đa ${MAX_PHOTOS} ảnh — xoá bớt ảnh trước khi thêm.`, "err");
    if (files.length > room) toast(`Chỉ lấy ${room} ảnh đầu (tối đa ${MAX_PHOTOS} ảnh).`, "err");
    const out: Photo[] = [];
    for (const f of files.slice(0, room)) { try { out.push(await readPhoto(f, f.name)); } catch { toast(`Không đọc được ảnh "${f.name}"${/heic|heif/i.test(f.name) ? " (trình duyệt này chưa đọc được HEIC)" : ""}.`, "err"); } }
    setPhotos((cur) => [...cur, ...out].slice(0, MAX_PHOTOS));
  }
  async function replace(id: string, f: File) {
    try { const p = await readPhoto(f, f.name, uid()); setPhotos((cur) => cur.map((x) => (x.id === id ? p : x))); } catch { toast(`Không đọc được ảnh "${f.name}".`, "err"); }
  }
  const move = (from: number, to: number) => setPhotos((cur) => { const a = [...cur]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });

  // ---------- font: font thường dùng trên đĩa + font cắt dán (tải ảnh mảnh khi cần) ----------
  const families = useMemo(() => [...new Set(L.flatMap((l) => (l.k === "text" && l.family ? [l.family] : [])))], [L]);
  useEffect(() => {
    if (!families.length || !document.fonts) return;
    Promise.all(families.flatMap((f) => [`400 20px "${f}"`, `700 20px "${f}"`].map((s) => document.fonts.load(s, "Aăđ").catch(() => null)))).then(() => setTick((t) => t + 1));
  }, [families]);
  const usedCut = useMemo(() => [...new Set(L.flatMap((l) => (l.k === "text" && l.cutout ? [l.cutout.font] : [])))], [L]);
  useEffect(() => {
    const need = [...usedCut, ...(tab === "chu" ? fonts.map((f) => f.id) : [])].filter((id, i, a) => a.indexOf(id) === i && !cutFonts[id]);
    if (!need.length) return;
    need.forEach((id) => loadCutoutFont(id, glyphs, (u) => loadImg(u)).then((f) => setCutFonts((c) => ({ ...c, [id]: f }))));
  }, [usedCut, tab, fonts, glyphs, cutFonts]);
  useEffect(() => {
    for (const f of fonts) {
      const lf = cutFonts[f.id];
      if (!lf || fontPreviews[f.id]) continue;
      const { pieces, bounds } = layoutCutout("Taylana", lf, { size: 20, curve: 0, chaos: 0.35, spacing: 0, seed: 3 });
      const k = 3, c = document.createElement("canvas"); c.width = Math.round((bounds.x1 - bounds.x0 + 6) * k); c.height = Math.round((bounds.y1 - bounds.y0 + 6) * k);
      const x = c.getContext("2d")!; x.scale(k, k); x.translate(3 - bounds.x0, 3 - bounds.y0); drawCutout(x, pieces, k);
      setFontPreviews((p) => ({ ...p, [f.id]: c.toDataURL("image/png") }));
    }
  }, [fonts, cutFonts, fontPreviews]);

  // ---------- xem trước ----------
  const W = Math.min(1600, Math.round((width || 600) * (typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1)));
  const [boxUrl, setBoxUrl] = useState("");
  const renderOpts = useMemo(() => ({ photos: slotPhotos, adjust: slotAdjust, text, assets: assetImgs, cutoutFonts: cutFonts }), [slotPhotos, slotAdjust, text, assetImgs, cutFonts]);
  useEffect(() => {
    if (!ready || !doc || boxView) return;
    const r = renderDisc({ template: doc, ...renderOpts, size: W, guides, editSlot });
    textBoxes.current = Object.fromEntries(r.texts.map((t: TextHit) => [t.layer, { x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot }]));
    const v = view.current;
    if (v) { v.width = W; v.height = W; v.getContext("2d")!.drawImage(r.canvas, 0, 0); }
    setTick((t) => t + 1);
  }, [ready, doc, renderOpts, W, guides, editSlot, boxView]); // eslint-disable-line react-hooks/exhaustive-deps
  const mockupCanvas = useCallback(async (N: number) => {
    if (!doc) return null;
    await loadSprites();
    const disc = renderDisc({ template: doc, ...renderOpts, size: Math.min(PRINT_PX, N * 0.6), mode: "print" }).canvas;
    return renderSystem(N, { pack: "box", disc: disc as unknown as HTMLImageElement, pages: [] },
      { arrange: "single", single: "open", seed: 1, tray: "clear", glass: defaultGlass }, (ctx, w, h) => paintBackground(ctx, w, h, bg));
  }, [doc, renderOpts, bg]);
  useEffect(() => {
    if (!boxView) return;
    let off = false;
    mockupCanvas(1200).then((c) => { if (!off && c) setBoxUrl(c.toDataURL("image/jpeg", 0.9)); });
    return () => { off = true; };
  }, [boxView, mockupCanvas]);
  useEffect(() => {
    if (!ready || !templates.length) { setThumbs({}); return; }
    let off = false;
    const t = setTimeout(() => {
      const out: Record<string, string> = {};
      for (const tp of templates) { if (off) return; out[tp.style] = renderDisc({ template: tp, photos: slotPhotos, adjust: slotAdjust, text, assets: assetImgs, size: 220 }).canvas.toDataURL("image/png"); }
      if (!off) setThumbs(out);
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [ready, templates, slotPhotos, slotAdjust, text, assetImgs]);

  // ---------- tương tác trên đĩa ----------
  const layerBox = (i: number) => { const l = L[i]; return l ? boxOf(l, l.k === "text" ? textBoxes.current[i] : undefined) : null; };
  const toMM = (e: { clientX: number; clientY: number }) => { const r = view.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 120, y: ((e.clientY - r.top) / r.height) * 120 }; };
  const layerAt = (x: number, y: number) => { for (let i = L.length - 1; i >= 0; i--) { if (L[i].locked) continue; const b = layerBox(i); if (b && inside(x, y, b)) return i; } return -1; };
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    setMenu(null);
    if (e.button === 2) return;
    const p = toMM(e);
    // chế độ chỉnh ảnh trong khung (bấm đúp ô ảnh để vào)
    if (editSlot !== null) {
      const i = L.findIndex((l) => l.k === "photo" && l.slot === editSlot), b = i >= 0 ? layerBox(i) : null, ph = photos[editSlot];
      if (b && ph && inside(p.x, p.y, b)) { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode: "pan", i, b0: b, sx: p.x, sy: p.y, adj0: adjust[ph.id] ?? { dx: 0, dy: 0, zoom: 1 } }; return; }
      setEditSlot(null);
    }
    const i = layerAt(p.x, p.y);
    if (i < 0) { setSel(null); return; }
    setSel(i);
    const b = layerBox(i);
    if (!b) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    begin();
    drag.current = { mode: "move", i, b0: b, sx: p.x, sy: p.y, layer0: L[i] };
  }
  function startHandle(e: React.PointerEvent, mode: "scale" | "rotate") {
    if (sel === null) return;
    e.stopPropagation();
    const b = layerBox(sel);
    if (!b) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    begin();
    const p = toMM(e);
    drag.current = { mode, i: sel, b0: b, sx: p.x, sy: p.y, layer0: L[sel] };
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toMM(e), b0 = d.b0;
    if (d.mode === "pan") {
      const ph = photos[editSlot ?? -1];
      if (!ph) return;
      const a = (-b0.rot * Math.PI) / 180, dx = p.x - d.sx, dy = p.y - d.sy;
      setAdjust((c) => ({ ...c, [ph.id]: { ...d.adj0!, dx: d.adj0!.dx + dx * Math.cos(a) - dy * Math.sin(a), dy: d.adj0!.dy + dx * Math.sin(a) + dy * Math.cos(a) } }));
      return;
    }
    let b: LBox = b0;
    if (d.mode === "move") {
      const s = snap(b0.x + p.x - d.sx, b0.y + p.y - d.sy);
      setGuide(s.guide.center || s.guide.ring ? s.guide : null);
      b = { ...b0, x: s.x, y: s.y };
    } else if (d.mode === "rotate") {
      let r = Math.round((Math.atan2(p.y - b0.y, p.x - b0.x) * 180) / Math.PI + 90);
      if (Math.abs(((r % 90) + 90) % 90) < 3 || Math.abs(((r % 90) + 90) % 90) > 87) r = Math.round(r / 90) * 90; // hít góc 0° / 90°
      b = { ...b0, rot: r };
    } else {
      // kéo góc: giữ tỉ lệ, phóng / thu quanh tâm
      const a = (-b0.rot * Math.PI) / 180, dx = p.x - b0.x, dy = p.y - b0.y;
      const lx = Math.abs(dx * Math.cos(a) - dy * Math.sin(a)), ly = Math.abs(dx * Math.sin(a) + dy * Math.cos(a));
      const k = Math.max(0.15, Math.max(lx / (b0.w / 2), ly / (b0.h / 2)));
      b = { ...b0, w: b0.w * k, h: b0.h * k };
    }
    const l0 = d.layer0!;
    setLayers((ls) => ls.map((l, j) => (j === d.i ? applyBox(l0, b, b0) : l)), l0);
  }
  const onUp = () => { drag.current = null; setGuide(null); };
  function onDbl(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = toMM(e), i = layerAt(p.x, p.y), l = L[i];
    if (!l) return;
    if (l.k === "photo") { setEditSlot(l.slot); setSel(null); }
    if (l.k === "text") { setTab("chu"); setSel(i); }
  }
  function onContext(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const p = toMM(e), i = layerAt(p.x, p.y);
    if (i < 0) return;
    setSel(i);
    const r = view.current!.getBoundingClientRect();
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top });
  }
  function onDrop(e: React.DragEvent) {
    const id = e.dataTransfer.getData(ASSET_DRAG);
    if (!id) return;
    e.preventDefault();
    const a = assets.find((x) => x.id === id);
    if (a) addAsset(a, toMM(e));
  }
  const zoom = useCallback((dz: number) => {
    if (editSlot === null) return;
    const ph = photos[editSlot];
    if (!ph) return;
    setAdjust((c) => { const a = c[ph.id] ?? { dx: 0, dy: 0, zoom: 1 }; return { ...c, [ph.id]: { ...a, zoom: Math.min(3, Math.max(1, Math.round((a.zoom + dz) * 100) / 100)) } }; });
  }, [editSlot, photos]);
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const h = (e: WheelEvent) => { if (editSlot === null) return; e.preventDefault(); zoom(e.deltaY < 0 ? 0.08 : -0.08); };
    v.addEventListener("wheel", h, { passive: false });
    return () => v.removeEventListener("wheel", h);
  }, [editSlot, zoom]);
  // phím tắt
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (sel === null) return;
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(sel); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeLayer(sel); return; }
      const st = e.shiftKey ? 2 : 0.5, mv: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
      if (mv[e.key]) { e.preventDefault(); begin(); const l = L[sel]; patchLayer(sel, { x: l.x + mv[e.key][0], y: l.y + mv[e.key][1] }); }
      if (e.key === "Escape") { setSel(null); setMenu(null); setEditSlot(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // ---------- xuất file / đặt in ----------
  const printBlob = async () => {
    if (!doc) throw new Error("Cần ít nhất 5 ảnh");
    await loadFonts();
    return toBlob(renderDisc({ template: doc, ...renderOpts, size: PRINT_PX, mode: "print" }).canvas, "image/png");
  };
  async function downloadPrint() {
    setBusy(true);
    try { saveBlob(await printBlob(), "Mat-dia-Scrapbook-12x12cm-300dpi.png"); toast("Đã tải xuống"); } catch (e) { toast(e instanceof Error ? e.message : "Xuất file thất bại", "err"); }
    setBusy(false);
  }
  async function downloadMockup() {
    setBusy(true);
    try { const c = await mockupCanvas(2400); if (!c) throw new Error("Cần ít nhất 5 ảnh"); saveBlob(await toBlob(c, "image/jpeg", 0.92), "Mockup-CD-Scrapbook.jpg"); toast("Đã tải xuống"); }
    catch (e) { toast(e instanceof Error ? e.message : "Xuất ảnh thất bại", "err"); }
    setBusy(false);
  }
  async function order() {
    if (!usable) return toast("Cần ít nhất 5 ảnh", "err");
    setBusy(true);
    try {
      await savePendingDisc(await printBlob());
      router.push(`/san-pham/in-cd-theo-yeu-cau${boxPackageId ? `?goi=${encodeURIComponent(boxPackageId)}` : ""}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Không tạo được file in", "err"); setBusy(false); }
  }

  const ph = editSlot !== null ? photos[editSlot] : undefined;
  const k = (width || 600) / 120;
  const SB = sel !== null ? layerBox(sel) : null;
  void tick;
  const tabBtn = (id: typeof tab, label: string) => (
    <button key={id} type="button" onClick={() => setTab(id)} className={cx("flex-1 rounded-[8px] px-3 py-1.5 text-[13px] font-medium", tab === id ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]")}>{label}</button>
  );
  const tools = sel !== null && (
    <>
      <button type="button" onClick={() => duplicate(sel)} title="Nhân bản (Ctrl+D)" className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] hover:bg-[#f4f4f5]"><Copy size={13} /> Nhân bản</button>
      <button type="button" onClick={() => reorder(sel, 1)} title="Đưa lên trên" className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] hover:bg-[#f4f4f5]"><ArrowUp size={13} /> Lên trên</button>
      <button type="button" onClick={() => reorder(sel, -1)} title="Đưa xuống dưới" className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] hover:bg-[#f4f4f5]"><ArrowDown size={13} /> Xuống dưới</button>
      <button type="button" onClick={() => removeLayer(sel)} title="Xoá (Delete)" className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 size={13} /> Xoá</button>
    </>
  );

  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col md:min-h-0 md:flex-row md:border-x md:border-[#e5e5e7]">
      {/* ---------- Trái 36%: 3 tab ---------- */}
      <aside className="order-2 space-y-5 border-[#e5e5e7] bg-white p-6 md:order-1 md:w-[36%] md:min-w-[360px] md:shrink-0 md:overflow-y-auto md:border-r">
        <div className="flex rounded-[10px] border border-[#e5e5e7] p-1">{tabBtn("anh", "Ảnh")}{tabBtn("sticker", "Sticker")}{tabBtn("chu", "Chữ")}</div>

        {tab === "anh" && (
          <>
            <section>
              <p className="mb-2 text-[14px] font-semibold text-[#18181b]">Ảnh của bạn <span className="text-[12px] font-normal text-[#71717a]">({n}/{MAX_PHOTOS} · cần {MIN_PHOTOS}–{MAX_PHOTOS} ảnh)</span></p>
              <button type="button" onClick={() => fileIn.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
                className="grid w-full place-items-center rounded-[10px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] px-4 py-5 text-center hover:border-[#ff5fa2]">
                <Upload size={20} className="mb-1 text-[#a1a1aa]" />
                <span className="text-[14px] font-medium text-[#18181b]">Kéo thả hoặc bấm để chọn ảnh</span>
                <span className="text-[12px] text-[#71717a]">JPG, PNG, HEIC · 5 đến 10 ảnh · ảnh chỉ xử lý trên máy bạn</span>
              </button>
              <input ref={fileIn} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={replaceIn} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && replaceId.current) replace(replaceId.current, f); }} />
              {n > 0 && n < MIN_PHOTOS && <p className="mt-2 text-[13px] font-medium text-[#ea7a12]">Cần ít nhất {MIN_PHOTOS} ảnh (còn thiếu {MIN_PHOTOS - n}).</p>}
              {n > 0 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {photos.map((p, i) => (
                    <div key={p.id} draggable onDragStart={() => setDragIdx(i)} onDragEnd={() => setDragIdx(null)} onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); }}
                      title={p.name} className={cx("group relative aspect-square cursor-grab overflow-hidden rounded-[8px] border border-[#e5e5e7] bg-[#f4f4f5]", dragIdx === i && "opacity-40")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="h-full w-full object-cover" draggable={false} />
                      <span className="pointer-events-none absolute left-1 top-1 rounded-[4px] bg-black/70 px-1 text-[10px] font-medium leading-[15px] text-white">{i === 0 ? "Ảnh chính" : i + 1}</span>
                      <div className="absolute bottom-1 right-1 flex gap-1 md:inset-0 md:items-center md:justify-center md:bg-black/40 md:opacity-0 md:group-hover:opacity-100">
                        <button type="button" title="Thay ảnh" aria-label="Thay ảnh" onClick={() => { replaceId.current = p.id; replaceIn.current?.click(); }} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#18181b] shadow"><RefreshCw size={12} /></button>
                        <button type="button" title="Xoá" aria-label="Xoá" onClick={() => setPhotos((c) => c.filter((x) => x.id !== p.id))} className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#dc2626] shadow"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {n > 1 && <p className="mt-2 text-[12px] text-[#a1a1aa]">Kéo thả để đổi thứ tự — ảnh số 1 vào ô to nhất.</p>}
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[14px] font-semibold text-[#18181b]">Chọn mẫu</p>
                {tpl && <button type="button" onClick={shuffle} title="Xáo trộn mẫu đang chọn" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /> Xáo trộn</button>}
              </div>
              {!usable ? <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">Tải lên {MIN_PHOTOS}–{MAX_PHOTOS} ảnh để xem các mẫu.</p> : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-5">
                  {templates.map((t) => (
                    <button key={t.style} type="button" onClick={() => chooseStyle(t.style)} title={STYLES.find((s) => s.id === t.style)?.name}
                      className={cx("rounded-[10px] border p-1 text-center", tpl?.style === t.style ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
                      <span className="block aspect-square overflow-hidden rounded-full bg-[#f4f4f5]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {thumbs[t.style] && <img src={thumbs[t.style]} alt="" className="h-full w-full" />}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-[#52525b]">{STYLES.find((s) => s.id === t.style)?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {tab === "sticker" && <StickerTab assets={assets} onAdd={(a) => addAsset(a)} />}
        {tab === "chu" && (
          <TextTab layers={L} sel={sel} text={text} fonts={fonts} previews={fontPreviews} onSelect={setSel} onAdd={addText} onRemove={removeLayer}
            onPatch={(i, v) => patchLayer(i, v)} onBegin={begin} onText={(role, v) => setText((t) => ({ ...t, [role]: v }))} />
        )}
      </aside>

      {/* ---------- Phải: mặt đĩa ---------- */}
      <section className="relative order-1 flex min-h-[420px] min-w-0 flex-1 flex-col md:order-2 md:min-h-0 md:overflow-hidden">
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 pt-3 md:absolute md:inset-x-0 md:top-0 md:z-10">
          <button type="button" onClick={undo} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác" className="grid h-8 w-8 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!undoS.current.length}><Undo2 size={14} /></button>
          <button type="button" onClick={redo} title="Làm lại (Ctrl+Shift+Z)" aria-label="Làm lại" className="grid h-8 w-8 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!redoS.current.length}><Redo2 size={14} /></button>
          <button type="button" onClick={restore} disabled={!work} className="inline-flex h-8 items-center gap-1 rounded-full border border-[#e5e5e7] bg-white px-3 text-[12px] font-medium disabled:opacity-40"><RotateCcw size={13} /> Khôi phục mẫu</button>
          <span className="flex-1" />
          <Toggle checked={guides} onChange={setGuides} label="Hiển thị guideline" />
          <Toggle checked={boxView} onChange={(v) => { setBoxView(v); setEditSlot(null); setSel(null); }} label="Xem trong hộp" />
        </div>
        <div ref={area} className="relative flex min-h-[300px] flex-1 items-center justify-center p-4 md:absolute md:inset-x-6 md:bottom-[72px] md:top-14 md:p-0">
          {!usable ? (
            <div className="grid aspect-square w-full max-w-[420px] place-items-center rounded-full border-[1.5px] border-dashed border-[#d4d4d8] bg-white text-center text-[14px] text-[#71717a]">
              <span><ImageIcon size={24} className="mx-auto mb-2" />Tải lên {MIN_PHOTOS}–{MAX_PHOTOS} ảnh<br />để web tự làm mặt đĩa scrapbook</span>
            </div>
          ) : boxView ? (
            // eslint-disable-next-line @next/next/no-img-element
            boxUrl ? <img src={boxUrl} alt="Mặt đĩa trong hộp CD" className="max-h-full max-w-full rounded-[12px] border border-[#e5e5e7]" style={{ width: width || undefined }} /> : <p className="text-[13px] text-[#71717a]">Đang dựng...</p>
          ) : (
            <div className="relative" style={{ width: width || "100%" }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              onDragOver={(e) => { if (e.dataTransfer.types.includes(ASSET_DRAG)) e.preventDefault(); }} onDrop={onDrop}>
              <canvas ref={view} className={cx("block aspect-square w-full touch-none", editSlot !== null ? "cursor-move" : "cursor-pointer")}
                onPointerDown={onDown} onDoubleClick={onDbl} onContextMenu={onContext} />
              {/* đường gióng */}
              {guide && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 120 120">
                  {guide.center && <g stroke="#2563eb" strokeWidth="0.3" strokeDasharray="1.2 1"><line x1="60" y1="0" x2="60" y2="120" /><line x1="0" y1="60" x2="120" y2="60" /></g>}
                  {guide.ring && <circle cx="60" cy="60" r={guide.ring} fill="none" stroke="#2563eb" strokeWidth="0.3" strokeDasharray="1.2 1" />}
                </svg>
              )}
              {/* khung chọn: 4 góc (giữ tỉ lệ) + núm xoay */}
              {SB && editSlot === null && (
                <div className="pointer-events-none absolute border-2 border-[#2563eb]"
                  style={{ left: (SB.x - SB.w / 2) * k, top: (SB.y - SB.h / 2) * k, width: SB.w * k, height: SB.h * k, transform: `rotate(${SB.rot}deg)` }}>
                  {[[0, 0], [1, 0], [1, 1], [0, 1]].map(([cx0, cy0], i) => (
                    <span key={i} onPointerDown={(e) => startHandle(e, "scale")} className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-[2px] border-2 border-[#2563eb] bg-white" style={{ left: `${cx0 * 100}%`, top: `${cy0 * 100}%` }} />
                  ))}
                  <span onPointerDown={(e) => startHandle(e, "rotate")} title="Kéo để xoay" className="pointer-events-auto absolute left-1/2 top-[-22px] h-3.5 w-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-[#2563eb] bg-white" />
                </div>
              )}
              {/* thanh công cụ nổi trên lớp đang chọn (điện thoại + máy tính) */}
              {SB && sel !== null && editSlot === null && !menu && (
                <div className="absolute z-10 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded-[8px] border border-[#e5e5e7] bg-white p-0.5 shadow"
                  style={{ left: Math.min(Math.max(SB.x * k, 120), (width || 600) - 120), top: Math.max(34, (SB.y - Math.max(SB.w, SB.h) / 2) * k - 26) }}>{tools}</div>
              )}
              {/* menu chuột phải */}
              {menu && sel !== null && (
                <div className="absolute z-20 flex flex-col rounded-[8px] border border-[#e5e5e7] bg-white p-1 shadow-lg" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>{tools}</div>
              )}
              {editSlot !== null && ph && (
                <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[12px] text-[#52525b] shadow">
                  <span className="px-1">Ảnh {editSlot + 1}: kéo để dịch</span>
                  <button type="button" onClick={() => zoom(-0.1)} aria-label="Thu nhỏ" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Minus size={14} /></button>
                  <button type="button" onClick={() => zoom(0.1)} aria-label="Phóng to" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Plus size={14} /></button>
                  <button type="button" onClick={() => setEditSlot(null)} className="rounded-full bg-[#ff5fa2] px-2.5 py-1 font-medium text-white">Xong</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex h-16 shrink-0 items-center gap-3 border-t border-[#efeff1] bg-[#f7f7f8] px-4 md:absolute md:inset-x-0 md:bottom-0 md:border-0">
          <div className="min-w-0 flex-1"><BgPicker value={bg} onChange={setBg} shop={backgrounds} /></div>
          <DownloadMenu busy={busy} up items={[
            { label: "File in mặt đĩa (PNG 300 DPI)", icon: <Download size={16} />, onClick: downloadPrint },
            { label: "Ảnh mockup (JPG)", icon: <Box size={16} />, onClick: downloadMockup },
          ]} />
          <Button size="sm" icon={<ShoppingBag size={16} />} onClick={order} disabled={!usable || busy}>Đặt in CD này</Button>
        </div>
      </section>
     </div>
    </div>
  );
}
