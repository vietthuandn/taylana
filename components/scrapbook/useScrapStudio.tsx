"use client";

/* Phần logic dùng chung của CD Template + Booklet Template: ảnh của khách (gán vào ô theo id, đánh dấu đang dùng / chưa dùng),
   sticker khách tự tải, chất liệu + khung + font cut-out đã tải, thao tác trên lớp của bề mặt đang xem (nhân bản, lên / xuống,
   xoá, đổi khung, thêm / xoá ô ảnh, thêm sticker / chữ / lời chúc), phím tắt, lưu nháp IndexedDB. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Frame as FrameIcon, ImagePlus, Trash2 } from "lucide-react";
import { loadImg } from "@/lib/mockup/images";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { loadFrameImages } from "@/lib/scrapbook/frames";
import { loadDraft, saveDraft, type DraftMeta } from "@/lib/scrapbook/draft";
import { loadFonts, textOf, type LoadedFrame, type RenderOpts } from "@/lib/scrapbook/render";
import { largestEmpty } from "@/lib/scrapbook/place";
import { addPoint, surfaceOf } from "@/lib/scrapbook/surface";
import { drawCutout, layoutCutout, loadCutoutFont, type CutoutFont, type Glyph, type LoadedFont } from "@/lib/scrapbook/cutout";
import type { Adjust, DiscText, Frame, Layer, ScrapAsset, Template } from "@/lib/scrapbook/types";
import { toast } from "@/components/ui/kit";
import { readPhoto, uid, type Photo } from "./parts";
import type { FrameChoice } from "./FramePicker";
import { clone, useScrapDoc } from "./useScrapDoc";

/** chữ của mẫu (dòng chính / phụ) → lớp chữ bình thường mang nội dung riêng (khách bấm để sửa, chọn rồi xoá nếu không muốn) */
export function customizeText(t: Template, text: DiscText): Template {
  return { ...t, layers: t.layers.flatMap((l) => (l.k === "text" && l.role !== "custom" ? ((l.role === "main" ? text.main : text.sub).trim() ? [{ ...l, role: "custom" as const, value: l.role === "main" ? text.main : text.sub }] : []) : [l])) };
}
/** cỡ mặc định của ô ảnh mới thêm: ~45% bề rộng 1 trang (12 cm) / đường kính đĩa */
export const SLOT_W = 54;
export type UserSticker = { id: string; blob: Blob; url: string; img: HTMLCanvasElement };
const btn = "inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] hover:bg-[#f4f4f5]";

export function useScrapStudio(o: {
  prefix: string; max: number; assets: ScrapAsset[]; frames: Frame[]; fonts: CutoutFont[]; glyphs: Glyph[]; defaultText: DiscText;
  extra: Partial<DraftMeta>; onLoad: (meta: DraftMeta, photos: Photo[]) => Template[] | void; wantAllFonts: boolean;
  persist?: boolean; // lưu nháp IndexedDB (mode khách) — trình sửa mẫu của admin: false
  template?: boolean; // mode "template" (admin): ô ảnh theo số thứ tự (slot), không gán ảnh khách
  slotPhotos?: (CanvasImageSource & { width: number; height: number })[]; // ảnh thử theo slot (mode template / ảnh mẫu)
  uploadBg?: (f: File) => Promise<string>; // tải ảnh nền: admin → link ảnh trên bucket; không có → giữ trên máy (khách)
}) {
  const persist = o.persist !== false;
  const D = useScrapDoc();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [text, setText] = useState<DiscText>(o.defaultText);
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});
  const [applied, setApplied] = useState<string | null>(null);
  const [ustickers, setUstickers] = useState<UserSticker[]>([]);
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [editText, setEditTextS] = useState<number | null>(null); // lớp chữ đang sửa trực tiếp trên trang
  const [selectAll, setSelectAll] = useState(false);
  const [wishOpen, setWishOpenS] = useState(false);
  const [colors, setColors] = useState<string[]>([]); // màu riêng đã dùng trong thiết kế (tối đa 8, mới nhất ở đầu)
  const addColor = (c: string) => setColors((cur) => [c.toLowerCase(), ...cur.filter((x) => x !== c.toLowerCase())].slice(0, 8)); // khối "Lời chúc có sẵn" (mỗi lúc chỉ làm 1 việc)
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
  const [bgLocal, setBgLocal] = useState<UserSticker[]>([]); // ảnh nền khách tải (giữ trên máy, lưu nháp cùng sticker — id "bg_…")
  const [bgUrlImgs, setBgUrlImgs] = useState<Record<string, HTMLImageElement>>({});

  // ---------- khởi động: font, chất liệu, khung, bản nháp ----------
  useEffect(() => {
    let off = false;
    (async () => {
      await loadFonts();
      const [imgs, fr, draft] = await Promise.all([loadAssetImages(o.assets), loadFrameImages(o.frames), persist ? loadDraft(o.prefix) : Promise.resolve(null)]);
      if (off) return;
      setAssetImgs(imgs); setFrameImgs(fr);
      if (draft) {
        const list: Photo[] = [];
        for (const p of draft.photos) { try { list.push(await readPhoto(p.blob, p.name, p.id)); } catch { /* bỏ ảnh lỗi */ } }
        const us: UserSticker[] = [];
        for (const s of draft.stickers) { try { const p = await readPhoto(s.blob, "sticker.png", s.id); us.push({ id: s.id, blob: s.blob, url: p.url, img: p.img }); } catch { /* bỏ */ } }
        if (off) return;
        setPhotos(list); setUstickers(us.filter((x) => !x.id.startsWith("bg_"))); setBgLocal(us.filter((x) => x.id.startsWith("bg_"))); setColors(draft.meta.colors ?? []); setText(draft.meta.text ?? o.defaultText); setAdjust(draft.meta.adjust ?? {});
        const legacy = o.onLoad(draft.meta, list);
        if (draft.meta.doc?.length) { D.setDoc(draft.meta.doc); D.setEdited(!!draft.meta.edited); setApplied(draft.meta.applied ?? null); }
        else if (legacy?.length) { D.setDoc(legacy); D.setEdited(!!draft.meta.edited); }
      }
      setReady(true);
    })();
    return () => { off = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || !persist) return;
    const t = setTimeout(() => {
      saveDraft(o.prefix, photos.map((p) => ({ id: p.id, name: p.name, blob: p.blob })), { ...o.extra, text, adjust, doc: D.doc, edited: D.edited, applied, colors }, [...ustickers, ...bgLocal].map((s) => ({ id: s.id, blob: s.blob }))).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [ready, photos, text, adjust, D.doc, D.edited, applied, ustickers, bgLocal, o.extra, o.prefix, colors, persist]);

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
    // khung trang trí: khung PNG dùng như sticker (không chứa ảnh)
    for (const [id, f] of Object.entries(frameImgs)) m[`f:${id}`] = { img: f.img, asset: { id: `f:${id}`, name: f.frame.name, grp: "sticker", url: f.frame.url, tone: "any", region: null, is_active: true, sort_order: 0 } };
    return m;
  }, [assetImgs, ustickers, frameImgs]);

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
  // ảnh nền: link ảnh (mẫu admin) tải khi cần · ảnh khách giữ trên máy ("u:<id>")
  const bgKeys = useMemo(() => [...new Set((doc ?? []).flatMap((t) => [t.bg.image, t.bg2?.image]).filter((k): k is string => !!k))], [doc]);
  useEffect(() => {
    for (const k of bgKeys) if (/^https?:/.test(k) && !bgUrlImgs[k]) loadImg(k).then((im) => setBgUrlImgs((c) => ({ ...c, [k]: im }))).catch(() => null);
  }, [bgKeys, bgUrlImgs]);
  const bgImages = useMemo(() => ({ ...bgUrlImgs, ...Object.fromEntries(bgLocal.map((b) => [`u:${b.id}`, b.img])) }), [bgUrlImgs, bgLocal]);
  const renderOpts = useMemo<Omit<RenderOpts, "template" | "size">>(() => ({ photoMap, adjustMap: adjust, text, assets: assetsMap, frames: frameImgs, cutoutFonts: cutFonts, bgImages, photos: o.slotPhotos }), [photoMap, adjust, text, assetsMap, frameImgs, cutFonts, fontTick, bgImages, o.slotPhotos]); // eslint-disable-line react-hooks/exhaustive-deps
  /** đổi nền bề mặt đang xem. scope (cặp trang): "all" cả cặp · "left" trang trái · "right" trang phải */
  function setBg(scope: "all" | "left" | "right", v: Partial<Template["bg"]>) {
    if (!cur) return;
    D.begin();
    D.patchSurface(active, (t) => {
      if (scope === "all") return { ...t, bg: { ...t.bg, ...v }, bg2: undefined };
      const both = { bg: t.bg, bg2: t.bg2 ?? { ...t.bg } };
      return scope === "left" ? { ...t, ...both, bg: { ...both.bg, ...v } } : { ...t, ...both, bg2: { ...both.bg2, ...v } };
    });
    D.setEdited(true);
  }
  /** tải ảnh nền: admin → link trên bucket · khách → giữ trên máy */
  async function uploadBg(f: File) {
    if (o.uploadBg) return o.uploadBg(f);
    const id = `bg_${uid()}`, p = await readPhoto(f, f.name, id);
    setBgLocal((c) => [...c, { id, blob: f, url: p.url, img: p.img }]);
    return `u:${id}`;
  }

  // ---------- thao tác trên lớp của bề mặt đang xem ----------
  const setLayers = useCallback((fn: (L: Layer[]) => Layer[], touched?: Layer) => D.setLayers(active, fn, touched), [D, active]);
  const patchLayer = (i: number, v: Partial<Layer>) => setLayers((ls) => ls.map((l, j) => (j === i ? ({ ...l, ...v } as Layer) : l)), L[i]);
  function duplicate(i: number) {
    const l = L[i]; if (!l) return;
    D.begin();
    const c = { ...clone(l), x: l.x + 4, y: l.y + 4, user: o.template ? undefined : true, auto: undefined } as Layer;
    if (c.k === "photo" && !o.template) c.photo = "";
    setLayers((ls) => [...ls, c], c.k === "photo" ? undefined : c); setSel(L.length);
  }
  function removeLayer(i: number) {
    const l = L[i]; if (!l) return;
    D.begin(); setLayers((ls) => ls.filter((_, j) => j !== i), l.k === "photo" ? undefined : l); setSel(null); setEditLayer(null); setEditTextS(null);
  }
  function reorder(i: number, d: number) {
    const j = i + d; if (j < 0 || j >= L.length) return;
    D.begin(); setLayers((ls) => { const a = [...ls]; [a[i], a[j]] = [a[j], a[i]]; return a; }, L[i]); setSel(j);
  }
  function addAsset(a: ScrapAsset | string, at?: { x: number; y: number }, img?: CanvasImageSource & { width: number; height: number }) {
    if (!cur) { toast("Tải ảnh và chọn mẫu trước khi thêm sticker.", "err"); return; }
    const S = surfaceOf(cur), k = L.filter((l) => l.k === "sticker" && l.user).length, p = at ?? addPoint(S, k);
    let l: Layer;
    if (typeof a === "string") l = { k: "sticker", x: p.x, y: p.y, s: a.startsWith("f:") ? (S.round ? 34 : 46) : S.round ? 18 : 26, rot: 0, shape: "star", color: "#ff8fab", asset: a, user: true };
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
  // ---------- chữ: sửa trực tiếp trên trang ----------
  const isTextLayer = (l?: Layer | null) => l?.k === "text" || l?.k === "wish";
  const textValue = (i: number) => { const l = L[i]; return l?.k === "text" ? textOf(l, text) : l?.k === "wish" ? l.value : ""; };
  function setTextValue(i: number, v: string) {
    const l = L[i];
    if (l?.k === "text" && l.role !== "custom") setText((t) => ({ ...t, [l.role]: v }));
    else if (l?.k === "text" || l?.k === "wish") setLayers((ls) => ls.map((x, j) => (j === i ? ({ ...x, value: v } as Layer) : x)), l);
  }
  /** vào / thoát chế độ sửa chữ. Thoát mà chữ trống → xoá luôn lớp đó */
  function setEditText(i: number | null, all = false, noBegin = false) {
    if (i === null) {
      const cur0 = editText;
      setEditTextS(null); setSelectAll(false);
      if (cur0 !== null && isTextLayer(L[cur0]) && !textValue(cur0).trim()) { setLayers((ls) => ls.filter((_, j) => j !== cur0), L[cur0]); setSel(null); }
      return;
    }
    if (!noBegin) D.begin();
    setSel(i); setEditTextS(i); setSelectAll(all); setWishOpenS(false);
  }
  function setWishOpen(v: boolean) {
    setWishOpenS(v);
    if (v) { if (editText !== null) setEditText(null); setSel(null); }
  }
  useEffect(() => { setEditTextS(null); }, [active]);
  // chọn 1 lớp chữ trên trang → đóng khối Lời chúc (hiện Cài đặt chữ)
  useEffect(() => { if (sel !== null && isTextLayer(L[sel])) setWishOpenS(false); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const newTextAt = (value: string, size: number): Layer | null => {
    if (!cur) return null;
    const S = surfaceOf(cur), e = largestEmpty(S, L), w = S.w * 0.6;
    return { k: "text", role: "custom", value, x: Math.min(S.w - w / 2, Math.max(w / 2, e.x)), y: e.y, w, size, rot: 0, font: "hand", color: "#3f3f46", family: "Dancing Script", align: "center", lh: 1.25, user: true };
  };
  /** "Không giấy": khung lời chúc → lớp chữ thường (giữ nội dung, font, màu chữ) */
  function wishToText(i: number) {
    const l = L[i]; if (l?.k !== "wish") return;
    const t: Layer = { k: "text", role: "custom", value: l.value, x: l.x, y: l.y, w: l.w, size: Math.max(3, Math.min(7, l.h / 5)), rot: l.rot, font: "hand", color: l.ink, family: l.cutout ? undefined : l.family ?? "Dancing Script", cutout: l.cutout, align: "center", lh: 1.25, user: l.user };
    D.begin(); setLayers((ls) => ls.map((x, j) => (j === i ? t : x)), l);
  }
  /** "+ Thêm chữ": chữ mẫu ở vùng trống lớn nhất, chọn luôn + vào chế độ sửa (bôi đen toàn bộ) */
  function addText() {
    if (!cur) { toast("Tải ảnh và chọn mẫu trước khi thêm chữ.", "err"); return; }
    const l = newTextAt("Nhập chữ của bạn", surfaceOf(cur).round ? 6 : 7)!;
    D.begin(); setLayers((ls) => [...ls, l], l);
    setEditText(L.length, true, true);
  }
  /** lời chúc có sẵn → lớp mới ở vùng trống lớn nhất (trang booklet: khung lời chúc · đĩa: chữ thường), đóng khối Lời chúc, chọn lớp mới */
  function addWish(content: string) {
    if (!cur) { toast("Chọn mẫu trước khi thêm lời chúc.", "err"); return; }
    const S = surfaceOf(cur);
    let l: Layer;
    if (S.round) l = { ...newTextAt(content, 4.5)!, family: "Dancing Script" } as Layer;
    else {
      const e = largestEmpty(S, L), w = Math.max(36, Math.min(78, e.r * 2 * 0.9)), h = Math.max(22, Math.min(60, w * 0.55));
      l = { k: "wish", x: e.x, y: e.y, w, h, rot: 0, card: "note", color: "#fff3a8", ink: "#3f3f46", value: content, family: "Dancing Script", seed: Math.floor(Math.random() * 1e6), user: true };
    }
    D.begin(); setLayers((ls) => [...ls, l], l); setWishOpenS(false); setSel(L.length);
  }
  /** áp khung / hình dạng cho ô ảnh: giữ tâm + chiều rộng, chiều cao theo tỉ lệ khung; ảnh trong ô tự coverCrop vào vùng mới */
  const withChoice = (x: Extract<Layer, { k: "photo" }>, c: FrameChoice): Layer => (
    c.kind === "frame" ? { ...x, frame: c.frame.id, frameSets: undefined, shape: "rect", h: x.w * (c.frame.ratio || 1), border: undefined }
      : c.kind === "shape" ? { ...x, frame: undefined, frameSets: undefined, asset: undefined, shape: c.shape, h: x.w * c.ratio, border: c.shape === "circle" || c.shape === "heart" ? "#ffffff" : undefined }
        : { ...x, frame: undefined, frameSets: undefined, asset: undefined, shape: x.shape === "frame" ? "rect" : x.shape });
  /** "+ Thêm khung ảnh": ô mới TO (rộng ~45% 1 trang / đường kính đĩa, giữ tỉ lệ khung) ở vùng trống lớn nhất của bề mặt đang xem,
      nằm trên các lớp khác; hết chỗ thì đặt giữa trang, xoay nhẹ. Tự chọn ô vừa thêm; có ảnh thì gán luôn. */
  function addSlot(c: FrameChoice, photoId: string | null = null) {
    if (!cur) return;
    const S = surfaceOf(cur), e = largestEmpty(S, L);
    const ratio = c.kind === "frame" ? c.frame.ratio || 1 : c.kind === "shape" ? c.ratio : 0.78;
    let w = SLOT_W, h = w * ratio;
    if (h > S.h * 0.8) { h = S.h * 0.8; w = h / ratio; }
    const fits = e.r * 2 >= Math.hypot(w, h) * 0.75;
    const cx0 = S.kind === "spread" ? (e.x < 120 ? 60 : 180) : S.w / 2;
    const pos = fits ? { x: e.x, y: e.y, rot: 0 } : { x: cx0, y: S.h / 2, rot: (Math.random() * 2 - 1) * 8 };
    // mode template: ô ảnh theo số thứ tự (ảnh thử "s<k>" → slot k, bỏ qua → số tiếp theo), không gán ảnh khách
    const nextSlot = Math.max(-1, ...(doc ?? []).flatMap((t) => t.layers.flatMap((x) => (x.k === "photo" ? [x.slot] : [])))) + 1;
    const base: Extract<Layer, { k: "photo" }> = o.template
      ? { k: "photo", slot: photoId?.startsWith("s") ? Number(photoId.slice(1)) : nextSlot, x: pos.x, y: pos.y, w, h, rot: pos.rot, shape: "rect", seed: Math.floor(Math.random() * 1e6) }
      : { k: "photo", slot: 999, x: pos.x, y: pos.y, w, h, rot: pos.rot, shape: "rect", seed: Math.floor(Math.random() * 1e6), photo: photoId ?? "" };
    const l = withChoice(base, c);
    D.begin();
    setLayers((ls) => [...ls.map((x) => (!o.template && photoId && x.k === "photo" && x.photo === photoId ? { ...x, photo: "" } : x)), l]);
    setSel(L.length); setAddSlotOpen(false);
  }
  function setFrame(i: number, c: FrameChoice) {
    const l = L[i]; if (l?.k !== "photo") return;
    D.begin(); setLayers((ls) => ls.map((x, j) => (j === i && x.k === "photo" ? withChoice(x, c) : x)));
    setFrameFor(null);
  }

  // ---------- phím tắt ----------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey ? D.redo() : D.undo()) setSel(null); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); if (D.redo()) setSel(null); return; }
      if (e.key === "Escape") { setSel(null); setEditLayer(null); if (editText !== null) setEditText(null); }
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
          {!o.template && <button type="button" onClick={() => setPickFor(sel)} className={btn}><ImagePlus size={13} /> {selL.photo ? "Đổi ảnh" : "Chọn ảnh"}</button>}
          <button type="button" onClick={() => setFrameFor(sel)} className={btn}><FrameIcon size={13} /> Đổi khung</button>
        </>
      ) : <button type="button" onClick={() => duplicate(sel!)} title="Nhân bản (Ctrl+D)" className={btn}><Copy size={13} /> Nhân bản</button>}
      <button type="button" onClick={() => reorder(sel!, 1)} title="Đưa lên trên" className={btn}><ArrowUp size={13} /> Lên trên</button>
      <button type="button" onClick={() => reorder(sel!, -1)} title="Đưa xuống dưới" className={btn}><ArrowDown size={13} /> Xuống dưới</button>
      <button type="button" onClick={() => removeLayer(sel!)} title="Xoá (Delete)" className={`${btn} text-[#dc2626] hover:bg-[#fef2f2]`}><Trash2 size={13} /> {selL.k === "photo" ? "Xoá ô ảnh" : "Xoá"}</button>
    </>
  ) : null;

  /** nạp thiết kế đã lưu trên tài khoản (thay bản nháp) */
  function hydrate(v: { photos: Photo[]; stickers: UserSticker[]; text: DiscText; adjust: Record<string, Adjust>; doc: Template[]; applied: string | null; colors?: string[] }) {
    setColors(v.colors ?? []); setPhotos(v.photos); setUstickers(v.stickers); setText(v.text); setAdjust(v.adjust); D.setDoc(v.doc); D.setEdited(true); setApplied(v.applied); D.reset(); setActive(0); setSel(null);
  }
  return {
    setBg, uploadBg, bgLocal, colors, addColor, wishToText, editText, setEditText, selectAll, textValue, setTextValue, wishOpen, setWishOpen, isTextLayer,
    hydrate, D, doc, cur, L, ready, photos, setPhotos, used, addFiles, replacePhoto, removePhoto, reorderPhotos, assignPhoto,
    text, setText, adjust, setAdjust, applied, setApplied, ustickers, addUserSticker, removeUserSticker, stickerFiles, setStickerFiles,
    assetImgs, frameImgs, cutFonts, fontPreviews, renderOpts, active, setActive, sel, setSel, editLayer, setEditLayer,
    setLayers, patchLayer, duplicate, removeLayer, reorder, addAsset, addText, addWish, addSlot, setFrame, tools,
    pickFor, setPickFor, frameFor, setFrameFor, addSlotOpen, setAddSlotOpen,
  };
}
