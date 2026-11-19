"use client";

/* Phần logic dùng chung của CD Scrapbook + Booklet Scrapbook: ảnh của khách (gán vào ô theo id, đánh dấu đang dùng / chưa dùng),
   sticker khách tự tải, chất liệu + khung + font cut-out đã tải, thao tác trên lớp của bề mặt đang xem (nhân bản, lên / xuống,
   xoá, đổi khung, thêm / xoá ô ảnh, thêm sticker / chữ / lời chúc), phím tắt, lưu nháp IndexedDB. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Frame as FrameIcon, ImagePlus, Trash2 } from "lucide-react";
import { loadImg } from "@/lib/mockup/images";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { loadFrameImages } from "@/lib/scrapbook/frames";
import { loadDraft, saveDraft, type DraftMeta } from "@/lib/scrapbook/draft";
import { loadFonts, type LoadedFrame, type RenderOpts } from "@/lib/scrapbook/render";
import { largestEmpty } from "@/lib/scrapbook/place";
import { addPoint, surfaceOf } from "@/lib/scrapbook/surface";
import { drawCutout, layoutCutout, loadCutoutFont, type CutoutFont, type Glyph, type LoadedFont } from "@/lib/scrapbook/cutout";
import type { Adjust, DiscText, Frame, Layer, ScrapAsset, Template } from "@/lib/scrapbook/types";
import { toast } from "@/components/ui/kit";
import { readPhoto, uid, type NewSlot, type Photo } from "./parts";
import { clone, useScrapDoc } from "./useScrapDoc";

export type UserSticker = { id: string; blob: Blob; url: string; img: HTMLCanvasElement };
const btn = "inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] hover:bg-[#f4f4f5]";

export function useScrapStudio(o: {
  prefix: string; max: number; assets: ScrapAsset[]; frames: Frame[]; fonts: CutoutFont[]; glyphs: Glyph[]; defaultText: DiscText;
  extra: Partial<DraftMeta>; onLoad: (meta: DraftMeta, photos: Photo[]) => Template[] | void; wantAllFonts: boolean;
}) {
  const D = useScrapDoc();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [text, setText] = useState<DiscText>(o.defaultText);
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});
  const [applied, setApplied] = useState<string | null>(null);
  const [ustickers, setUstickers] = useState<UserSticker[]>([]);
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [editLayer, setEditLayer] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [assetImgs, setAssetImgs] = useState<Awaited<ReturnType<typeof loadAssetImages>>>({});
  const [frameImgs, setFrameImgs] = useState<Record<string, LoadedFrame>>({});
  const [cutFonts, setCutFonts] = useState<Record<string, LoadedFont>>({});
  const [fontPreviews, setFontPreviews] = useState<Record<string, string>>({});
  const [fontTick, setFontTick] = useState(0);
  // modal
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [frameFor, setFrameFor] = useState<number | null>(null);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [stickerFiles, setStickerFiles] = useState<File[] | null>(null);

  // ---------- khởi động: font, chất liệu, khung, bản nháp ----------
  useEffect(() => {
    let off = false;
    (async () => {
      await loadFonts();
      const [imgs, fr, draft] = await Promise.all([loadAssetImages(o.assets), loadFrameImages(o.frames), loadDraft(o.prefix)]);
      if (off) return;
      setAssetImgs(imgs); setFrameImgs(fr);
      if (draft) {
        const list: Photo[] = [];
        for (const p of draft.photos) { try { list.push(await readPhoto(p.blob, p.name, p.id)); } catch { /* bỏ ảnh lỗi */ } }
        const us: UserSticker[] = [];
        for (const s of draft.stickers) { try { const p = await readPhoto(s.blob, "sticker.png", s.id); us.push({ id: s.id, blob: s.blob, url: p.url, img: p.img }); } catch { /* bỏ */ } }
        if (off) return;
        setPhotos(list); setUstickers(us); setText(draft.meta.text ?? o.defaultText); setAdjust(draft.meta.adjust ?? {});
        const legacy = o.onLoad(draft.meta, list);
        if (draft.meta.doc?.length) { D.setDoc(draft.meta.doc); D.setEdited(!!draft.meta.edited); setApplied(draft.meta.applied ?? null); }
        else if (legacy?.length) { D.setDoc(legacy); D.setEdited(!!draft.meta.edited); }
      }
      setReady(true);
    })();
    return () => { off = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      saveDraft(o.prefix, photos.map((p) => ({ id: p.id, name: p.name, blob: p.blob })), { ...o.extra, text, adjust, doc: D.doc, edited: D.edited, applied }, ustickers.map((s) => ({ id: s.id, blob: s.blob }))).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [ready, photos, text, adjust, D.doc, D.edited, applied, ustickers, o.extra, o.prefix]);

  const doc = D.doc;
  const cur = doc?.[active] ?? null;
  const L = cur?.layers ?? [];
  const used = useMemo(() => new Set((doc ?? []).flatMap((t) => t.layers.flatMap((l) => (l.k === "photo" && l.photo ? [l.photo] : [])))), [doc]);

  // ---------- ảnh ----------
  async function addFiles(files: File[]) {
    const room = o.max - photos.length;
    if (room <= 0) { toast(`Tối đa ${o.max} ảnh — xoá bớt ảnh trước khi thêm.`, "err"); return []; }
    if (files.length > room) toast(`Chỉ lấy ${room} ảnh đầu (tối đa ${o.max} ảnh).`, "err");
    const out: Photo[] = [];
    for (const f of files.slice(0, room)) { try { out.push(await readPhoto(f, f.name)); } catch { toast(`Không đọc được ảnh "${f.name}"${/heic|heif/i.test(f.name) ? " (trình duyệt này chưa đọc được HEIC)" : ""}.`, "err"); } }
    setPhotos((c) => [...c, ...out].slice(0, o.max));
    return out;
  }
  async function replacePhoto(id: string, f: File) {
    try { const p = await readPhoto(f, f.name); setPhotos((c) => c.map((x) => (x.id === id ? p : x))); D.setDoc((d) => d && d.map((t) => ({ ...t, layers: t.layers.map((l) => (l.k === "photo" && l.photo === id ? { ...l, photo: p.id } : l)) }))); }
    catch { toast(`Không đọc được ảnh "${f.name}".`, "err"); }
  }
  function removePhoto(id: string) {
    setPhotos((c) => c.filter((x) => x.id !== id));
    D.setDoc((d) => d && d.map((t) => ({ ...t, layers: t.layers.map((l) => (l.k === "photo" && l.photo === id ? { ...l, photo: "" } : l)) })));
  }
  const reorderPhotos = (from: number, to: number) => setPhotos((c) => { const a = [...c]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });
  /** gán ảnh vào ô (ảnh cũ của ô quay về danh sách; ảnh đang ở ô khác thì chuyển sang ô này) */
  function assignPhoto(si: number, i: number, pid: string) {
    D.begin();
    D.setDoc((d) => d && d.map((t, s) => ({ ...t, layers: t.layers.map((l, j) => (l.k !== "photo" ? l : s === si && j === i ? { ...l, photo: pid } : l.photo === pid ? { ...l, photo: "" } : l)) })));
    D.setEdited(true);
  }

  // ---------- sticker của khách ----------
  async function addUserSticker(blob: Blob) {
    const id = uid();
    const p = await readPhoto(blob, "sticker.png", id);
    setUstickers((c) => [...c, { id, blob, url: p.url, img: p.img }]);
    addAsset(`u:${id}`, undefined, p.img);
  }
  function removeUserSticker(id: string) {
    setUstickers((c) => c.filter((s) => s.id !== id));
    D.setDoc((d) => d && d.map((t) => ({ ...t, layers: t.layers.filter((l) => !(l.k === "sticker" && l.asset === `u:${id}`)) })));
  }
  const assetsMap = useMemo(() => {
    const m: NonNullable<RenderOpts["assets"]> = { ...assetImgs };
    for (const s of ustickers) m[`u:${s.id}`] = { img: s.img, asset: { id: `u:${s.id}`, name: "Sticker của bạn", grp: "sticker", url: "", tone: "any", region: null, is_active: true, sort_order: 0 } };
    return m;
  }, [assetImgs, ustickers]);

  // ---------- font: font thường trên thiết kế + font cắt dán (tải ảnh mảnh khi cần) ----------
  const allLayers = useMemo(() => (doc ?? []).flatMap((t) => t.layers), [doc]);
  const families = useMemo(() => [...new Set(allLayers.flatMap((l) => ((l.k === "text" || l.k === "wish") && l.family ? [l.family] : [])))], [allLayers]);
  useEffect(() => {
    if (!families.length || !document.fonts) return;
    Promise.all(families.flatMap((f) => [`400 20px "${f}"`, `700 20px "${f}"`].map((s) => document.fonts.load(s, "Aăđ").catch(() => null)))).then(() => setFontTick((t) => t + 1));
  }, [families]);
  const usedCut = useMemo(() => [...new Set(allLayers.flatMap((l) => ((l.k === "text" || l.k === "wish") && l.cutout ? [l.cutout.font] : [])))], [allLayers]);
  useEffect(() => {
    const need = [...usedCut, ...(o.wantAllFonts ? o.fonts.map((f) => f.id) : [])].filter((id, i, a) => a.indexOf(id) === i && !cutFonts[id]);
    need.forEach((id) => loadCutoutFont(id, o.glyphs, (u) => loadImg(u)).then((f) => setCutFonts((c) => ({ ...c, [id]: f }))));
  }, [usedCut, o.wantAllFonts, o.fonts, o.glyphs, cutFonts]);
  useEffect(() => {
    for (const f of o.fonts) {
      const lf = cutFonts[f.id];
      if (!lf || fontPreviews[f.id]) continue;
      const { pieces, bounds } = layoutCutout("Taylana", lf, { size: 20, curve: 0, chaos: 0.35, spacing: 0, seed: 3 });
      const k = 3, c = document.createElement("canvas"); c.width = Math.round((bounds.x1 - bounds.x0 + 6) * k); c.height = Math.round((bounds.y1 - bounds.y0 + 6) * k);
      const x = c.getContext("2d")!; x.scale(k, k); x.translate(3 - bounds.x0, 3 - bounds.y0); drawCutout(x, pieces, k);
      setFontPreviews((p) => ({ ...p, [f.id]: c.toDataURL("image/png") }));
    }
  }, [o.fonts, cutFonts, fontPreviews]);

  const photoMap = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p.img])), [photos]);
  const renderOpts = useMemo<Omit<RenderOpts, "template" | "size">>(() => ({ photoMap, adjustMap: adjust, text, assets: assetsMap, frames: frameImgs, cutoutFonts: cutFonts }), [photoMap, adjust, text, assetsMap, frameImgs, cutFonts, fontTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- thao tác trên lớp của bề mặt đang xem ----------
  const setLayers = useCallback((fn: (L: Layer[]) => Layer[], touched?: Layer) => D.setLayers(active, fn, touched), [D, active]);
  const patchLayer = (i: number, v: Partial<Layer>) => setLayers((ls) => ls.map((l, j) => (j === i ? ({ ...l, ...v } as Layer) : l)), L[i]);
  function duplicate(i: number) {
    const l = L[i]; if (!l) return;
    D.begin();
    const c = { ...clone(l), x: l.x + 4, y: l.y + 4, user: true, auto: undefined } as Layer;
    if (c.k === "photo") c.photo = "";
    setLayers((ls) => [...ls, c], c.k === "photo" ? undefined : c); setSel(L.length);
  }
  function removeLayer(i: number) {
    const l = L[i]; if (!l) return;
    D.begin(); setLayers((ls) => ls.filter((_, j) => j !== i), l.k === "photo" ? undefined : l); setSel(null); setEditLayer(null);
  }
  function reorder(i: number, d: number) {
    const j = i + d; if (j < 0 || j >= L.length) return;
    D.begin(); setLayers((ls) => { const a = [...ls]; [a[i], a[j]] = [a[j], a[i]]; return a; }, L[i]); setSel(j);
  }
  function addAsset(a: ScrapAsset | string, at?: { x: number; y: number }, img?: CanvasImageSource & { width: number; height: number }) {
    if (!cur) { toast("Tải ảnh và chọn mẫu trước khi thêm sticker.", "err"); return; }
    const S = surfaceOf(cur), k = L.filter((l) => l.k === "sticker" && l.user).length, p = at ?? addPoint(S, k);
    let l: Layer;
    if (typeof a === "string") l = { k: "sticker", x: p.x, y: p.y, s: S.round ? 18 : 26, rot: 0, shape: "star", color: "#ff8fab", asset: a, user: true };
    else {
      const im = img ?? assetImgs[a.id]?.img, ar = im ? im.height / im.width : 0.3;
      const base0 = { x: p.x, y: p.y, rot: 0, asset: a.id, user: true };
      l = a.grp === "tape" ? { k: "tape", ...base0, w: 26, h: 26 * ar, color: "#ffffff", pattern: "plain", seed: 1 }
        : a.grp === "paper" ? { k: "paper", ...base0, w: 30, h: 30 * ar, paper: "note", color: "#ffffff", torn: false, seed: 1 }
        : a.grp === "doodle" ? { k: "doodle", ...base0, s: 16, shape: "arrow", color: "#3f3f46" }
        : { k: "sticker", ...base0, s: 18, shape: "star", color: "#ff8fab" };
    }
    D.begin(); setLayers((ls) => [...ls, l], l); setSel(L.length);
  }
  function addText() {
    if (!cur) { toast("Tải ảnh và chọn mẫu trước khi thêm chữ.", "err"); return; }
    const S = surfaceOf(cur);
    const l: Layer = { k: "text", role: "custom", value: "Chữ của bạn", x: S.round ? 60 : S.w / 2, y: S.round ? 40 : S.h * 0.25, w: 80, size: 7, rot: 0, font: "hand", color: "#3f3f46", family: "Dancing Script", user: true };
    D.begin(); setLayers((ls) => [...ls, l], l); setSel(L.length);
  }
  function addWish(content: string) {
    if (!cur) { toast("Chọn mẫu trước khi thêm lời chúc.", "err"); return; }
    if (sel !== null && L[sel]?.k === "wish") { D.begin(); patchLayer(sel, { value: content }); return; }
    const S = surfaceOf(cur), e = largestEmpty(S, L), w = Math.max(36, Math.min(78, e.r * 2 * 0.9)), h = Math.max(22, Math.min(60, w * 0.55));
    const l: Layer = { k: "wish", x: e.x, y: e.y, w, h, rot: 0, card: "note", color: "#fff3a8", ink: "#3f3f46", value: content, seed: Math.floor(Math.random() * 1e6), user: true };
    D.begin(); setLayers((ls) => [...ls, l], l); setSel(L.length);
  }
  function addSlot(v: NewSlot) {
    if (!cur) return;
    const S = surfaceOf(cur), e = largestEmpty(S, L), def = S.round ? 30 : 48;
    const w = Math.max(14, Math.min(def, (e.r * 2 * 0.95) / Math.hypot(1, v.ratio)));
    const l: Layer = { k: "photo", slot: 999, x: e.x, y: e.y, w, h: w * v.ratio, rot: 0, shape: v.shape, seed: Math.floor(Math.random() * 1e6), border: v.shape === "circle" || v.shape === "heart" ? "#ffffff" : undefined, photo: "", frame: v.frame?.id };
    D.begin(); setLayers((ls) => [...ls, l]); setSel(L.length); setAddSlotOpen(false);
    setPickFor(L.length);
  }
  function setFrame(i: number, f: Frame | null) {
    const l = L[i]; if (l?.k !== "photo") return;
    D.begin(); setLayers((ls) => ls.map((x, j) => (j === i && x.k === "photo" ? { ...x, frame: f?.id, h: f ? x.w * (f.ratio || 1) : x.h, shape: f ? "rect" : x.shape } : x)));
    setFrameFor(null);
  }

  // ---------- phím tắt ----------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey ? D.redo() : D.undo()) setSel(null); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); if (D.redo()) setSel(null); return; }
      if (e.key === "Escape") { setSel(null); setEditLayer(null); }
      if (sel === null) return;
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(sel); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeLayer(sel); return; }
      const st = e.shiftKey ? 2 : 0.5, mv: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
      if (mv[e.key]) { e.preventDefault(); D.begin(); const l = L[sel]; patchLayer(sel, { x: l.x + mv[e.key][0], y: l.y + mv[e.key][1] }); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const selL = sel !== null ? L[sel] : null;
  const tools = selL ? (
    <>
      {selL.k === "photo" ? (
        <>
          <button type="button" onClick={() => setPickFor(sel)} className={btn}><ImagePlus size={13} /> {selL.photo ? "Đổi ảnh" : "Chọn ảnh"}</button>
          <button type="button" onClick={() => setFrameFor(sel)} className={btn}><FrameIcon size={13} /> Đổi khung</button>
        </>
      ) : <button type="button" onClick={() => duplicate(sel!)} title="Nhân bản (Ctrl+D)" className={btn}><Copy size={13} /> Nhân bản</button>}
      <button type="button" onClick={() => reorder(sel!, 1)} title="Đưa lên trên" className={btn}><ArrowUp size={13} /> Lên trên</button>
      <button type="button" onClick={() => reorder(sel!, -1)} title="Đưa xuống dưới" className={btn}><ArrowDown size={13} /> Xuống dưới</button>
      <button type="button" onClick={() => removeLayer(sel!)} title="Xoá (Delete)" className={`${btn} text-[#dc2626] hover:bg-[#fef2f2]`}><Trash2 size={13} /> {selL.k === "photo" ? "Xoá ô ảnh" : "Xoá"}</button>
    </>
  ) : null;

  /** nạp thiết kế đã lưu trên tài khoản (thay bản nháp) */
  function hydrate(v: { photos: Photo[]; stickers: UserSticker[]; text: DiscText; adjust: Record<string, Adjust>; doc: Template[]; applied: string | null }) {
    setPhotos(v.photos); setUstickers(v.stickers); setText(v.text); setAdjust(v.adjust); D.setDoc(v.doc); D.setEdited(true); setApplied(v.applied); D.reset(); setActive(0); setSel(null);
  }
  return {
    hydrate, D, doc, cur, L, ready, photos, setPhotos, used, addFiles, replacePhoto, removePhoto, reorderPhotos, assignPhoto,
    text, setText, adjust, setAdjust, applied, setApplied, ustickers, addUserSticker, removeUserSticker, stickerFiles, setStickerFiles,
    assetImgs, frameImgs, cutFonts, fontPreviews, renderOpts, active, setActive, sel, setSel, editLayer, setEditLayer,
    setLayers, patchLayer, duplicate, removeLayer, reorder, addAsset, addText, addWish, addSlot, setFrame, tools,
    pickFor, setPickFor, frameFor, setFrameFor, addSlotOpen, setAddSlotOpen,
  };
}
