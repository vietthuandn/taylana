"use client";

/* Trình sửa mẫu scrapbook của admin = trình chỉnh dùng chung ScrapbookEditor ở mode "template" (đủ tab Ảnh · Sticker ·
   Chữ · Nền như khách) + panel phải chỉ dành cho admin: ảnh thử, danh sách lớp (đổi thứ tự, ẩn / hiện, khoá),
   số đo (X, Y, W, H, góc xoay — mm), số ảnh của ô (1..N), "Ngẫu nhiên từ bộ khung…". Thanh trên: tên mẫu (sửa trực tiếp),
   Khôi phục mẫu gốc, Lưu mẫu.
   Nguồn mẫu: ?id=<uuid> (mẫu tạo mới / nhân bản — bảng scrapbook_templates) hoặc ?n=&style=[&surface=spread]
   (mẫu tự tạo bằng code — bản chỉnh lưu ở scrapbook_template_settings.template). */
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
import { ArrowDown, ArrowLeft, ArrowUp, Dices, Eye, EyeOff, ImagePlus, Lock, RotateCcw, Save, Unlock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { uploadScrapbookAsset } from "@/lib/upload";
import { generate } from "@/lib/scrapbook/generate";
import { BOOKLET_PAGES, SPREAD_KINDS, generateBooklet, generateSpread } from "@/lib/scrapbook/booklet";
import { bookletOverride, bookletSettingOf } from "@/lib/scrapbook/catalog";
import { mergeStickerCfg, setFrameLibrary, setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { settingOf } from "@/lib/scrapbook/templates";
import { boxOf } from "@/lib/scrapbook/edit";
import { DEFAULT_TOPICS, DEFAULT_WISHES } from "@/lib/scrapbook/wishes";
import type { CutoutFont, Glyph } from "@/lib/scrapbook/cutout";
import { STYLES, type Frame, type FrameSet, type Layer, type ScrapAsset, type Style, type Template, type TemplateSetting, type Wish, type WishTopic } from "@/lib/scrapbook/types";
import { ScrapbookEditor, type EditorTab } from "@/components/scrapbook/ScrapbookEditor";
import { customizeText, useScrapStudio } from "@/components/scrapbook/useScrapStudio";
import { shapeName } from "@/components/scrapbook/FramePicker";
import { Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Img = HTMLCanvasElement;
type Src = { kind: "custom"; id: string; surface: "disc" | "booklet"; n: number } | { kind: "override"; surface: "disc" | "spread" | "booklet"; n: number; style: Style };
const r1 = (v: number) => Math.round(v * 10) / 10;
const SHAPE_VI: Record<string, string> = { star: "Ngôi sao", heart: "Trái tim", flower: "Bông hoa", bow: "Nơ", sparkle: "Lấp lánh", arrow: "Mũi tên", swirl: "Xoắn", dash: "Vòng nét đứt", note: "Giấy note", grid: "Giấy kẻ ô", ticket: "Vé", kraft: "Giấy kraft" };
const TEXT0 = { main: "Happy Birthday", sub: "Ghi chú nhỏ" };

export function TemplateEditor() {
  const params = useSearchParams();
  const src = useMemo<Src>(() => {
    const id = params.get("id");
    if (id) return { kind: "custom", id, surface: "disc", n: 0 };
    const style = (STYLES.find((s) => s.id === params.get("style"))?.id ?? "polaroid") as Style;
    if (params.get("surface") === "booklet") { // bộ mẫu Booklet tự sinh (n = số trang) — sửa trực tiếp
      const pages = Number(params.get("n"));
      return { kind: "override", surface: "booklet", n: (BOOKLET_PAGES as readonly number[]).includes(pages) ? pages : 8, style };
    }
    const spread = params.get("surface") === "spread";
    const n = spread ? Math.min(SPREAD_KINDS.length, Math.max(1, Number(params.get("n")) || 1)) : Math.min(10, Math.max(5, Number(params.get("n")) || 5));
    return { kind: "override", surface: spread ? "spread" : "disc", n, style: (STYLES.find((s) => s.id === params.get("style"))?.id ?? "polaroid") as Style };
  }, [params]);
  const [lib, setLib] = useState<{ assets: ScrapAsset[]; frames: Frame[]; sets: FrameSet[]; fonts: CutoutFont[]; glyphs: Glyph[]; topics: WishTopic[]; wishes: Wish[] } | null>(null);
  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [a, fs, fr, cf, wt, w, sc] = await Promise.all([
        sb.from("scrapbook_assets").select("*").eq("is_active", true).order("grp").order("sort_order"),
        sb.from("frame_sets").select("*").eq("is_active", true).order("sort_order"), sb.from("frames").select("*").eq("is_active", true).order("sort_order"),
        sb.from("cutout_fonts").select("*").eq("is_active", true).order("sort_order"),
        sb.from("wish_topics").select("*").eq("is_active", true).order("sort_order"), sb.from("wishes").select("*").eq("is_active", true).order("sort_order"),
        sb.from("site_settings").select("value").eq("key", src.kind === "custom" ? "scrap_stickers" : src.surface === "disc" ? "scrap_stickers" : "scrap_stickers_booklet").maybeSingle(),
      ]);
      setStickerConfig(mergeStickerCfg((sc.data?.value as Partial<StickerCfg>) ?? null));
      const sets = (fs.data ?? []) as FrameSet[], fonts = (cf.data ?? []) as CutoutFont[];
      setFrameLibrary(sets);
      const g = fonts.length ? await sb.from("cutout_glyphs").select("*").in("font_id", fonts.map((x) => x.id)).order("sort_order") : { data: [] };
      setLib({ assets: (a.data ?? []) as ScrapAsset[], frames: ((fr.data ?? []) as Frame[]).filter((f) => sets.some((s) => s.id === f.set_id)), sets, fonts, glyphs: (g.data ?? []) as Glyph[],
        topics: ((wt.data ?? []) as WishTopic[]).length ? (wt.data as WishTopic[]) : DEFAULT_TOPICS, wishes: ((w.data ?? []) as Wish[]).length ? (w.data as Wish[]) : DEFAULT_WISHES });
    })();
  }, [src]);
  if (!lib) return <p className="p-6 text-[13px] text-[#71717a]">Đang tải trình sửa mẫu...</p>;
  return <Workbench src={src} lib={lib} />;
}

function Workbench({ src, lib }: { src: Src; lib: { assets: ScrapAsset[]; frames: Frame[]; sets: FrameSet[]; fonts: CutoutFont[]; glyphs: Glyph[]; topics: WishTopic[]; wishes: Wish[] } }) {
  const [samples, setSamples] = useState<Img[]>(() => samplePhotos());
  const [tab, setTab] = useState<EditorTab>("anh");
  const [guides, setGuides] = useState(true);
  const [name, setName] = useState("");
  const [row, setRow] = useState<TemplateSetting | null>(null);
  const [original, setOriginal] = useState<Template[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [booklet, setBooklet] = useState(src.kind === "override" && src.surface !== "disc");
  const [spreadRows, setSpreadRows] = useState<TemplateSetting[]>([]);
  const photoIn = useRef<HTMLInputElement>(null);
  const st = useScrapStudio({
    prefix: "tpl", max: 0, assets: lib.assets, frames: lib.frames, fonts: lib.fonts, glyphs: lib.glyphs, defaultText: TEXT0, extra: EMPTY, onLoad: () => undefined,
    wantAllFonts: tab === "chu", persist: false, template: true, slotPhotos: samples, uploadBg: uploadScrapbookAsset,
  });
  const framePhotos = useMemo(() => samples.map((c, i) => ({ id: `s${i}`, url: c.toDataURL("image/jpeg", 0.6) })), [samples]);

  // ---------- nạp mẫu ----------
  const generated = (seed: number, spread = spreadRows): Template[] => src.kind !== "override" ? []
    : src.surface === "booklet" ? generateBooklet(src.n, src.style, seed, lib.assets, lib.frames, spread).surfaces
    : [src.surface === "spread" ? generateSpread(src.n, src.style, seed, lib.assets) : generate(src.n, src.style, seed, lib.assets, lib.frames)];
  useEffect(() => {
    if (!st.ready || loaded) return;
    (async () => {
      const sb = createClient();
      let doc: Template[] = [];
      if (src.kind === "custom") {
        const { data, error } = await sb.from("scrapbook_templates").select("*").eq("id", src.id).maybeSingle();
        if (error || !data) { toast("Không tìm thấy mẫu (cần chạy migration_staff_templates.sql?)", "err"); return; }
        doc = (data.config?.surfaces ?? []) as Template[];
        setName(data.name ?? ""); setBooklet(data.surface === "booklet");
      } else if (src.surface === "booklet") {
        const { data } = await sb.from("scrapbook_template_settings").select("*");
        const all = (data ?? []) as TemplateSetting[], spread = all.filter((x) => x.surface_type === "spread");
        setSpreadRows(spread);
        const r = bookletSettingOf(all, src.n, src.style);
        setRow(r);
        setName(r.name ?? `${STYLES.find((x) => x.id === src.style)?.name} · ${src.n} trang`);
        doc = bookletOverride(r) ? structuredClone(bookletOverride(r)!) : generated(r.seed, spread);
      } else {
        const { data } = await sb.from("scrapbook_template_settings").select("*").eq("n", src.n).eq("style", src.style);
        const rows = ((data ?? []) as TemplateSetting[]).filter((x) => (x.surface_type ?? "disc") === src.surface);
        const r = src.surface === "spread" ? rows[0] ?? { n: src.n, style: src.style, seed: src.n * 1000 + STYLES.findIndex((x) => x.id === src.style) + 1, is_active: true, surface_type: "spread" } : settingOf(rows, src.n, src.style);
        setRow(r);
        setName((r as TemplateSetting & { name?: string }).name ?? `${STYLES.find((x) => x.id === src.style)?.name}${src.surface === "spread" ? ` · ${SPREAD_KINDS.find((k) => k.id === src.n)?.name}` : ` · ${src.n} ảnh`}`);
        doc = r.template ? [structuredClone({ ...r.template, n: src.n, style: src.style, ...(src.surface === "spread" ? { surface: "spread" as const, kind: src.n } : {}) })] : generated(r.seed);
      }
      const docT = doc.map((t) => customizeText(t, TEXT0)); // chữ của mẫu = lớp chữ bình thường (sửa trực tiếp trên bề mặt)
      setOriginal(structuredClone(docT));
      st.D.setDoc(docT); st.D.reset(); st.setActive(0);
      setLoaded(true);
    })();
  }, [st.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const doc = st.doc;
    if (!doc) return;
    setSaving(true);
    const sb = createClient();
    let error: { message: string } | null = null;
    if (src.kind === "custom") {
      ({ error } = await sb.from("scrapbook_templates").update({ name: name.trim() || "Mẫu mới", config: { surfaces: doc }, updated_at: new Date().toISOString() }).eq("id", src.id));
    } else if (row) {
      ({ error } = await sb.from("scrapbook_template_settings").upsert({ surface_type: src.surface, n: src.n, style: src.style, seed: row.seed, is_active: row.is_active, template: src.surface === "booklet" ? { surfaces: doc } : doc[0], name: name.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "surface_type,n,style" }));
    }
    setSaving(false);
    if (error) return toast(/name|surface_type|template/.test(error.message) ? "Thiếu cột — cần chạy supabase/migration_staff_templates.sql." : error.message, "err");
    await revalidatePublic(["/thiet-ke/cd-template", "/thiet-ke/booklet"]);
    setOriginal(structuredClone(doc)); st.D.setEdited(false);
    toast("Đã lưu mẫu");
  }
  async function restore() {
    if (src.kind === "override" && row) {
      const sb = createClient();
      if (row.template) await sb.from("scrapbook_template_settings").upsert({ surface_type: src.surface, n: src.n, style: src.style, seed: row.seed, is_active: row.is_active, template: null, updated_at: new Date().toISOString() }, { onConflict: "surface_type,n,style" });
      const d = generated(row.seed).map((t) => customizeText(t, TEXT0));
      st.D.begin(); st.D.setDoc(d); setRow({ ...row, template: null }); setOriginal(structuredClone(d));
      await revalidatePublic(["/thiet-ke/cd-template", "/thiet-ke/booklet"]);
      toast("Đã khôi phục mẫu gốc");
    } else if (original) { st.D.begin(); st.D.setDoc(structuredClone(original)); toast("Đã khôi phục bản đã lưu"); }
  }

  const L = st.L, sel = st.sel, cur = st.cur;
  const layer = sel !== null ? L[sel] : null;
  const B = layer ? boxOf(layer) : null;
  const slotCount = Math.max(1, ...(st.doc ?? []).flatMap((t) => t.layers.flatMap((l) => (l.k === "photo" ? [l.slot + 1] : []))), src.kind === "override" && src.surface === "disc" ? src.n : 1);
  const frameName = (id?: string) => lib.frames.find((f) => f.id === id)?.name;
  const assetName = (id?: string) => (id?.startsWith("f:") ? frameName(id.slice(2)) : lib.assets.find((a) => a.id === id)?.name);
  const setNames = (ids: string[]) => ids.map((id) => lib.sets.find((s) => s.id === id)?.name ?? "?").join(", ");
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

  const right = (
    <>
      <section>
        <p className="mb-2 text-[13px] font-semibold">Ảnh thử</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<ImagePlus size={14} />} onClick={() => photoIn.current?.click()}>Tải ảnh thử</Button>
          <Button size="sm" variant="secondary" onClick={() => setSamples(samplePhotos())}>Ảnh mẫu</Button>
        </div>
        <input ref={photoIn} type="file" multiple accept="image/*" className="sr-only" onChange={async (e) => {
          const fs = Array.from(e.target.files ?? []); e.target.value = "";
          const out = await Promise.all(fs.map(async (f) => { const b = await createImageBitmap(f); const c = document.createElement("canvas"); const s = Math.min(1, 1600 / Math.max(b.width, b.height)); c.width = b.width * s; c.height = b.height * s; c.getContext("2d")!.drawImage(b, 0, 0, c.width, c.height); return c; }));
          if (out.length) setSamples(out);
        }} />
      </section>
      <section>
        <p className="mb-2 text-[13px] font-semibold">Lớp ({L.length})</p>
        <ul className="max-h-[260px] space-y-0.5 overflow-y-auto">
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
      </section>
      {layer && B && sel !== null && (
        <section className="space-y-2">
          <p className="text-[13px] font-semibold">Thuộc tính · {layerName(layer)}</p>
          <div className="grid grid-cols-5 gap-1">
            {(["x", "y", "w", "h", "rot"] as const).map((key) => (
              <label key={key} className="text-[10px] text-[#71717a]">{key === "rot" ? "Xoay°" : key.toUpperCase()}
                <input type="number" step={key === "rot" ? 1 : 0.5} value={r1(B[key])} onChange={(e) => setBox(key, Number(e.target.value))} className="h-7 w-full rounded-[6px] border border-[#e5e5e7] px-1 text-[12px] text-[#18181b]" />
              </label>
            ))}
          </div>
          <p className="text-[10px] text-[#a1a1aa]">Đơn vị mm · bề mặt {cur?.surface === "spread" ? "240 × 120" : "120 × 120"} mm</p>
          {layer.k === "photo" && (
            <>
              <label className="flex items-center justify-between gap-2 text-[12px] text-[#52525b]">Ảnh số
                <select value={layer.slot} onChange={(e) => patch(sel, { slot: Number(e.target.value) } as Partial<Layer>)} className="h-7 rounded-[6px] border border-[#e5e5e7] px-1 text-[12px]">
                  {Array.from({ length: Math.max(slotCount, layer.slot + 1) + 1 }, (_, k) => <option key={k} value={k}>{k + 1}</option>)}
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
                  {!!layer.frameSets?.length && <p className="mt-1 text-[11px] text-[#71717a]">Ngẫu nhiên: {setNames(layer.frameSets)} — khách áp mẫu sẽ nhận 1 khung bất kỳ (theo seed).</p>}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
  const title = src.kind === "custom" ? (booklet ? "Booklet Template" : "CD Template") : src.surface === "booklet" ? "Booklet Template · mẫu tự sinh" : src.surface === "spread" ? "Booklet · kiểu cặp trang" : "CD Template · mẫu tự tạo";
  return (
    <div className="flex h-[calc(100dvh-var(--header-h,57px))] min-h-[560px] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e5e7] bg-white px-4 py-2">
        <Link href={`/admin/thiet-ke/template?tab=${booklet ? "booklet-template" : "cd-template"}`} className="inline-flex items-center gap-1 text-[13px] text-[#52525b] hover:text-[#ff5fa2]"><ArrowLeft size={15} /> Template</Link>
        <span className="text-[12px] text-[#a1a1aa]">{title}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên mẫu" aria-label="Tên mẫu" className="h-8 min-w-[200px] flex-1 rounded-[6px] border border-transparent px-2 text-[14px] font-semibold hover:border-[#e5e5e7] focus:border-[#ff5fa2] focus:outline-none" />
        {row?.template && <span className="rounded-full bg-[#fff0f6] px-2 text-[12px] font-medium text-[#db2777]">Đã chỉnh</span>}
        <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={restore} disabled={saving}>Khôi phục mẫu gốc</Button>
        <Button size="sm" icon={<Save size={14} />} onClick={save} loading={saving}>Lưu mẫu</Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <ScrapbookEditor mode="template" st={st} assets={lib.assets} frames={lib.frames} frameSets={lib.sets} fonts={lib.fonts} topics={lib.topics} wishes={lib.wishes}
          tab={tab} setTab={setTab} guides={guides} setGuides={setGuides} framePhotos={framePhotos} right={right} maxW="max-w-none"
          pageLabel={(i, n) => (i === 0 ? "Trang 1 (bìa)" : i === n - 1 ? "Trang cuối" : `Cặp trang ${i}`)} />
      </div>
    </div>
  );
}
const EMPTY = {};
