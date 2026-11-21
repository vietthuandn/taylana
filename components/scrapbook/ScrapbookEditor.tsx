"use client";

/* Trình chỉnh scrapbook DÙNG CHUNG cho khách (CD Template, Booklet Template — mode "customer") và trình sửa mẫu
   của admin (mode "template"). Trái: tab Ảnh · Sticker · Chữ · Nền. Giữa: bề mặt đang xem (đĩa / trang / cặp trang)
   — chọn lớp, kéo, phóng / thu, xoay, menu chuột phải, phím tắt, hoàn tác / làm lại, đường gióng, sửa chữ trực tiếp;
   nhiều bề mặt (booklet) thì có thanh chuyển trang + thumbnail. Phải (mode template): panel admin truyền vào.
   Mọi logic dùng chung nằm ở useScrapStudio; component này chỉ ghép giao diện. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Maximize, Minus, MoreHorizontal, Plus, Image as ImageIcon, LayoutTemplate, PaintBucket, Redo2, RotateCcw, Save, Smile, Type, Undo2, X } from "lucide-react";
import { EditorHeader, type EditorHeaderProps } from "@/components/editor/EditorHeader";
import { renderSurface, type RenderOpts } from "@/lib/scrapbook/render";
import { surfaceOf } from "@/lib/scrapbook/surface";
import type { CutoutFont } from "@/lib/scrapbook/cutout";
import type { AssetGroupRow, Frame, FrameSet, ScrapAsset, Wish, WishTopic } from "@/lib/scrapbook/types";
import { Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { StickerTab } from "./StickerTab";
import { TextTab } from "./TextTab";
import { BgTab } from "./BgTab";
import { SurfaceView } from "./SurfaceView";
import { AddFrameFlow, FramePicker } from "./FramePicker";
import { PickPhotoModal } from "./parts";
import { UserStickerModal } from "./UserStickerModal";
import { BgEditBar } from "./BgEditBar";
import { TextToolbar } from "./TextToolbar";
import { layerClip, type useScrapStudio } from "./useScrapStudio";
import { SheetSlicer } from "@/app/admin/(panel)/scrapbook/SheetSlicer";
import { FEATURE_OLD_STICKER_UPLOAD } from "@/lib/features";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/storage/client";
import { uploadAssetThumb } from "@/lib/scrapbook/assetGroupsClient";

export type EditorTab = "mau" | "anh" | "sticker" | "chu" | "nen";

type Studio = ReturnType<typeof useScrapStudio>;

export function ScrapbookEditor(p: {
  mode: "customer" | "template";
  st: Studio; assets: ScrapAsset[]; assetGroups?: AssetGroupRow[]; frames: Frame[]; frameSets: FrameSet[]; fonts: CutoutFont[]; topics: WishTopic[]; wishes: Wish[];
  tab: EditorTab; setTab: (t: EditorTab) => void;
  render?: Omit<RenderOpts, "template" | "size">; // mặc định st.renderOpts
  templateTab?: React.ReactNode; // mục "Mẫu" (danh sách mẫu / bộ mẫu)
  photoTab?: React.ReactNode; // nội dung thêm của tab Ảnh (khách: ảnh của bạn, số trang, chọn mẫu…)
  framePhotos?: { id: string; url: string }[]; // ảnh cho bước 2 của "+ Thêm khung ảnh" (khách: ảnh đã tải · template: ảnh thử)
  toolbar?: React.ReactNode; onRestore?: () => void; canRestore?: boolean;
  overlay?: React.ReactNode; // thay cho bề mặt (vd. "Xem trong hộp")
  empty?: React.ReactNode; // chưa có thiết kế
  pageLabel?: (i: number, count: number) => string;
  onBackgroundDbl?: (at: { x: number; y: number }) => void;
  bottom?: React.ReactNode; right?: React.ReactNode; maxW?: string;
  guides: boolean; setGuides: (v: boolean) => void;
  header?: Omit<EditorHeaderProps, "guides" | "undo">; // trình chỉnh phía khách: header riêng (thay header của web)
}) {
  const { st, mode } = p;
  const ro = p.render ?? st.renderOpts;
  const doc = st.doc, cur = st.cur, count = doc?.length ?? 0;
  const T = p.topics, W = p.wishes;

  // chọn 1 lớp chữ trên bề mặt → mở tab Chữ (hiện Cài đặt chữ)
  useEffect(() => { if (st.sel !== null && st.isTextLayer(st.L[st.sel])) p.setTab("chu"); }, [st.sel]); // eslint-disable-line react-hooks/exhaustive-deps
  // cột công cụ kiểu Canva: bấm lại mục đang mở → thu gọn panel (khu làm việc rộng hơn)
  const [collapsed, setCollapsed] = useState(false);
  // điện thoại: bấm 1 ảnh trong "Ảnh của bạn" → chèn vào thiết kế + đóng panel để sửa ảnh ngay
  useEffect(() => { const h = () => { if (window.innerWidth < 768) setCollapsed(true); }; window.addEventListener("scrap-close-panel", h); return () => window.removeEventListener("scrap-close-panel", h); }, []);
  const switchTab = (id: EditorTab) => {
    if (id === p.tab && !collapsed) { setCollapsed(true); return; }
    setCollapsed(false); p.setTab(id);
    if (id !== "chu" && st.sel !== null && st.isTextLayer(st.L[st.sel])) { st.setEditText(null); st.setSel(null); }
  };
  useEffect(() => { if (st.sel !== null && st.isTextLayer(st.L[st.sel]) && window.innerWidth >= 768) setCollapsed(false); }, [st.sel]); // điện thoại: chọn chữ chỉ hiện thanh công cụ, không mở panel // eslint-disable-line react-hooks/exhaustive-deps

  // khung xem: bề mặt to nhất có thể (trang: cao × 0.85 · rộng × 0.92)
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 500 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const r = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    r.observe(el);
    return () => r.disconnect();
  }, []);
  const S = surfaceOf(cur);
  const fitW = Math.max(160, Math.floor(S.round ? Math.min(box.w, box.h) * 0.96 : Math.min(box.w * 0.92, box.h * 0.85 * (S.w / S.h))));
  // zoom khu xem trước: 1 = "Vừa màn hình" (mặc định) · 25%–300% · Ctrl + cuộn chuột
  const [zoom, setZoom] = useState(1);
  const clampZ = (z: number) => Math.min(4, Math.max(0.25, Math.round(z * 100) / 100));
  const width = Math.round(fitW * zoom);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const h = (e: WheelEvent) => { if (!e.ctrlKey) return; e.preventDefault(); setZoom((z) => clampZ(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);
  // thumbnail các bề mặt (booklet)
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    if (!doc || doc.length < 2) return;
    const t = setTimeout(() => setThumbs(doc.map((s) => renderSurface({ template: s, ...ro, size: s.surface === "spread" ? 300 : 150 }).canvas.toDataURL("image/jpeg", 0.8))), 400);
    return () => clearTimeout(t);
  }, [doc, ro]);
  const go = (i: number) => { st.setActive(Math.max(0, Math.min(count - 1, i))); st.setSel(null); st.setEditLayer(null); };
  const bgPreview = useMemo(() => {
    const m: Record<string, { src?: string }> = {};
    for (const b of st.bgLocal) m[`u:${b.id}`] = { src: b.url };
    for (const t of doc ?? []) for (const k of [t.bg.image, t.bg2?.image]) if (k && /^https?:/.test(k)) m[k] = { src: k };
    return m;
  }, [st.bgLocal, doc]);

  // bấm vào chỗ trống (vùng xám quanh bề mặt, chỗ trống của thanh công cụ trên / dưới) → bỏ chọn + thoát sửa chữ.
  // Không bỏ chọn khi bấm vào lớp (canvas tự xử lý) hay các điều khiển (nút, ô nhập, menu, thanh công cụ nổi…)
  const deselectOutside = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("canvas, button, a, input, textarea, select, label, [role=menu], [role=dialog], [data-keep-sel]")) return;
    if (st.sel !== null) st.setSel(null);
    if (st.editText !== null) st.setEditText(null);
    if (st.editLayer !== null) st.setEditLayer(null);
  };
  // ---------- Ctrl+V: ảnh trong clipboard → "Ảnh của bạn" + lớp ảnh tự do ở vùng trống lớn nhất (admin: tách sticker)
  //            link ảnh → tải qua /api/img-proxy · không có ảnh mà vừa Ctrl+C 1 lớp (≤ 30 giây) → dán lớp ----------
  const [saveMine, setSaveMine] = useState<string | null>(null);
  useEffect(() => {
    const h = async (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable=true], [contenteditable='']") || document.querySelector('[role="dialog"]')) return;
      const files = [...(e.clipboardData?.items ?? [])].filter((it) => it.kind === "file" && it.type.startsWith("image/")).map((it) => it.getAsFile()).filter((f): f is File => !!f);
      const text = e.clipboardData?.getData("text/plain")?.trim() ?? "";
      const useFiles = (f: File[]) => { if (mode === "customer") st.insertImages(f); else st.setStickerFiles(f.slice(0, 1)); };
      if (files.length) { e.preventDefault(); useFiles(files.map((f, i) => new File([f], f.name && f.name !== "image.png" ? f.name : `anh-dan-${Date.now()}-${i}.png`, { type: f.type }))); return; }
      if (/^https?:\/\/\S+$/i.test(text)) {
        e.preventDefault();
        try {
          const r = await fetch(`/api/img-proxy?url=${encodeURIComponent(text)}`);
          const b = r.ok ? await r.blob() : null;
          if (b && b.type.startsWith("image/")) { useFiles([new File([b], `anh-tu-link.${b.type.split("/")[1] || "jpg"}`, { type: b.type })]); return; }
        } catch { /* không phải ảnh */ }
      }
      if (layerClip.layer && Date.now() - layerClip.at < 30000) { e.preventDefault(); st.pasteLayer(); }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  });
  const RAIL: [EditorTab, string, React.ReactNode][] = [
    ...(p.templateTab ? [["mau", "Mẫu", <LayoutTemplate key="m" size={20} />] as [EditorTab, string, React.ReactNode]] : []),
    ["anh", "Ảnh", <ImageIcon key="a" size={20} />], ["sticker", "Sticker", <Smile key="s" size={20} />], ["chu", "Chữ", <Type key="c" size={20} />], ["nen", "Nền", <PaintBucket key="n" size={20} />],
  ];
  const open = !collapsed;
  const title = RAIL.find((x) => x[0] === p.tab)?.[1];
  const selT = st.sel !== null && st.isTextLayer(st.L[st.sel]) && !st.L[st.sel].ulock ? (st.L[st.sel] as Extract<(typeof st.L)[number], { k: "text" | "wish" }>) : null;
  const photoBar = st.photoTools("bar");
  // điện thoại: khung menu nổi đổi thành công cụ ảnh / khung ảnh / chữ theo lớp đang chọn
  const photoMobile = st.photoTools("mobile") ?? (selT && st.sel !== null ? (
    <TextToolbar l={selT} begin={st.D.begin} patch={(v) => st.patchLayer(st.sel!, v)} onEdit={() => st.setEditText(st.sel)} onPaper={(v) => { if (v === "none") st.wishToText(st.sel!); else st.textToWish(st.sel!, v); }}
      onFont={() => { p.setTab("chu"); setCollapsed(false); }} onMore={() => { p.setTab("chu"); setCollapsed(false); }} />
  ) : null);
  const multi = !!doc && count > 1;
  return (
    <div data-fit-screen data-editor={p.header ? "" : undefined} className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     {p.header && <EditorHeader h={{ ...p.header, guides: { value: p.guides, onChange: p.setGuides }, undo: { onUndo: () => { if (st.D.undo()) st.setSel(null); }, onRedo: () => { if (st.D.redo()) st.setSel(null); }, canUndo: st.D.canUndo, canRedo: st.D.canRedo } }} />}
     <div className={cx("flex w-full flex-1 flex-col md:min-h-0 md:flex-row", p.maxW)}>
      {/* ---------- trái: cột công cụ dọc (máy tính) / thanh ngang dưới đáy (điện thoại) + panel nội dung ---------- */}
      {/* điện thoại: khung menu NỔI dưới đáy (bo 20px, cách đáy 12px + safe-area, cách 2 bên 12px) — chọn 1 ảnh thì đổi thành công cụ ảnh */}
      {photoMobile && (
        <div data-keep-sel className="no-scrollbar fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 flex gap-0.5 overflow-x-auto rounded-[20px] bg-[var(--c-secondary)] p-1.5 shadow-[0_8px_28px_rgb(0_0_0/0.16)] md:hidden">{photoMobile}</div>
      )}
      <nav aria-label="Công cụ" className={cx("fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 flex rounded-[20px] bg-[var(--c-secondary)] p-1 md:bg-white shadow-[0_8px_28px_rgb(0_0_0/0.16)] md:static md:z-auto md:order-1 md:flex md:w-[72px] md:shrink-0 md:flex-col md:gap-1 md:rounded-none md:border-r md:border-[#e5e5e7] md:p-0 md:py-2 md:shadow-none", photoMobile && "max-md:hidden")}>
        {RAIL.map(([id, label, icon]) => {
          const on = p.tab === id && open;
          return (
            <button key={id} type="button" onClick={() => switchTab(id)} aria-pressed={on}
              className={cx("flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] py-2 text-[11px] font-medium md:mx-1.5 md:flex-none md:rounded-[10px] md:py-2.5", on ? "bg-[var(--c-secondary)] text-[var(--c-primary)]" : "text-[#52525b] hover:bg-[#f4f4f5]")}>
              <span className={on ? "text-[var(--c-primary)]" : "text-[#3f3f46]"}>{icon}</span>{label}
            </button>
          );
        })}
      </nav>
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setCollapsed(true)} aria-hidden />}
      <aside className={cx("border-[#e5e5e7] bg-white", open ? "fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 max-h-[78dvh] overflow-y-auto rounded-t-[16px] p-4 shadow-[0_-8px_24px_rgb(0_0_0/0.12)] md:static md:z-auto md:order-1 md:block md:max-h-none md:w-[380px] md:shrink-0 md:rounded-none md:border-r md:p-4 md:shadow-none" : "hidden")}>
       <div className="space-y-5">
        <div className="flex items-center justify-between md:hidden"><p className="text-[15px] font-semibold">{title}</p><button type="button" onClick={() => setCollapsed(true)} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#f4f4f5]"><X size={16} /></button></div>
        {p.tab === "mau" && p.templateTab}
        {p.tab === "anh" && (
          <>
            <button type="button" onClick={() => (doc ? st.setAddSlotOpen(true) : toast("Tải ảnh và chọn mẫu trước khi thêm khung ảnh.", "err"))}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--c-primary)] text-[14px] font-semibold text-white hover:bg-[var(--c-primary-hover)]">+ Thêm khung ảnh</button>
            {mode === "template" && <p className="text-[12px] text-[#71717a]">Chọn 1 ô ảnh trên bề mặt để đổi khung hoặc xoá ô. Số ảnh của ô sửa ở khối “Thuộc tính” bên dưới.</p>}
            {p.photoTab}
          </>
        )}
        {p.tab === "sticker" && (
          <StickerTab assets={p.assets} groups={p.assetGroups} onAdd={(a) => { st.addAsset(a); window.dispatchEvent(new Event("scrap-close-panel")); }} mine={st.ustickers.map((s) => ({ id: s.id, url: s.url }))}
            onUpload={(f) => st.setStickerFiles(f)} onAddMine={mode === "customer" ? (id) => { st.addAsset(`u:${id}`); window.dispatchEvent(new Event("scrap-close-panel")); } : undefined} onRemoveMine={st.removeUserSticker}
            onSaveMine={mode === "template" ? (id) => setSaveMine(id) : undefined} mineTitle={mode === "template" ? "Sticker vừa tách (chưa vào thư viện)" : "Sticker của tôi"} />
        )}
        {p.tab === "chu" && (
          <TextTab layer={st.sel !== null && st.isTextLayer(st.L[st.sel]) ? st.L[st.sel] : null} fonts={p.fonts} previews={st.fontPreviews} colors={st.colors} onCustomColor={st.addColor}
            onPaper={(v) => { if (st.sel === null) return; if (v === "none") st.wishToText(st.sel); else st.textToWish(st.sel, v); }} onAdd={() => { st.addText(); window.dispatchEvent(new Event("scrap-close-panel")); }}
            onPatch={(v) => { if (st.sel !== null) st.patchLayer(st.sel, v); }} onBegin={st.D.begin} onDuplicate={() => { if (st.sel !== null) st.duplicate(st.sel); }} onRemove={() => { if (st.sel !== null) st.removeLayer(st.sel); }}
            topics={T} wishes={W} onWish={(c) => { st.addWish(c); window.dispatchEvent(new Event("scrap-close-panel")); }} wishOpen={st.wishOpen} onWishOpen={st.setWishOpen} />
        )}
        {p.tab === "nen" && <BgTab t={cur} assets={p.assets} bgImages={bgPreview} onSet={st.setBg} onUpload={st.uploadBg} />}
       </div>
      </aside>

      {/* ---------- giữa: bề mặt ---------- */}
      <section onPointerDown={deselectOutside} className="relative order-1 flex min-w-0 flex-1 flex-col md:order-2 md:min-h-0">
        {/* máy tính: thanh công cụ ẢNH ở đầu khu làm việc (chọn 1 ảnh) — bỏ chọn thì ẩn */}
        {photoBar && <div className="hidden justify-center px-3 pt-2 md:flex"><div data-keep-sel className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-[var(--c-secondary)] p-1 shadow-sm">{photoBar}</div></div>}
        {(p.onRestore || p.toolbar || !p.header) && (
          <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
            {p.onRestore && <button type="button" onClick={p.onRestore} disabled={!p.canRestore} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#e5e5e7] bg-white px-2.5 text-[12px] font-medium disabled:opacity-40"><RotateCcw size={12} /> Khôi phục mẫu</button>}
            {p.toolbar}
            <span className="flex-1" />
            {!p.header && <Toggle checked={p.guides} onChange={p.setGuides} label="Guideline" />}
          </div>
        )}
        {/* điện thoại: khu xem cao cố định = màn hình − header − khung menu − dải trang / zoom (cố định dưới đáy) */}
        <div className={cx("relative flex min-h-[220px] flex-1 flex-col max-md:flex-none md:min-h-0", multi ? "max-md:h-[calc(100dvh-56px-176px-env(safe-area-inset-bottom))]" : "max-md:h-[calc(100dvh-56px-136px-env(safe-area-inset-bottom))]")}>
        <div ref={area} className="flex min-h-0 flex-1 touch-none overflow-auto px-2 py-1">
         <div className="m-auto">
          {p.overlay ?? (!cur ? p.empty : st.ready && (
            <SurfaceView key={st.active} t={cur} width={width} render={ro} guides={p.guides} sel={st.sel} onSel={st.setSel} editLayer={st.editLayer} onEditLayer={st.setEditLayer}
              begin={st.D.begin} setLayers={st.setLayers} adjustOf={(id) => st.adjust[id]} setAdjust={(id, a) => st.setAdjust((c) => ({ ...c, [id]: a }))}
              onDropAsset={(id, at) => { if (id.startsWith("u:") && mode === "template") return; if (id.startsWith("u:") || id.startsWith("f:")) st.addAsset(id, at); else { const a = p.assets.find((x) => x.id === id); if (a) st.addAsset(a, at); } }}
              onDropFreePhoto={mode === "customer" ? (pid, at) => st.addAsset(`p:${pid}`, at) : undefined}
              onDropFiles={(f, at) => { if (mode === "customer") st.insertImages(f, at); else st.setStickerFiles(f.slice(0, 1)); }}
              onDropPhoto={mode === "customer" ? (pid, i) => st.assignPhoto(st.active, i, pid) : undefined} onEmptySlot={mode === "customer" ? (i) => st.setPickFor(i) : undefined}
              editText={st.editText} onEditText={(i) => st.setEditText(i)} selectAllText={st.selectAll} textValue={st.textValue} onTextValue={st.setTextValue}
              onBackgroundDbl={p.onBackgroundDbl} tools={st.tools} scanning={st.cutting} cropLayer={st.cropFor} onCrop={st.setCropFor}
              onViewZoom={(f) => setZoom((z) => Math.min(4, Math.max(0.25, z * f)))} onViewPan={(dx, dy) => area.current?.scrollBy(-dx, -dy)}
              bgEdit={!!st.bgEdit} onBgEdit={(on, right) => st.setBgEdit(on ? (right ? "bg2" : "bg") : null)}
              onBgMove={(dx, dy, start) => { if (start) { st.D.begin(); return; } st.patchBg({ ix: (st.curBg?.ix ?? 0) + dx, iy: (st.curBg?.iy ?? 0) + dy }); }}
              onBgZoom={(f) => st.patchBg({ iz: Math.min(4, Math.max(0.5, (st.curBg?.iz ?? 1) * f)) })}
              bgBar={st.bgEdit && st.curBg ? <BgEditBar bg={st.curBg} onBegin={st.D.begin} onPatch={st.patchBg} onDetach={st.detachBg} onDone={() => st.setBgEdit(null)}
                onUpload={async (f) => { try { const key = await st.uploadBg(f); st.D.begin(); st.patchBg({ image: key, ix: undefined, iy: undefined, iz: undefined }); } catch (e) { toast(e instanceof Error ? e.message : "Tải ảnh lỗi", "err"); } }} /> : null} />
          ))}
         </div>
        </div>
        {!p.overlay && cur && (
          <div data-keep-sel className="absolute bottom-2 right-3 z-10 flex items-center gap-0.5 rounded-full border border-[#e5e5e7] bg-white/95 p-0.5 text-[12px] shadow-sm max-md:hidden">
            <button type="button" onClick={() => setZoom((z) => clampZ(z - 0.1))} disabled={zoom <= 0.25} title="Thu nhỏ" aria-label="Thu nhỏ" className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#f4f4f5] disabled:opacity-40"><Minus size={14} /></button>
            <span className="w-11 text-center tabular-nums text-[#3f3f46]">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => clampZ(z + 0.1))} disabled={zoom >= 4} title="Phóng to" aria-label="Phóng to" className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#f4f4f5] disabled:opacity-40"><Plus size={14} /></button>
            <button type="button" onClick={() => setZoom(1)} title="Vừa màn hình" aria-label="Vừa màn hình" className={cx("grid h-7 w-7 place-items-center rounded-full hover:bg-[#f4f4f5]", zoom === 1 && "text-[var(--c-primary)]")}><Maximize size={13} /></button>
          </div>
        )}
        </div>
        {/* điện thoại: dải trang (xem trước) + zoom cố định ngay trên khung menu cuối trang */}
        {cur && !p.overlay && (
          <div data-keep-sel className="fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 flex items-end gap-2 md:hidden">
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {multi && doc!.map((sf, i) => (
                <button key={i} type="button" onClick={() => go(i)} title={p.pageLabel?.(i, count)}
                  className={cx("h-14 shrink-0 overflow-hidden rounded-[4px] border bg-white p-px shadow-sm", sf.surface === "spread" ? "w-28" : sf.surface === "back" ? "w-[72px]" : "w-14", i === st.active ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/25" : "border-[#e5e5e7]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[i] ? <img src={thumbs[i]} alt="" className="block h-full w-full object-contain" /> : <span className="block h-full w-full bg-[#ececef]" />}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#e5e5e7] bg-white/95 p-0.5 text-[12px] shadow-sm">
              <button type="button" onClick={() => setZoom((z) => clampZ(z - 0.1))} disabled={zoom <= 0.25} aria-label="Thu nhỏ" className="grid h-8 w-8 place-items-center rounded-full disabled:opacity-40"><Minus size={14} /></button>
              <span className="w-10 text-center tabular-nums text-[#3f3f46]">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => clampZ(z + 0.1))} disabled={zoom >= 4} aria-label="Phóng to" className="grid h-8 w-8 place-items-center rounded-full disabled:opacity-40"><Plus size={14} /></button>
              <button type="button" onClick={() => setZoom(1)} aria-label="Vừa màn hình" className={cx("grid h-8 w-8 place-items-center rounded-full", zoom === 1 && "text-[var(--c-primary)]")}><Maximize size={13} /></button>
            </div>
          </div>
        )}
        {doc && count > 1 && !p.overlay && (
          <div className="px-3 max-md:hidden">
            <div className="flex items-center justify-center gap-1.5">
              <button type="button" onClick={() => go(st.active - 1)} disabled={st.active === 0} aria-label="Trang trước" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="min-w-[96px] text-center text-[12px] tabular-nums text-[#3f3f46]">{p.pageLabel?.(st.active, count) ?? `${st.active + 1} / ${count}`}</span>
              <button type="button" onClick={() => go(st.active + 1)} disabled={st.active >= count - 1} aria-label="Trang sau" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
            {/* các trang: 1 hàng ngang (cuộn ngang khi nhiều), mỗi ô = 1 trang đơn hoặc 1 cặp trang, ảnh nằm gọn trong ô */}
            <div className="no-scrollbar mt-1 flex justify-center gap-1.5 overflow-x-auto pb-1">
              {doc.map((s, i) => (
                <button key={i} type="button" onClick={() => go(i)} title={p.pageLabel?.(i, count)}
                  className={cx("h-16 shrink-0 overflow-hidden rounded-[4px] border bg-white p-px", s.surface === "spread" ? "w-32" : s.surface === "back" ? "w-20" : "w-16", i === st.active ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/25" : "border-[#e5e5e7] hover:border-[#a1a1aa]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[i] ? <img src={thumbs[i]} alt="" className="block h-full w-full object-contain" /> : <span className="block h-full w-full bg-[#ececef]" />}
                </button>
              ))}
            </div>
          </div>
        )}
        {p.bottom}
      </section>

      {/* ---------- phải (mode template): panel admin ---------- */}
      {p.right && <aside className="order-3 w-full shrink-0 space-y-5 overflow-y-auto border-l border-[#e5e5e7] bg-white p-4 md:w-[300px]">{p.right}</aside>}
     </div>
      {mode === "customer" && st.pickFor !== null && (
        <PickPhotoModal photos={st.photos} used={st.used} onClose={() => st.setPickFor(null)}
          onPick={(pid) => { st.assignPhoto(st.active, st.pickFor!, pid); st.setPickFor(null); }}
          onUpload={async (f) => { const i = st.pickFor!; const [ph] = await st.addFiles([f]); if (ph) st.assignPhoto(st.active, i, ph.id); st.setPickFor(null); }} />
      )}
      {st.frameFor !== null && st.L[st.frameFor]?.k === "photo" && (
        <FramePicker frames={p.frames} sets={p.frameSets} loaded={st.frameImgs} title="Đổi khung" current={(st.L[st.frameFor] as { frame?: string }).frame ?? null} onPick={(c) => st.setFrame(st.frameFor!, c)} onClose={() => st.setFrameFor(null)} />
      )}
      {st.addSlotOpen && (
        <AddFrameFlow frames={p.frames} sets={p.frameSets} loaded={st.frameImgs} photos={p.framePhotos ?? st.photos} used={mode === "customer" ? st.used : new Set()} onClose={() => st.setAddSlotOpen(false)}
          onDone={(c, pid) => { st.addSlot(c, pid); window.dispatchEvent(new Event("scrap-close-panel")); }} onUpload={async (f) => { if (mode === "template") return null; const [ph] = await st.addFiles([f]); return ph?.id ?? null; }} />
      )}
      {st.stickerFiles && FEATURE_OLD_STICKER_UPLOAD && <UserStickerModal files={st.stickerFiles} onAdd={(b) => st.addUserSticker(b)} onClose={() => st.setStickerFiles(null)} />}
      {st.stickerFiles && !FEATURE_OLD_STICKER_UPLOAD && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-3" role="dialog" aria-modal>
          <div className="flex max-h-[94dvh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#efeff1] px-4 py-3">
              <p className="min-w-0 flex-1 text-[15px] font-semibold">Tải sticker của bạn</p>
              <button type="button" onClick={() => st.setStickerFiles(null)} className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <SheetSlicer initial={st.stickerFiles[0]} customer={async (blobs) => {
                for (const b of blobs) await st.addUserSticker(b, false);
                st.setStickerFiles(null); p.setTab("sticker");
                toast(`Đã thêm ${blobs.length} sticker vào “${mode === "template" ? "Sticker vừa tách" : "Sticker của tôi"}”`);
              }} />
            </div>
          </div>
        </div>
      )}
      {st.bgFor !== null && (() => {
        const l = st.L[st.bgFor], ph = l?.k === "sticker" && l.asset?.startsWith("p:") ? st.photos.find((x) => x.id === l.asset!.slice(2)) : undefined;
        if (!ph) return null;
        const i = st.bgFor;
        return <UserStickerModal files={[new File([ph.blob], ph.name || "anh.png", { type: ph.blob.type || "image/png" })]} initialBorder="none" okLabel="Áp dụng xoá nền"
          onAdd={(png) => { st.applyBgRemoved(i, png); }} onClose={() => st.setBgFor(null)} />;
      })()}
      {saveMine && <SaveToLibrary sticker={st.ustickers.find((x) => x.id === saveMine) ?? null} groups={p.assetGroups ?? []} onClose={() => setSaveMine(null)} onSaved={(id) => { st.removeUserSticker(id); setSaveMine(null); }} />}
    </div>
  );
}

/** Trình sửa mẫu (admin): "Lưu vào thư viện" 1 sticker vừa tách → Quản lý chất liệu (chọn Nhóm, Tags) */
function SaveToLibrary({ sticker, groups, onClose, onSaved }: { sticker: { id: string; blob: Blob; img: HTMLCanvasElement } | null; groups: AssetGroupRow[]; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState("Sticker mới");
  const [group, setGroup] = useState<string>("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  if (!sticker) return null;
  async function save() {
    if (!sticker) return;
    setBusy(true);
    try {
      const url = (await uploadFile("scrapbook", sticker.blob, { folder: "sticker", contentType: "image/png" })).url!;
      const thumb = await uploadAssetThumb(sticker.img).catch(() => null);
      const { error } = await createClient().from("scrapbook_assets").insert({ name: name.trim() || "Sticker", grp: "sticker", asset_type: "sticker", group_id: group || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean), tone: "any", url, thumb_url: thumb, sort_order: Date.now() % 1e6 });
      if (error) throw new Error(error.message);
      toast("Đã lưu vào thư viện — tải lại trang để dùng trong mẫu"); onSaved(sticker.id);
    } catch (e) { toast(e instanceof Error ? e.message : "Lưu thất bại", "err"); }
    setBusy(false);
  }
  const inp = "h-9 w-full rounded-[8px] border border-[#e5e5e7] px-2.5 text-[13px] outline-none focus:border-[var(--c-primary)]";
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="w-full max-w-[380px] space-y-3 rounded-[14px] bg-white p-5 shadow-xl">
        <p className="text-[15px] font-semibold">Lưu vào thư viện chất liệu</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="grid h-28 place-items-center rounded-[8px] bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]"><img src={sticker.img.toDataURL("image/png")} alt="" className="max-h-24 max-w-full object-contain" /></div>
        <label className="block text-[12px]"><span className="mb-1 block font-medium">Tên</span><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></label>
        <label className="block text-[12px]"><span className="mb-1 block font-medium">Nhóm</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={inp}><option value="">— Theo loại (Sticker) —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        <label className="block text-[12px]"><span className="mb-1 block font-medium">Tags (cách nhau dấu phẩy)</span><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vd. hoa, cute" className={inp} /></label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 rounded-[8px] border border-[#e5e5e7] px-3 text-[13px] font-medium">Huỷ</button>
          <button type="button" onClick={save} disabled={busy} className="h-9 rounded-[8px] bg-[var(--c-primary)] px-3 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "Đang lưu..." : "Lưu vào thư viện"}</button>
        </div>
      </div>
    </div>
  );
}

