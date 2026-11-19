"use client";

/* Trình chỉnh scrapbook DÙNG CHUNG cho khách (CD Template, Booklet Template — mode "customer") và trình sửa mẫu
   của admin (mode "template"). Trái: tab Ảnh · Sticker · Chữ · Nền. Giữa: bề mặt đang xem (đĩa / trang / cặp trang)
   — chọn lớp, kéo, phóng / thu, xoay, menu chuột phải, phím tắt, hoàn tác / làm lại, đường gióng, sửa chữ trực tiếp;
   nhiều bề mặt (booklet) thì có thanh chuyển trang + thumbnail. Phải (mode template): panel admin truyền vào.
   Mọi logic dùng chung nằm ở useScrapStudio; component này chỉ ghép giao diện. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, LayoutTemplate, PaintBucket, Redo2, RotateCcw, Smile, Type, Undo2, X } from "lucide-react";
import { renderSurface, type RenderOpts } from "@/lib/scrapbook/render";
import { surfaceOf } from "@/lib/scrapbook/surface";
import type { CutoutFont } from "@/lib/scrapbook/cutout";
import type { Frame, FrameSet, ScrapAsset, Wish, WishTopic } from "@/lib/scrapbook/types";
import { Toggle, toast } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";
import { StickerTab } from "./StickerTab";
import { TextTab } from "./TextTab";
import { BgTab } from "./BgTab";
import { SurfaceView } from "./SurfaceView";
import { AddFrameFlow, FramePicker } from "./FramePicker";
import { PickPhotoModal } from "./parts";
import { UserStickerModal } from "./UserStickerModal";
import type { useScrapStudio } from "./useScrapStudio";

export type EditorTab = "mau" | "anh" | "sticker" | "chu" | "nen";
type Studio = ReturnType<typeof useScrapStudio>;

export function ScrapbookEditor(p: {
  mode: "customer" | "template";
  st: Studio; assets: ScrapAsset[]; frames: Frame[]; frameSets: FrameSet[]; fonts: CutoutFont[]; topics: WishTopic[]; wishes: Wish[];
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
}) {
  const { st, mode } = p;
  const ro = p.render ?? st.renderOpts;
  const doc = st.doc, cur = st.cur, count = doc?.length ?? 0;
  const T = p.topics, W = p.wishes;

  // chọn 1 lớp chữ trên bề mặt → mở tab Chữ (hiện Cài đặt chữ)
  useEffect(() => { if (st.sel !== null && st.isTextLayer(st.L[st.sel])) p.setTab("chu"); }, [st.sel]); // eslint-disable-line react-hooks/exhaustive-deps
  // cột công cụ kiểu Canva: bấm lại mục đang mở → thu gọn panel (khu làm việc rộng hơn)
  const [collapsed, setCollapsed] = useState(false);
  const switchTab = (id: EditorTab) => {
    if (id === p.tab && !collapsed) { setCollapsed(true); return; }
    setCollapsed(false); p.setTab(id);
    if (id !== "chu" && st.sel !== null && st.isTextLayer(st.L[st.sel])) { st.setEditText(null); st.setSel(null); }
  };
  useEffect(() => { if (st.sel !== null && st.isTextLayer(st.L[st.sel])) setCollapsed(false); }, [st.sel]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const width = Math.max(160, Math.floor(S.round ? Math.min(box.w, box.h) * 0.96 : Math.min(box.w * 0.92, box.h * 0.85 * (S.w / S.h))));
  // thumbnail các bề mặt (booklet)
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    if (!doc || doc.length < 2) return;
    const t = setTimeout(() => setThumbs(doc.map((s) => renderSurface({ template: s, ...ro, size: s.surface === "spread" ? 96 : 48 }).canvas.toDataURL("image/jpeg", 0.8))), 400);
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
  const RAIL: [EditorTab, string, React.ReactNode][] = [
    ...(p.templateTab ? [["mau", "Mẫu", <LayoutTemplate key="m" size={20} />] as [EditorTab, string, React.ReactNode]] : []),
    ["anh", "Ảnh", <ImageIcon key="a" size={20} />], ["sticker", "Sticker", <Smile key="s" size={20} />], ["chu", "Chữ", <Type key="c" size={20} />], ["nen", "Nền", <PaintBucket key="n" size={20} />],
  ];
  const open = !collapsed;
  const title = RAIL.find((x) => x[0] === p.tab)?.[1];
  return (
    <div data-fit-screen className="flex flex-1 flex-col bg-[#f7f7f8] md:min-h-0">
     <div className={cx("flex w-full flex-1 flex-col md:min-h-0 md:flex-row", p.maxW)}>
      {/* ---------- trái: cột công cụ dọc (máy tính) / thanh ngang dưới đáy (điện thoại) + panel nội dung ---------- */}
      <nav aria-label="Công cụ" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#e5e5e7] bg-white pb-[env(safe-area-inset-bottom)] md:static md:z-auto md:order-1 md:w-[72px] md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-t-0 md:py-2">
        {RAIL.map(([id, label, icon]) => {
          const on = p.tab === id && open;
          return (
            <button key={id} type="button" onClick={() => switchTab(id)} aria-pressed={on}
              className={cx("flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium md:mx-1.5 md:flex-none md:rounded-[10px] md:py-2.5", on ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:bg-[#f4f4f5]")}>
              <span className={on ? "text-[#ff5fa2]" : "text-[#3f3f46]"}>{icon}</span>{label}
            </button>
          );
        })}
      </nav>
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setCollapsed(true)} aria-hidden />}
      <aside className={cx("border-[#e5e5e7] bg-white", open ? "fixed inset-x-0 bottom-[58px] z-40 max-h-[62dvh] overflow-y-auto rounded-t-[16px] p-4 shadow-[0_-8px_24px_rgb(0_0_0/0.12)] md:static md:z-auto md:order-1 md:block md:max-h-none md:w-[320px] md:shrink-0 md:rounded-none md:border-r md:p-4 md:shadow-none" : "hidden")}>
       <div className="space-y-5">
        <div className="flex items-center justify-between md:hidden"><p className="text-[15px] font-semibold">{title}</p><button type="button" onClick={() => setCollapsed(true)} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#f4f4f5]"><X size={16} /></button></div>
        {p.tab === "mau" && p.templateTab}
        {p.tab === "anh" && (
          <>
            <button type="button" onClick={() => (doc ? st.setAddSlotOpen(true) : toast("Tải ảnh và chọn mẫu trước khi thêm khung ảnh.", "err"))}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#ff5fa2] text-[14px] font-semibold text-white hover:bg-[#f0468f]">+ Thêm khung ảnh</button>
            {mode === "template" && <p className="text-[12px] text-[#71717a]">Chọn 1 ô ảnh trên bề mặt để đổi khung hoặc xoá ô. Số ảnh của ô sửa ở panel bên phải.</p>}
            {p.photoTab}
          </>
        )}
        {p.tab === "sticker" && (
          <StickerTab assets={p.assets} onAdd={(a) => st.addAsset(a)} mine={mode === "customer" ? st.ustickers.map((s) => ({ id: s.id, url: s.url })) : []}
            onUpload={mode === "customer" ? (f) => st.setStickerFiles(f) : undefined} onAddMine={(id) => st.addAsset(`u:${id}`)} onRemoveMine={st.removeUserSticker} />
        )}
        {p.tab === "chu" && (
          <TextTab layer={st.sel !== null && st.isTextLayer(st.L[st.sel]) ? st.L[st.sel] : null} fonts={p.fonts} previews={st.fontPreviews} colors={st.colors} onCustomColor={st.addColor}
            onPaper={() => { if (st.sel !== null) st.wishToText(st.sel); }} onAdd={() => st.addText()}
            onPatch={(v) => { if (st.sel !== null) st.patchLayer(st.sel, v); }} onBegin={st.D.begin} onDuplicate={() => { if (st.sel !== null) st.duplicate(st.sel); }} onRemove={() => { if (st.sel !== null) st.removeLayer(st.sel); }}
            topics={T} wishes={W} onWish={st.addWish} wishOpen={st.wishOpen} onWishOpen={st.setWishOpen} />
        )}
        {p.tab === "nen" && <BgTab t={cur} assets={p.assets} bgImages={bgPreview} onSet={st.setBg} onUpload={st.uploadBg} />}
       </div>
      </aside>

      {/* ---------- giữa: bề mặt ---------- */}
      <section onPointerDown={deselectOutside} className="relative order-1 flex min-h-[460px] min-w-0 flex-1 flex-col pb-[58px] md:order-2 md:min-h-0 md:pb-0">
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
          <button type="button" onClick={() => { if (st.D.undo()) st.setSel(null); }} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!st.D.canUndo}><Undo2 size={13} /></button>
          <button type="button" onClick={() => { if (st.D.redo()) st.setSel(null); }} title="Làm lại (Ctrl+Shift+Z)" aria-label="Làm lại" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40" disabled={!st.D.canRedo}><Redo2 size={13} /></button>
          {p.onRestore && <button type="button" onClick={p.onRestore} disabled={!p.canRestore} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#e5e5e7] bg-white px-2.5 text-[12px] font-medium disabled:opacity-40"><RotateCcw size={12} /> Khôi phục mẫu</button>}
          {p.toolbar}
          <span className="flex-1" />
          <Toggle checked={p.guides} onChange={p.setGuides} label="Guideline" />
        </div>
        <div ref={area} className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden px-2 py-1">
          {p.overlay ?? (!cur ? p.empty : st.ready && (
            <SurfaceView key={st.active} t={cur} width={width} render={ro} guides={p.guides} sel={st.sel} onSel={st.setSel} editLayer={st.editLayer} onEditLayer={st.setEditLayer}
              begin={st.D.begin} setLayers={st.setLayers} adjustOf={(id) => st.adjust[id]} setAdjust={(id, a) => st.setAdjust((c) => ({ ...c, [id]: a }))}
              onDropAsset={(id, at) => { if (id.startsWith("u:") || id.startsWith("f:")) st.addAsset(id, at); else { const a = p.assets.find((x) => x.id === id); if (a) st.addAsset(a, at); } }}
              onDropPhoto={mode === "customer" ? (pid, i) => st.assignPhoto(st.active, i, pid) : undefined} onEmptySlot={mode === "customer" ? (i) => st.setPickFor(i) : undefined}
              editText={st.editText} onEditText={(i) => st.setEditText(i)} selectAllText={st.selectAll} textValue={st.textValue} onTextValue={st.setTextValue}
              onBackgroundDbl={p.onBackgroundDbl} tools={st.tools} />
          ))}
        </div>
        {doc && count > 1 && !p.overlay && (
          <div className="px-3">
            <div className="flex items-center justify-center gap-1.5">
              <button type="button" onClick={() => go(st.active - 1)} disabled={st.active === 0} aria-label="Trang trước" className="grid h-7 w-7 place-items-center rounded-full border border-[#e5e5e7] bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="min-w-[96px] text-center text-[12px] tabular-nums text-[#3f3f46]">{p.pageLabel?.(st.active, count) ?? `${st.active + 1} / ${count}`}</span>
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
          onDone={(c, pid) => st.addSlot(c, pid)} onUpload={async (f) => { if (mode === "template") return null; const [ph] = await st.addFiles([f]); return ph?.id ?? null; }} />
      )}
      {st.stickerFiles && <UserStickerModal files={st.stickerFiles} onAdd={(b) => st.addUserSticker(b)} onClose={() => st.setStickerFiles(null)} />}
    </div>
  );
}
