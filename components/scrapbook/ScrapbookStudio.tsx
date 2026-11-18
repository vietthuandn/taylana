"use client";

/* Trang "CD Scrapbook" (/thiet-ke/scrapbook): khách tải 5–10 ảnh → web tự dựng 5 mẫu mặt đĩa kiểu scrapbook xé dán.
   Trái 36%: tải ảnh, sắp thứ tự, chữ trên đĩa, chọn mẫu · Phải: mặt đĩa xem trước (bấm ảnh để chỉnh ô, kéo thả đổi chỗ, bấm chữ để sửa).
   Ảnh của khách chỉ xử lý trên trình duyệt — chỉ tải lên khi khách đặt đơn (file in mặt đĩa). */
import "@fontsource/dancing-script/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/pangolin/400.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Dices, Download, Image as ImageIcon, Minus, Plus, RefreshCw, ShoppingBag, Trash2, Upload } from "lucide-react";
import { GRADIENTS, paintBackground, type BgChoice } from "@/lib/mockup/backgrounds";
import type { MockupBackground } from "@/lib/mockup/types";
import { defaultGlass } from "@/lib/mockup/types";
import { renderSystem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { saveBlob } from "@/lib/imageTools";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { loadDraft, saveDraft } from "@/lib/scrapbook/draft";
import { savePendingDisc } from "@/lib/scrapbook/pending";
import { inBox, loadFonts, renderDisc, type Hit, type TextHit } from "@/lib/scrapbook/render";
import { templatesFor } from "@/lib/scrapbook/templates";
import { MAX_PHOTOS, MIN_PHOTOS, PRINT_PX, STYLES, type Adjust, type DiscText, type ScrapAsset, type Style, type Template, type TemplateSetting } from "@/lib/scrapbook/types";
import { BgPicker } from "@/components/mockup-viewer/BgPicker";
import { DownloadMenu } from "@/components/mockup-viewer/DownloadMenu";
import { useFitBox } from "@/components/mockup-viewer/useFitBox";
import { Button, Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";

type Photo = { id: string; name: string; blob: Blob; url: string; img: HTMLCanvasElement };
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const uid = () => Math.random().toString(36).slice(2, 10);

// đọc ảnh (HEIC chỉ được nếu trình duyệt tự đọc), thu nhỏ tối đa 2000px cho nhẹ khi dựng
async function readPhoto(file: Blob, name: string, id = uid()): Promise<Photo> {
  const url = URL.createObjectURL(file);
  const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("bad")); i.src = url; });
  const k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, c.width, c.height);
  return { id, name, blob: file, url, img: c };
}
const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không xuất được ảnh"))), type, q));

export function ScrapbookStudio({ assets, settings, backgrounds, boxPackageId }: {
  assets: ScrapAsset[]; settings: TemplateSetting[]; backgrounds: MockupBackground[]; boxPackageId: string | null;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [text, setText] = useState<DiscText>({ main: "Happy Birthday", sub: "" });
  const [style, setStyle] = useState<Style | null>(null);
  const [seeds, setSeeds] = useState<Partial<Record<Style, number>>>({});
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});
  const [guides, setGuides] = useState(true);
  const [boxView, setBoxView] = useState(false);
  const [bg, setBg] = useState<BgChoice>({ kind: "gradient", g: GRADIENTS[0] });
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [textEdit, setTextEdit] = useState<TextHit | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assetImgs, setAssetImgs] = useState<Awaited<ReturnType<typeof loadAssetImages>>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const replaceIn = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const hits = useRef<{ slots: Hit[]; texts: TextHit[] }>({ slots: [], texts: [] });
  const drag = useRef<{ mode: "pan" | "press" | "swap"; slot: number; sx: number; sy: number; adj0?: Adjust; rot: number } | null>(null);
  const { area, width } = useFitBox(1);

  // ---------- khởi động: font, chất liệu, bản nháp ----------
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
          setAdjust(draft.meta.adjust ?? {}); setSeeds(draft.meta.seeds ?? {});
        }
      }
      if (!off) setReady(true);
    })();
    return () => { off = true; };
  }, [assets]);
  // lưu nháp (IndexedDB) sau mỗi thay đổi
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { saveDraft(photos.map((p) => ({ id: p.id, name: p.name, blob: p.blob })), { style, text, adjust, seeds }).catch(() => {}); }, 700);
    return () => clearTimeout(t);
  }, [ready, photos, style, text, adjust, seeds]);

  // ---------- mẫu ----------
  const n = photos.length;
  const usable = n >= MIN_PHOTOS && n <= MAX_PHOTOS;
  const templates = useMemo(() => (usable ? templatesFor(n, settings, assets, seeds) : []), [usable, n, settings, assets, seeds]);
  const tpl: Template | undefined = templates.find((t) => t.style === style) ?? templates[0];
  const slotPhotos = useMemo(() => photos.map((p) => p.img), [photos]);
  const slotAdjust = useMemo(() => Object.fromEntries(photos.map((p, i) => [i, adjust[p.id]])), [photos, adjust]);

  // ---------- thêm / thay / xoá ảnh ----------
  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return toast(`Tối đa ${MAX_PHOTOS} ảnh — xoá bớt ảnh trước khi thêm.`, "err");
    if (files.length > room) toast(`Chỉ lấy ${room} ảnh đầu (tối đa ${MAX_PHOTOS} ảnh).`, "err");
    const out: Photo[] = [];
    for (const f of files.slice(0, room)) {
      try { out.push(await readPhoto(f, f.name)); } catch { toast(`Không đọc được ảnh "${f.name}"${/heic|heif/i.test(f.name) ? " (trình duyệt này chưa đọc được HEIC)" : ""}.`, "err"); }
    }
    setPhotos((cur) => [...cur, ...out].slice(0, MAX_PHOTOS));
  }
  async function replace(id: string, f: File) {
    try {
      const p = await readPhoto(f, f.name, uid());
      setPhotos((cur) => cur.map((x) => (x.id === id ? p : x)));
    } catch { toast(`Không đọc được ảnh "${f.name}".`, "err"); }
  }
  const remove = (id: string) => setPhotos((cur) => cur.filter((p) => p.id !== id));
  const move = (from: number, to: number) => setPhotos((cur) => { const a = [...cur]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });
  const swap = (a: number, b: number) => setPhotos((cur) => { const x = [...cur]; [x[a], x[b]] = [x[b], x[a]]; return x; });

  // ---------- xem trước ----------
  const W = Math.min(1600, Math.round((width || 600) * (typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1)));
  const [boxUrl, setBoxUrl] = useState("");
  useEffect(() => {
    if (!ready || !tpl || boxView) return;
    const r = renderDisc({ template: tpl, photos: slotPhotos, adjust: slotAdjust, text, assets: assetImgs, size: W, guides, editSlot, hoverSlot });
    hits.current = { slots: r.hits, texts: r.texts };
    const v = view.current;
    if (v) { v.width = W; v.height = W; v.getContext("2d")!.drawImage(r.canvas, 0, 0); }
  }, [ready, tpl, slotPhotos, slotAdjust, text, assetImgs, W, guides, editSlot, hoverSlot, boxView]);
  // xem trong hộp: Mẫu hệ thống, "Một món" = hộp mở có đĩa
  const mockupCanvas = useCallback(async (N: number) => {
    if (!tpl) return null;
    await loadSprites();
    const disc = renderDisc({ template: tpl, photos: slotPhotos, adjust: slotAdjust, text, assets: assetImgs, size: Math.min(PRINT_PX, N * 0.6), mode: "print" }).canvas;
    return renderSystem(N, { pack: "box", disc: disc as unknown as HTMLImageElement, pages: [] },
      { arrange: "single", single: "open", seed: 1, tray: "clear", glass: defaultGlass }, (ctx, w, h) => paintBackground(ctx, w, h, bg));
  }, [tpl, slotPhotos, slotAdjust, text, assetImgs, bg]);
  useEffect(() => {
    if (!boxView) return;
    let off = false;
    mockupCanvas(1200).then((c) => { if (!off && c) setBoxUrl(c.toDataURL("image/jpeg", 0.9)); });
    return () => { off = true; };
  }, [boxView, mockupCanvas]);

  // thumbnail 5 mẫu dựng từ chính ảnh của khách
  useEffect(() => {
    if (!ready || !templates.length) { setThumbs({}); return; }
    let off = false;
    const t = setTimeout(() => {
      const out: Record<string, string> = {};
      for (const tp of templates) {
        if (off) return;
        out[tp.style] = renderDisc({ template: tp, photos: slotPhotos, adjust: slotAdjust, text, assets: assetImgs, size: 220 }).canvas.toDataURL("image/png");
      }
      if (!off) setThumbs(out);
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [ready, templates, slotPhotos, slotAdjust, text, assetImgs]);

  // ---------- tương tác trên đĩa ----------
  const toMM = (e: { clientX: number; clientY: number }) => {
    const r = view.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 120, y: ((e.clientY - r.top) / r.height) * 120 };
  };
  const slotAt = (x: number, y: number) => [...hits.current.slots].reverse().find((h) => inBox(x, y, h));
  const textAt = (x: number, y: number) => [...hits.current.texts].reverse().find((h) => inBox(x, y, h));
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = toMM(e);
    const t = textAt(p.x, p.y), s = slotAt(p.x, p.y);
    if (t && (!s || editSlot === null)) { setTextEdit(t); setEditSlot(null); return; }
    if (!s) { setEditSlot(null); return; }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const ph = photos[s.slot];
    if (editSlot === s.slot && ph) drag.current = { mode: "pan", slot: s.slot, sx: p.x, sy: p.y, adj0: adjust[ph.id] ?? { dx: 0, dy: 0, zoom: 1 }, rot: s.rot };
    else drag.current = { mode: "press", slot: s.slot, sx: p.x, sy: p.y, rot: s.rot };
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d) return;
    const p = toMM(e);
    if (d.mode === "pan") {
      const ph = photos[d.slot];
      if (!ph) return;
      const a = (-d.rot * Math.PI) / 180, dx = p.x - d.sx, dy = p.y - d.sy;
      setAdjust((cur) => ({ ...cur, [ph.id]: { ...d.adj0!, dx: d.adj0!.dx + dx * Math.cos(a) - dy * Math.sin(a), dy: d.adj0!.dy + dx * Math.sin(a) + dy * Math.cos(a) } }));
    } else {
      if (d.mode === "press" && Math.hypot(p.x - d.sx, p.y - d.sy) > 2.5) d.mode = "swap";
      if (d.mode === "swap") { const s = slotAt(p.x, p.y); setHoverSlot(s && s.slot !== d.slot ? s.slot : null); }
    }
  }
  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    drag.current = null;
    setHoverSlot(null);
    if (!d) return;
    if (d.mode === "press") { setEditSlot(d.slot); setTextEdit(null); }
    if (d.mode === "swap") { const p = toMM(e); const s = slotAt(p.x, p.y); if (s && s.slot !== d.slot) { swap(d.slot, s.slot); toast("Đã đổi chỗ 2 ảnh"); } }
  }
  const zoom = useCallback((dz: number) => {
    if (editSlot === null) return;
    const ph = photos[editSlot];
    if (!ph) return;
    setAdjust((cur) => { const a = cur[ph.id] ?? { dx: 0, dy: 0, zoom: 1 }; return { ...cur, [ph.id]: { ...a, zoom: Math.min(3, Math.max(1, Math.round((a.zoom + dz) * 100) / 100)) } }; });
  }, [editSlot, photos]);
  // cuộn chuột để phóng to ô đang chỉnh (listener không passive để chặn cuộn trang)
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const h = (e: WheelEvent) => { if (editSlot === null) return; e.preventDefault(); zoom(e.deltaY < 0 ? 0.08 : -0.08); };
    v.addEventListener("wheel", h, { passive: false });
    return () => v.removeEventListener("wheel", h);
  }, [editSlot, zoom]);

  // ---------- xuất file / đặt in ----------
  const printBlob = async () => {
    if (!tpl) throw new Error("Cần ít nhất 5 ảnh");
    await loadFonts();
    return toBlob(renderDisc({ template: tpl, photos: slotPhotos, adjust: slotAdjust, text, assets: assetImgs, size: PRINT_PX, mode: "print" }).canvas, "image/png");
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
      await savePendingDisc(await printBlob()); // giữ trên máy, gắn vào đơn ngay sau khi đặt
      router.push(`/san-pham/in-cd-theo-yeu-cau${boxPackageId ? `?goi=${encodeURIComponent(boxPackageId)}` : ""}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Không tạo được file in", "err"); setBusy(false); }
  }

  const ph = editSlot !== null ? photos[editSlot] : undefined;
  const textBox = textEdit && width ? { left: (textEdit.x / 120) * width, top: (textEdit.y / 120) * width } : null;

  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col md:min-h-0 md:flex-row md:border-x md:border-[#e5e5e7]">
      {/* ---------- Trái 36%: tải ảnh · chữ · chọn mẫu (điện thoại: nằm dưới xem trước) ---------- */}
      <aside className="order-2 space-y-6 border-[#e5e5e7] bg-white p-6 md:order-1 md:w-[36%] md:min-w-[360px] md:shrink-0 md:overflow-y-auto md:border-r">
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[14px] font-semibold text-[#18181b]">Ảnh của bạn <span className="text-[12px] font-normal text-[#71717a]">({n}/{MAX_PHOTOS} · cần {MIN_PHOTOS}–{MAX_PHOTOS} ảnh)</span></p>
          </div>
          <button type="button" onClick={() => fileIn.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
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
                    <button type="button" title="Thay ảnh" aria-label="Thay ảnh" onClick={() => { replaceId.current = p.id; replaceIn.current?.click(); }}
                      className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#18181b] shadow"><RefreshCw size={12} /></button>
                    <button type="button" title="Xoá" aria-label="Xoá" onClick={() => remove(p.id)}
                      className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#dc2626] shadow"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {n > 1 && <p className="mt-2 text-[12px] text-[#a1a1aa]">Kéo thả để đổi thứ tự — ảnh số 1 vào ô to nhất.</p>}
        </section>

        <section className="space-y-2">
          <p className="text-[14px] font-semibold text-[#18181b]">Chữ trên đĩa</p>
          <input value={text.main} onChange={(e) => setText({ ...text, main: e.target.value })} placeholder="Dòng chính" maxLength={40}
            className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
          <input value={text.sub} onChange={(e) => setText({ ...text, sub: e.target.value })} placeholder="Dòng phụ: tên hoặc ngày (không bắt buộc)" maxLength={40}
            className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-semibold text-[#18181b]">Chọn mẫu</p>
            {tpl && (
              <button type="button" onClick={() => setSeeds((s) => ({ ...s, [tpl.style]: Math.floor(Math.random() * 1e6) }))} title="Xáo trộn mẫu đang chọn" aria-label="Xáo trộn"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e7] px-3 text-[12px] font-medium text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><Dices size={14} /> Xáo trộn</button>
            )}
          </div>
          {!usable ? (
            <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">Tải lên {MIN_PHOTOS}–{MAX_PHOTOS} ảnh để xem các mẫu.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-5">
              {templates.map((t) => (
                <button key={t.style} type="button" onClick={() => { setStyle(t.style); setEditSlot(null); }} title={STYLES.find((s) => s.id === t.style)?.name}
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
      </aside>

      {/* ---------- Phải: xem trước mặt đĩa ---------- */}
      <section className="relative order-1 flex min-h-[420px] min-w-0 flex-1 flex-col md:order-2 md:min-h-0 md:overflow-hidden">
        <div className="flex items-center justify-end gap-4 px-4 pt-3 md:absolute md:right-0 md:top-0 md:z-10">
          <Toggle checked={guides} onChange={setGuides} label="Hiển thị guideline" />
          <Toggle checked={boxView} onChange={(v) => { setBoxView(v); setEditSlot(null); }} label="Xem trong hộp" />
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
            <div className="relative" style={{ width: width || "100%" }}>
              <canvas ref={view} className={cx("block aspect-square w-full touch-none", editSlot !== null ? "cursor-move" : "cursor-pointer")}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setHoverSlot(null); }} />
              {/* chỉnh ô: +/− phóng to */}
              {editSlot !== null && ph && (
                <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[12px] text-[#52525b] shadow">
                  <span className="px-1">Ảnh {editSlot + 1}: kéo để dịch</span>
                  <button type="button" onClick={() => zoom(-0.1)} aria-label="Thu nhỏ" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Minus size={14} /></button>
                  <button type="button" onClick={() => zoom(0.1)} aria-label="Phóng to" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7]"><Plus size={14} /></button>
                  <button type="button" onClick={() => setEditSlot(null)} className="rounded-full bg-[#ff5fa2] px-2.5 py-1 font-medium text-white">Xong</button>
                </div>
              )}
              {/* sửa chữ ngay trên đĩa */}
              {textEdit && textBox && (
                <input autoFocus value={textEdit.role === "main" ? text.main : text.sub} maxLength={40}
                  onChange={(e) => setText({ ...text, [textEdit.role]: e.target.value })}
                  onBlur={() => setTextEdit(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setTextEdit(null); }}
                  className="absolute h-9 w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border-2 border-[#ff5fa2] bg-white/95 px-2 text-center text-[14px] shadow outline-none"
                  style={{ left: textBox.left, top: textBox.top }} />
              )}
            </div>
          )}
        </div>

        {/* thanh đáy: Nền · Tải về · Đặt in */}
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
