"use client";

/* Trình sửa mẫu CỐ ĐỊNH của admin (/admin/thiet-ke/template/sua?tpl=<id> — bảng design_templates: CD Template · Trang đơn ·
   Trang đôi) = trình chỉnh dùng chung ScrapbookEditor ở mode "template" (cột công cụ Ảnh · Sticker · Chữ · Nền như khách).
   Mục "Ảnh" có thêm các khối thu gọn được của admin: Ảnh thử · Thuộc tính (X, Y, W, H, góc xoay mm, số ảnh của ô,
   "Ngẫu nhiên từ bộ khung…") · Lớp (đổi thứ tự, ẩn / hiện, khoá). Thanh trên: tên mẫu, "Rải sticker tự động" (+ bánh răng
   Cài đặt rải sticker), Khôi phục bản đã lưu, Lưu mẫu (tự tạo ảnh thu nhỏ bằng ảnh thử). */
import { FEATURE_AUTO_STICKERS } from "@/lib/features";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/pangolin/400.css";
import "@fontsource/itim/400.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/700.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/700.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Dices, Eye, EyeOff, ImagePlus, Lock, RotateCcw, Save, Settings, Sparkles, Unlock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { uploadScrapbookAsset } from "@/lib/upload";
import { deleteFiles } from "@/lib/storage/client";
import { autoDecorate } from "@/lib/scrapbook/generate";
import { mergeStickerCfg, setFrameLibrary, setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { boxOf } from "@/lib/scrapbook/edit";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import { normAsset } from "@/lib/scrapbook/assetGroups";
import { KIND_INFO, TPL_COLS, slotCount, type DesignTpl } from "@/lib/scrapbook/library";
import { uploadThumb } from "@/lib/scrapbook/libraryClient";
import { buildCdDoc } from "@/lib/scrapbook/toCdDoc";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import type { AssetGroupRow, Frame, FrameSet, Layer, ScrapAsset, Template, Wish, WishTopic } from "@/lib/scrapbook/types";
import { ScrapbookEditor, type EditorTab } from "@/components/scrapbook/ScrapbookEditor";
import { customizeText, useScrapStudio } from "@/components/scrapbook/useScrapStudio";
import { shapeName } from "@/components/scrapbook/FramePicker";
import { Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { StickerSettings } from "../../../scrapbook/mau/StickerSettings";
import { Modal } from "../CategoryManager";
import { PUBLIC_PATHS } from "../LibraryAdmin";

type Img = HTMLCanvasElement;
type Lib = { groups: AssetGroupRow[]; assets: ScrapAsset[]; frames: Frame[]; sets: FrameSet[]; fonts: CutoutFont[]; glyphs: Glyph[]; topics: WishTopic[]; wishes: Wish[]; cfg: StickerCfg; cfgKey: string };
const r1 = (v: number) => Math.round(v * 10) / 10;
const SHAPE_VI: Record<string, string> = { star: "Ngôi sao", heart: "Trái tim", flower: "Bông hoa", bow: "Nơ", sparkle: "Lấp lánh", arrow: "Mũi tên", swirl: "Xoắn", dash: "Vòng nét đứt", note: "Giấy note", grid: "Giấy kẻ ô", ticket: "Vé", kraft: "Giấy kraft" };
const TEXT0 = { main: "Happy Birthday", sub: "" };
const EMPTY = {};

export function TemplateEditor() {
  const id = useSearchParams().get("tpl");
  const [row, setRow] = useState<DesignTpl | null>(null);
  const [lib, setLib] = useState<Lib | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!id) { setErr("Thiếu mã mẫu — mở mẫu từ trang Quản lý template."); return; }
    (async () => {
      const sb = createClient();
      const t = await sb.from("design_templates").select(TPL_COLS).eq("id", id).maybeSingle();
      if (t.error || !t.data) { setErr(t.error ? "Chưa có bảng mẫu mới — cần chạy supabase/migration_design_library.sql." : "Không tìm thấy mẫu."); return; }
      const tpl = t.data as unknown as DesignTpl, cfgKey = tpl.kind === "cd" ? "scrap_stickers" : "scrap_stickers_booklet";
      const [a, fs, fr, cf, wt, w, sc, sc0, ag] = await Promise.all([
        sb.from("scrapbook_assets").select("*").eq("is_active", true).order("grp").order("sort_order"),
        sb.from("frame_sets").select("*").eq("is_active", true).order("sort_order"), sb.from("frames").select("*").eq("is_active", true).order("sort_order"),
        sb.from("cutout_fonts").select("*").eq("is_active", true).order("sort_order"),
        sb.from("wish_topics").select("*").eq("is_active", true).order("sort_order"), sb.from("wishes").select("*").eq("is_active", true).order("sort_order"),
        sb.from("site_settings").select("value").eq("key", cfgKey).maybeSingle(), sb.from("site_settings").select("value").eq("key", "scrap_stickers").maybeSingle(),
        sb.from("asset_groups").select("*").order("sort_order"),
      ]);
      const cfg = mergeStickerCfg(((sc.data?.value ?? sc0.data?.value) as Partial<StickerCfg>) ?? null);
      setStickerConfig(cfg);
      const sets = (fs.data ?? []) as FrameSet[], fonts = (cf.data ?? []) as CutoutFont[];
      setFrameLibrary(sets);
      const g = fonts.length ? await sb.from("cutout_glyphs").select("*").in("font_id", fonts.map((x) => x.id)).order("sort_order") : { data: [] };
      const frames = ((fr.data ?? []) as Frame[]).filter((f) => sets.some((s) => s.id === f.set_id));
      setLib({ groups: (ag.data ?? []) as AssetGroupRow[], assets: ((a.data ?? []) as ScrapAsset[]).map(normAsset).filter((x) => x.grp !== "frame" || !frames.length), frames, sets, fonts, glyphs: (g.data ?? []) as Glyph[],
        topics: ((wt.data ?? []) as WishTopic[]).length ? (wt.data as WishTopic[]) : DEFAULT_TOPICS, wishes: ((w.data ?? []) as Wish[]).length ? (w.data as Wish[]) : DEFAULT_WISHES, cfg, cfgKey });
      setRow(tpl);
    })();
  }, [id]);
  if (err) return <p className="p-6 text-[13px] text-[#dc2626]">{err}</p>;
  if (!lib || !row) return <p className="p-6 text-[13px] text-[#71717a]">Đang tải trình sửa mẫu...</p>;
  return <Workbench row={row} lib={lib} />;
}

function Workbench({ row: row0, lib: lib0 }: { row: DesignTpl; lib: Lib }) {
  const [row, setRow] = useState(row0);
  const [lib, setLib] = useState(lib0);
  const [samples, setSamples] = useState<Img[]>(() => samplePhotos());
  const [tab, setTab] = useState<EditorTab>("anh");
  const [guides, setGuides] = useState(true);
  const [name, setName] = useState(row0.name);
  const [original, setOriginal] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [gear, setGear] = useState(false);
  const photoIn = useRef<HTMLInputElement>(null);
  const st = useScrapStudio({
    prefix: "tpl", max: 0, assets: lib.assets, frames: lib.frames, fonts: lib.fonts, glyphs: lib.glyphs, defaultText: TEXT0, extra: EMPTY, onLoad: () => undefined,
    wantAllFonts: tab === "chu", persist: false, template: true, slotPhotos: samples, uploadBg: uploadScrapbookAsset,
  });
  const framePhotos = useMemo(() => samples.map((c, i) => ({ id: `s${i}`, url: c.toDataURL("image/jpeg", 0.6) })), [samples]);

  // ---------- nạp mẫu ----------
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!st.ready || loaded) return;
    const t = customizeText(structuredClone(row.config.template), TEXT0); // chữ của mẫu = lớp chữ bình thường
    setOriginal(structuredClone(t));
    st.D.setDoc([t]); st.D.reset(); st.setActive(0);
    setLoaded(true);
  }, [st.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /** lớp "tự rải" thành lớp bình thường khi lưu; ô ảnh không mang ảnh thử */
  const clean = (t: Template): Template => ({ ...t, layers: t.layers.map((l) => { const { auto: _a, ...rest } = l as Layer & { auto?: boolean }; void _a; return (rest.k === "photo" ? { ...rest, photo: undefined } : rest) as Layer; }) });
  async function save() {
    const t = st.doc?.[0];
    if (!t) return;
    setSaving(true);
    try {
      const template = clean(t);
      const thumb = await uploadThumb([template], { ...st.renderOpts, photos: samples }).catch(() => null);
      // mặt đĩa / trang đơn: kèm bản cho trình "Thiết kế CD" (bìa trước, trang booklet, mặt đĩa)
      const cdDoc = row.kind === "booklet_spread" || row.kind === "back" ? undefined : await buildCdDoc(template, st.renderOpts).catch(() => row.config.cdDoc);
      const v = { name: name.trim() || "Mẫu mới", config: { ...row.config, template, ...(cdDoc ? { cdDoc } : {}) }, photo_count: slotCount(template), thumbnail_url: thumb ?? row.thumbnail_url, updated_at: new Date().toISOString() };
      const { error } = await createClient().from("design_templates").update(v).eq("id", row.id);
      if (error) throw new Error(error.message);
      if (thumb && row.thumbnail_url && row.thumbnail_url !== thumb) deleteFiles({ urls: [row.thumbnail_url] }).catch(() => 0);
      setRow({ ...row, ...v }); setOriginal(structuredClone(t)); st.D.setEdited(false);
      await revalidatePublic(PUBLIC_PATHS);
      toast("Đã lưu mẫu");
    } catch (e) { toast(e instanceof Error ? e.message : "Lưu thất bại", "err"); }
    setSaving(false);
  }
  function restore() { if (original) { st.D.begin(); st.D.setDoc([structuredClone(original)]); st.setSel(null); toast("Đã khôi phục bản đã lưu"); } }
  function decorate() {
    if (!st.cur) return;
    st.D.begin(); st.D.patchSurface(0, (t) => autoDecorate(t, Math.floor(Math.random() * 1e6), lib.assets)); st.setSel(null);
    toast("Đã rải sticker — bấm lại để rải kiểu khác, sticker sửa / xoá được như lớp bình thường");
  }

  const L = st.L, sel = st.sel, cur = st.cur;
  const layer = sel !== null ? L[sel] : null;
  const B = layer ? boxOf(layer) : null;
  const slots = Math.max(1, ...(st.doc ?? []).flatMap((t) => t.layers.flatMap((l) => (l.k === "photo" ? [l.slot + 1] : []))));
  const frameName = (fid?: string) => lib.frames.find((f) => f.id === fid)?.name;
  const assetName = (aid?: string) => (aid?.startsWith("f:") ? frameName(aid.slice(2)) : lib.assets.find((a) => a.id === aid)?.name);
  const setNames = (ids: string[]) => ids.map((x) => lib.sets.find((s) => s.id === x)?.name ?? "?").join(", ");
  function layerName(l: Layer) {
    if (l.k === "photo") return `Ô ảnh ${l.slot + 1} · ${l.frameSets?.length ? `Ngẫu nhiên: ${setNames(l.frameSets)}` : l.frame ? frameName(l.frame) ?? "Khung" : shapeName(l.shape, l.h / l.w)}`;
    if (l.k === "text") return `Chữ · ${(l.role === "custom" ? l.value ?? "" : l.role === "main" ? "dòng chính" : "dòng phụ").slice(0, 24) || "chữ"}`;
    if (l.k === "wish") return `Lời chúc · ${l.value.slice(0, 24)}`;
    if (l.k === "sticker") return `${l.asset?.startsWith("f:") ? "Khung trang trí" : "Sticker"} · ${assetName(l.asset) ?? SHAPE_VI[l.shape] ?? l.shape}`;
    if (l.k === "doodle") return `Doodle · ${assetName(l.asset) ?? SHAPE_VI[l.shape] ?? l.shape}`;
    if (l.k === "tape") return `Băng dính · ${assetName(l.asset) ?? `Washi ${l.pattern === "dots" ? "chấm bi" : l.pattern === "stripe" ? "sọc" : "trơn"}`}`;
    return `Mảnh giấy · ${assetName(l.asset) ?? SHAPE_VI[l.paper] ?? l.paper}`;
  }
  const patch = (i: number, v: Partial<Layer>) => { st.D.begin(); st.setLayers((ls) => ls.map((l, j) => (j === i ? ({ ...l, ...v } as Layer) : l))); };
  function setBox(key: "x" | "y" | "w" | "h" | "rot", v: number) {
    if (sel === null || !layer) return;
    if (key === "x" || key === "y" || key === "rot") return patch(sel, { [key]: v } as Partial<Layer>);
    if (layer.k === "sticker" || layer.k === "doodle") return patch(sel, { s: Math.max(1, v) } as Partial<Layer>);
    if (layer.k === "text") return key === "w" ? patch(sel, { w: Math.max(4, v) } as Partial<Layer>) : patch(sel, { size: Math.max(1.2, v / 1.6) } as Partial<Layer>);
    patch(sel, { [key]: Math.max(1, v) } as Partial<Layer>);
  }
  function reorder(i: number, d: number) { const j = i + d; if (j < 0 || j >= L.length) return; st.D.begin(); st.setLayers((ls) => { const a = [...ls]; [a[i], a[j]] = [a[j], a[i]]; return a; }); st.setSel(j); }
  function randomFrame(i: number, ids: string[]) {
    const list = lib.frames.filter((f) => ids.includes(f.set_id));
    const l = L[i];
    if (l?.k !== "photo") return;
    if (!ids.length) return patch(i, { frameSets: undefined } as Partial<Layer>);
    const f = list[Math.floor(Math.random() * list.length)];
    patch(i, { frameSets: ids, frame: f?.id ?? l.frame, shape: "rect", h: f ? r1(l.w * (f.ratio || 1)) : l.h } as Partial<Layer>);
  }

  const block = (title: string, body: React.ReactNode, open = true) => (
    <details open={open} className="group rounded-[10px] border border-[#e5e5e7]">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] font-semibold">{title}<span className="text-[#a1a1aa] transition-transform group-open:rotate-180">▾</span></summary>
      <div className="border-t border-[#efeff1] p-3">{body}</div>
    </details>
  );
  const admin = (
    <div className="space-y-2">
      {block("Ảnh thử", (
        <>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<ImagePlus size={14} />} onClick={() => photoIn.current?.click()}>Tải ảnh thử</Button>
            <Button size="sm" variant="secondary" onClick={() => setSamples(samplePhotos())}>Ảnh mẫu</Button>
          </div>
          <input ref={photoIn} type="file" multiple accept="image/*" className="sr-only" onChange={async (e) => {
            const fs = Array.from(e.target.files ?? []); e.target.value = "";
            const out = await Promise.all(fs.map(async (f) => { const b = await createImageBitmap(f); const c = document.createElement("canvas"); const s = Math.min(1, 1600 / Math.max(b.width, b.height)); c.width = b.width * s; c.height = b.height * s; c.getContext("2d")!.drawImage(b, 0, 0, c.width, c.height); return c; }));
            if (out.length) setSamples(out);
          }} />
          <p className="mt-2 text-[11px] text-[#a1a1aa]">Chỉ để xem thử — không lưu vào mẫu. Mẫu có {slotCount(cur ?? { layers: [] } as unknown as Template)} ô ảnh.</p>
        </>
      ))}
      {block(layer ? `Thuộc tính · ${layerName(layer)}` : "Thuộc tính", layer && B && sel !== null ? (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1">
            {(["x", "y", "w", "h", "rot"] as const).map((key) => (
              <label key={key} className="text-[10px] text-[#71717a]">{key === "rot" ? "Xoay°" : key.toUpperCase()}
                <input type="number" step={key === "rot" ? 1 : 0.5} value={r1(B[key])} onChange={(e) => setBox(key, Number(e.target.value))} className="h-7 w-full rounded-[6px] border border-[#e5e5e7] px-1 text-[12px] text-[#18181b]" />
              </label>
            ))}
          </div>
          <p className="text-[10px] text-[#a1a1aa]">Đơn vị mm · bề mặt {cur?.surface === "spread" ? "240 × 120" : cur?.surface === "back" ? "150 × 117 (nếp gấp gáy cách 2 cạnh 6 mm)" : "120 × 120"} mm</p>
          {layer.k === "photo" && (
            <>
              <label className="flex items-center justify-between gap-2 text-[12px] text-[#52525b]">Ảnh số
                <select value={layer.slot} onChange={(e) => patch(sel, { slot: Number(e.target.value) } as Partial<Layer>)} className="h-7 rounded-[6px] border border-[#e5e5e7] px-1 text-[12px]">
                  {Array.from({ length: Math.max(slots, layer.slot + 1) + 1 }, (_, k) => <option key={k} value={k}>{k + 1}</option>)}
                </select>
              </label>
              {lib.sets.length > 0 && (
                <div className="rounded-[8px] border border-[#e5e5e7] p-2 text-[12px] text-[#52525b]">
                  <div className="mb-1 flex items-center justify-between">
                    <span>Ngẫu nhiên từ bộ khung…</span>
                    {!!layer.frameSets?.length && <button type="button" onClick={() => randomFrame(sel, layer.frameSets!)} className="inline-flex items-center gap-1 text-[#ff5fa2]"><Dices size={13} /> Khung khác</button>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {lib.sets.map((fs) => (
                      <label key={fs.id} className="flex items-center gap-1"><input type="checkbox" className="accent-[#ff5fa2]" checked={!!layer.frameSets?.includes(fs.id)}
                        onChange={(e) => randomFrame(sel, e.target.checked ? [...(layer.frameSets ?? []), fs.id] : (layer.frameSets ?? []).filter((x) => x !== fs.id))} />{fs.name}</label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : <p className="text-[12px] text-[#a1a1aa]">Chọn 1 lớp trên bề mặt để xem số đo.</p>)}
      {block(`Lớp (${L.length})`, (
        <ul className="max-h-[320px] space-y-0.5 overflow-y-auto">
          {L.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
            <li key={i} className={cx("flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px]", sel === i ? "bg-[#eff6ff] text-[#2563eb]" : "hover:bg-[#fafafa]", l.hidden && "opacity-50")}>
              <button type="button" onClick={() => st.setSel(i)} title={layerName(l)} className="min-w-0 flex-1 truncate text-left">{layerName(l)}</button>
              <button type="button" onClick={() => patch(i, { hidden: !l.hidden })} aria-label={l.hidden ? "Hiện" : "Ẩn"} title={l.hidden ? "Hiện lớp" : "Ẩn lớp"} className="text-[#a1a1aa] hover:text-[#18181b]">{l.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
              <button type="button" onClick={() => patch(i, { locked: !l.locked })} aria-label={l.locked ? "Mở khoá" : "Khoá"} title={l.locked ? "Mở khoá (khách chọn được)" : "Khoá (khách không chọn / sửa được)"} className={l.locked ? "text-[#ff5fa2]" : "text-[#a1a1aa] hover:text-[#18181b]"}>{l.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
              <button type="button" onClick={() => reorder(i, 1)} aria-label="Lên trên" className="text-[#a1a1aa] hover:text-[#18181b]"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => reorder(i, -1)} aria-label="Xuống dưới" className="text-[#a1a1aa] hover:text-[#18181b]"><ArrowDown size={12} /></button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
  const back = row.kind === "cd" ? "/admin/thiet-ke/template/cd-template" : row.kind === "back" ? "/admin/thiet-ke/template/back-template" : `/admin/thiet-ke/template/booklet-template?sub=${row.kind === "booklet_spread" ? "spread" : "single"}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e5e7] bg-white px-4 py-2">
        <Link href={back} className="inline-flex items-center gap-1 text-[13px] text-[#52525b] hover:text-[#ff5fa2]"><ArrowLeft size={15} /> Template</Link>
        <span className="text-[12px] text-[#a1a1aa]">{row.kind === "cd" ? "CD Template" : row.kind === "back" ? "Back cover Template" : `Booklet Template · ${KIND_INFO[row.kind].label}`}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên mẫu" aria-label="Tên mẫu" className="h-8 min-w-[180px] flex-1 rounded-[6px] border border-transparent px-2 text-[14px] font-semibold hover:border-[#e5e5e7] focus:border-[#ff5fa2] focus:outline-none" />
        {FEATURE_AUTO_STICKERS && <span className="inline-flex">
          <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} onClick={decorate} className="rounded-r-none">Rải sticker tự động</Button>
          <button type="button" onClick={() => setGear(true)} title="Cài đặt rải sticker" aria-label="Cài đặt rải sticker" className="grid h-8 w-8 place-items-center rounded-r-[8px] border border-l-0 border-[#e5e5e7] bg-white text-[#52525b] hover:bg-[#f4f4f5]"><Settings size={14} /></button>
        </span>}
        <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={restore} disabled={saving}>Khôi phục bản đã lưu</Button>
        <Button size="sm" icon={<Save size={14} />} onClick={save} loading={saving}>Lưu mẫu</Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <ScrapbookEditor mode="template" st={st} assets={lib.assets} assetGroups={lib.groups} frames={lib.frames} frameSets={lib.sets} fonts={lib.fonts} topics={lib.topics} wishes={lib.wishes}
          tab={tab} setTab={setTab} guides={guides} setGuides={setGuides} framePhotos={framePhotos} photoTab={admin} maxW="max-w-none" />
      </div>
      {gear && (
        <Modal onClose={() => setGear(false)} wide>
          <StickerSettings value={lib.cfg} sets={lib.sets} storeKey={lib.cfgKey} title={`Cài đặt rải sticker · ${row.kind === "cd" ? "CD Template" : "Booklet Template"}`}
            onSaved={(v) => { setLib({ ...lib, cfg: v }); setGear(false); }} />
        </Modal>
      )}
    </div>
  );
}
