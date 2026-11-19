"use client";

/* Admin → Xem mẫu Scrapbook → "Sửa mẫu": chỉnh tay 1 mẫu — CD Scrapbook (N ảnh × phong cách, mặt đĩa 120 mm)
   hoặc Booklet Scrapbook (?surface=spread: kiểu dàn trang cặp × phong cách, cặp trang 240 × 120 mm).
   Bấm chọn lớp → kéo để di chuyển, kéo 4 góc để phóng to / thu nhỏ (giữ tỉ lệ, Shift = tự do), núm tròn để xoay,
   phím mũi tên dịch 0.5 mm, Delete xoá lớp. Panel phải: danh sách lớp (thứ tự trên / dưới), thuộc tính, đổi chất liệu, nền.
   Lưu → scrapbook_template_settings.template (đè lên mẫu tạo bằng code). "Khôi phục mẫu gốc" → bỏ bản chỉnh. */
import "@fontsource/dancing-script/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/pangolin/400.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { generate } from "@/lib/scrapbook/generate";
import { SPREAD_KINDS, generateSpread } from "@/lib/scrapbook/booklet";
import { surfaceOf } from "@/lib/scrapbook/surface";
import { mergeStickerCfg, setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import { loadFonts, renderDisc } from "@/lib/scrapbook/render";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { settingOf } from "@/lib/scrapbook/templates";
import { STYLES, type Layer, type ScrapAsset, type Style, type Template, type TemplateSetting } from "@/lib/scrapbook/types";
import { Button, Toggle, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Box = { x: number; y: number; w: number; h: number; rot: number };
const LABEL: Record<Layer["k"], string> = { photo: "Ô ảnh", paper: "Mảnh giấy", tape: "Băng dính", sticker: "Sticker", doodle: "Doodle", text: "Chữ", wish: "Lời chúc" };
const GRP: Partial<Record<Layer["k"], ScrapAsset["grp"]>> = { tape: "tape", sticker: "sticker", doodle: "doodle", paper: "paper" };

function boxOf(l: Layer): Box | null {
  if (l.k === "sticker" || l.k === "doodle") return { x: l.x, y: l.y, w: l.s, h: l.s, rot: l.rot };
  if (l.k === "text") return l.arc ? null : { x: l.x, y: l.y, w: l.w, h: l.size * 1.6, rot: l.rot };
  return { x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rot };
}
function withBox(l: Layer, b: Box): Layer {
  if (l.k === "sticker" || l.k === "doodle") return { ...l, x: b.x, y: b.y, s: Math.max(1, (b.w + b.h) / 2), rot: b.rot };
  if (l.k === "text") return { ...l, x: b.x, y: b.y, w: Math.max(5, b.w), size: Math.max(1.5, b.h / 1.6), rot: b.rot };
  return { ...l, x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h), rot: b.rot };
}
const inside = (px: number, py: number, b: Box) => {
  const a = (-b.rot * Math.PI) / 180, dx = px - b.x, dy = py - b.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= b.w / 2 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= b.h / 2;
};
const r1 = (v: number) => Math.round(v * 10) / 10;

export function TemplateEditor() {
  const params = useSearchParams();
  const spread = params.get("surface") === "spread";
  const n = spread ? Math.min(SPREAD_KINDS.length, Math.max(1, Number(params.get("n")) || 1)) : Math.min(10, Math.max(5, Number(params.get("n")) || 5));
  const style = (STYLES.find((s) => s.id === params.get("style"))?.id ?? "polaroid") as Style;
  const surfaceType = spread ? "spread" : "disc";
  const make = useCallback((seed: number, list: ScrapAsset[]) => (spread ? generateSpread(n, style, seed, list) : generate(n, style, seed, list)), [spread, n, style]);
  const [row, setRow] = useState<TemplateSetting | null>(null);
  const [assets, setAssets] = useState<ScrapAsset[]>([]);
  const [imgs, setImgs] = useState<Awaited<ReturnType<typeof loadAssetImages>>>({});
  const [tpl, setTpl] = useState<Template | null>(null);
  const [sel, setSel] = useState<number | "bg" | null>(null);
  const [photos, setPhotos] = useState<(CanvasImageSource & { width: number; height: number })[]>([]);
  const [text, setText] = useState({ main: "Happy Birthday", sub: "Taylana · 2026" });
  const [guides, setGuides] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const [cssW, setCssW] = useState(600);
  const drag = useRef<{ mode: "move" | "scale" | "rotate"; i: number; b0: Box; px: number; py: number } | null>(null);
  const photoIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [t, a, sc] = await Promise.all([sb.from("scrapbook_template_settings").select("*").eq("n", n).eq("style", style), sb.from("scrapbook_assets").select("*").eq("is_active", true).order("grp").order("sort_order"), sb.from("site_settings").select("value").eq("key", "scrap_stickers").maybeSingle()]);
      setStickerConfig(mergeStickerCfg((sc.data?.value as Partial<StickerCfg>) ?? null));
      const list = (a.data ?? []) as ScrapAsset[];
      const rowsT = ((t.data ?? []) as TemplateSetting[]).filter((x) => (x.surface_type ?? "disc") === surfaceType);
      const r = spread ? rowsT[0] ?? { n, style, seed: n * 1000 + STYLES.findIndex((x) => x.id === style) + 1, is_active: true, surface_type: "spread" } : settingOf(rowsT, n, style);
      setRow(r); setAssets(list);
      setTpl(r.template ? structuredClone({ ...r.template, n, style, ...(spread ? { surface: "spread" as const, kind: n } : {}) }) : make(r.seed, list));
      setPhotos(samplePhotos());
      await loadFonts();
      setImgs(await loadAssetImages(list));
    })();
  }, [n, style, spread, surfaceType, make]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssW(Math.max(240, Math.min(el.clientWidth - 24, (el.clientHeight - 24) * (spread ? 2 : 1)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [spread]);
  useEffect(() => {
    const c = view.current;
    if (!c || !tpl) return;
    const px = Math.round(cssW * Math.min(2, window.devicePixelRatio || 1));
    const r = renderDisc({ template: tpl, photos, text, assets: imgs, size: px, guides });
    c.width = r.canvas.width; c.height = r.canvas.height; c.getContext("2d")!.drawImage(r.canvas, 0, 0);
  }, [tpl, photos, text, imgs, guides, cssW]);

  const update = useCallback((i: number, f: (l: Layer) => Layer) => { setTpl((t) => (t ? { ...t, layers: t.layers.map((l, j) => (j === i ? f(l) : l)) } : t)); setDirty(true); }, []);
  const S = surfaceOf(tpl);
  const k = cssW / S.w; // px / mm
  const mm = (e: { clientX: number; clientY: number }) => { const r = view.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * S.w, y: ((e.clientY - r.top) / r.height) * S.h }; };

  function downCanvas(e: React.PointerEvent) {
    if (!tpl) return;
    const p = mm(e);
    for (let i = tpl.layers.length - 1; i >= 0; i--) {
      const b = boxOf(tpl.layers[i]);
      if (b && inside(p.x, p.y, b)) {
        setSel(i);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { mode: "move", i, b0: b, px: p.x, py: p.y };
        return;
      }
    }
    setSel("bg");
  }
  function startHandle(e: React.PointerEvent, mode: "scale" | "rotate") {
    if (typeof sel !== "number" || !tpl) return;
    e.stopPropagation();
    const b = boxOf(tpl.layers[sel]);
    if (!b) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = mm(e);
    drag.current = { mode, i: sel, b0: b, px: p.x, py: p.y };
  }
  function moveAny(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = mm(e), b0 = d.b0;
    let b: Box = b0;
    if (d.mode === "move") b = { ...b0, x: r1(b0.x + p.x - d.px), y: r1(b0.y + p.y - d.py) };
    else if (d.mode === "rotate") b = { ...b0, rot: Math.round((Math.atan2(p.y - b0.y, p.x - b0.x) * 180) / Math.PI + 90) };
    else {
      // kéo góc: phóng / thu quanh tâm — giữ tỉ lệ (Shift = tự do)
      const a = (-b0.rot * Math.PI) / 180, dx = p.x - b0.x, dy = p.y - b0.y;
      const lx = Math.abs(dx * Math.cos(a) - dy * Math.sin(a)), ly = Math.abs(dx * Math.sin(a) + dy * Math.cos(a));
      if (e.shiftKey) b = { ...b0, w: r1(Math.max(2, lx * 2)), h: r1(Math.max(2, ly * 2)) };
      else { const s = Math.max(lx / (b0.w / 2), ly / (b0.h / 2)); b = { ...b0, w: r1(Math.max(2, b0.w * s)), h: r1(Math.max(2, b0.h * s)) }; }
    }
    update(d.i, (l) => withBox(l, b));
  }
  const upAny = () => { drag.current = null; };

  // phím tắt: mũi tên dịch 0.5 mm (Shift = 2 mm), Delete xoá lớp
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (typeof sel !== "number" || !tpl || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const st = e.shiftKey ? 2 : 0.5;
      const mv: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
      if (mv[e.key]) { e.preventDefault(); update(sel, (l) => { const b = boxOf(l); return b ? withBox(l, { ...b, x: b.x + mv[e.key][0], y: b.y + mv[e.key][1] }) : l; }); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeLayer(sel); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  function removeLayer(i: number) {
    if (!tpl) return;
    if (tpl.layers[i].k === "photo") return toast("Không xoá được ô ảnh (mẫu cần đủ số ô ảnh).", "err");
    setTpl({ ...tpl, layers: tpl.layers.filter((_, j) => j !== i) }); setSel(null); setDirty(true);
  }
  function order(i: number, d: number) {
    if (!tpl) return;
    const j = i + d;
    if (j < 0 || j >= tpl.layers.length) return;
    const L = [...tpl.layers]; [L[i], L[j]] = [L[j], L[i]];
    setTpl({ ...tpl, layers: L }); setSel(j); setDirty(true);
  }
  function addLayer(kind: "sticker" | "tape" | "paper" | "doodle") {
    if (!tpl) return;
    const base = { x: S.w / 2, y: 30, rot: 0 };
    const l: Layer = kind === "sticker" ? { k: "sticker", ...base, s: 8, shape: "star", color: "#ff8fab" }
      : kind === "tape" ? { k: "tape", ...base, w: 16, h: 4.2, color: "#9bd1e5", pattern: "stripe", seed: Date.now() % 1e6 }
      : kind === "doodle" ? { k: "doodle", ...base, s: 9, shape: "arrow", color: "#3f3f46" }
      : { k: "paper", ...base, w: 28, h: 20, paper: "note", color: "#fffdf5", torn: true, seed: Date.now() % 1e6 };
    setTpl({ ...tpl, layers: [...tpl.layers, l] }); setSel(tpl.layers.length); setDirty(true);
  }
  async function save(reset = false) {
    if (!row || !tpl) return;
    setSaving(true);
    const { error } = await createClient().from("scrapbook_template_settings").upsert({ surface_type: surfaceType, n, style, seed: row.seed, is_active: row.is_active, template: reset ? null : tpl, updated_at: new Date().toISOString() }, { onConflict: "surface_type,n,style" });
    setSaving(false);
    if (error) return toast(/template|surface_type/.test(error.message) ? "Thiếu cột — cần chạy supabase/migration_scrapbook_edit.sql và migration_booklet_scrapbook.sql." : error.message, "err");
    await revalidatePublic(["/thiet-ke/scrapbook", "/thiet-ke/booklet-scrapbook"]);
    if (reset) { setTpl(make(row.seed, assets)); setRow({ ...row, template: null }); toast("Đã khôi phục mẫu gốc"); }
    else { setRow({ ...row, template: tpl }); toast("Đã lưu mẫu"); }
    setDirty(false);
  }

  const L = typeof sel === "number" && tpl ? tpl.layers[sel] : null;
  const B = L ? boxOf(L) : null;
  const assetOpts = useMemo(() => (L && GRP[L.k] ? assets.filter((a) => a.grp === GRP[L.k]) : L?.k === "photo" ? assets.filter((a) => a.grp === "frame" && a.region) : []), [L, assets]);

  if (!tpl) return <p className="p-6 text-[13px] text-[#71717a]">Đang tải mẫu...</p>;
  return (
    <div className="flex h-[calc(100dvh-var(--header-h,57px))] min-h-[560px] flex-col bg-[#f7f7f8] md:flex-row">
      {/* ---------- mặt đĩa ---------- */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e5e7] bg-white px-4 py-2">
          <Link href="/admin/scrapbook?tab=mau" className="inline-flex items-center gap-1 text-[13px] text-[#52525b] hover:text-[#ff5fa2]"><ArrowLeft size={15} /> Mẫu</Link>
          <p className="text-[14px] font-semibold">{STYLES.find((s) => s.id === style)?.name} · {spread ? `Booklet: ${SPREAD_KINDS.find((x) => x.id === n)?.name}` : `${n} ảnh`}</p>
          {row?.template && <span className="rounded-full bg-[#fff0f6] px-2 text-[12px] font-medium text-[#db2777]">Đã chỉnh</span>}
          <div className="ml-auto flex items-center gap-2">
            <Toggle checked={guides} onChange={setGuides} label="Guideline" />
            <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => save(true)} disabled={saving || !row?.template}>Khôi phục mẫu gốc</Button>
            <Button size="sm" icon={<Save size={14} />} onClick={() => save(false)} loading={saving} disabled={!dirty && !!row?.template}>Lưu mẫu</Button>
          </div>
        </div>
        <div ref={wrap} className="relative grid flex-1 place-items-center overflow-hidden p-3" onPointerMove={moveAny} onPointerUp={upAny} onPointerCancel={upAny}>
          <div className="relative" style={{ width: cssW, height: (cssW * S.h) / S.w }}>
            <canvas ref={view} className="block h-full w-full cursor-pointer touch-none" onPointerDown={downCanvas} />
            {B && (
              <div className="pointer-events-none absolute border-2 border-[#2563eb]"
                style={{ left: (B.x - B.w / 2) * k, top: (B.y - B.h / 2) * k, width: B.w * k, height: B.h * k, transform: `rotate(${B.rot}deg)` }}>
                {[[0, 0], [1, 0], [1, 1], [0, 1]].map(([cx0, cy0], i) => (
                  <span key={i} onPointerDown={(e) => startHandle(e, "scale")} title="Kéo để phóng to / thu nhỏ (Shift = tự do)"
                    className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-[2px] border-2 border-[#2563eb] bg-white"
                    style={{ left: `${cx0 * 100}%`, top: `${cy0 * 100}%` }} />
                ))}
                <span onPointerDown={(e) => startHandle(e, "rotate")} title="Kéo để xoay"
                  className="pointer-events-auto absolute left-1/2 top-[-22px] h-3.5 w-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-[#2563eb] bg-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- panel phải ---------- */}
      <aside className="w-full shrink-0 space-y-5 overflow-y-auto border-l border-[#e5e5e7] bg-white p-4 md:w-[340px]">
        <section>
          <p className="mb-2 text-[13px] font-semibold">Ảnh thử & chữ</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<ImagePlus size={14} />} onClick={() => photoIn.current?.click()}>Tải ảnh thử</Button>
            <Button size="sm" variant="secondary" onClick={() => setPhotos(samplePhotos())}>Ảnh mẫu</Button>
          </div>
          <input ref={photoIn} type="file" multiple accept="image/*" className="sr-only" onChange={async (e) => {
            const fs = Array.from(e.target.files ?? []); e.target.value = "";
            const out = await Promise.all(fs.map(async (f) => { const b = await createImageBitmap(f); const c = document.createElement("canvas"); const s = Math.min(1, 1600 / Math.max(b.width, b.height)); c.width = b.width * s; c.height = b.height * s; c.getContext("2d")!.drawImage(b, 0, 0, c.width, c.height); return c; }));
            if (out.length) setPhotos(out);
          }} />
          <input value={text.main} onChange={(e) => setText({ ...text, main: e.target.value })} className="mt-2 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2 text-[13px]" aria-label="Dòng chính" />
          <input value={text.sub} onChange={(e) => setText({ ...text, sub: e.target.value })} className="mt-1 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2 text-[13px]" aria-label="Dòng phụ" />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold">Lớp ({tpl.layers.length})</p>
            <div className="flex gap-1">
              {(["sticker", "tape", "paper", "doodle"] as const).map((kk) => (
                <button key={kk} type="button" onClick={() => addLayer(kk)} title={`Thêm ${LABEL[kk].toLowerCase()}`} className="inline-flex h-7 items-center gap-0.5 rounded-[6px] border border-[#e5e5e7] px-1.5 text-[11px] hover:border-[#ff5fa2]"><Plus size={11} />{LABEL[kk]}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setSel("bg")} className={cx("mb-1 flex w-full items-center rounded-[6px] px-2 py-1 text-left text-[12px]", sel === "bg" ? "bg-[#eff6ff] text-[#2563eb]" : "hover:bg-[#fafafa]")}>Nền</button>
          <ul className="max-h-[220px] space-y-0.5 overflow-y-auto">
            {tpl.layers.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
              <li key={i} className={cx("flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px]", sel === i ? "bg-[#eff6ff] text-[#2563eb]" : "hover:bg-[#fafafa]")}>
                <button type="button" onClick={() => setSel(i)} className="min-w-0 flex-1 truncate text-left">{LABEL[l.k]}{l.k === "photo" ? ` ${l.slot + 1}${l.slot === 0 ? " (chính)" : ""}` : l.k === "text" ? ` · ${l.role === "main" ? "dòng chính" : l.role === "sub" ? "dòng phụ" : "chữ riêng"}` : "asset" in l && l.asset ? " · chất liệu" : ""}</button>
                <button type="button" onClick={() => order(i, 1)} aria-label="Lên trên" className="text-[#a1a1aa] hover:text-[#18181b]"><ArrowUp size={12} /></button>
                <button type="button" onClick={() => order(i, -1)} aria-label="Xuống dưới" className="text-[#a1a1aa] hover:text-[#18181b]"><ArrowDown size={12} /></button>
              </li>
            ))}
          </ul>
        </section>

        {sel === "bg" && (
          <section className="space-y-2">
            <p className="text-[13px] font-semibold">Nền</p>
            <Row label="Màu nền"><input type="color" value={tpl.bg.color} onChange={(e) => { setTpl({ ...tpl, bg: { ...tpl.bg, color: e.target.value } }); setDirty(true); }} /></Row>
            <Row label="Màu hoạ tiết"><input type="color" value={tpl.bg.ink} onChange={(e) => { setTpl({ ...tpl, bg: { ...tpl.bg, ink: e.target.value } }); setDirty(true); }} /></Row>
            <Row label="Hoạ tiết"><Sel value={tpl.bg.pattern} onChange={(v) => { setTpl({ ...tpl, bg: { ...tpl.bg, pattern: v as Template["bg"]["pattern"] } }); setDirty(true); }} opts={[["dots", "Chấm"], ["grid", "Ô kẻ"], ["lines", "Dòng kẻ"], ["plain", "Trơn"]]} /></Row>
            <Row label="Texture"><Sel value={tpl.bg.asset ?? ""} onChange={(v) => { setTpl({ ...tpl, bg: { ...tpl.bg, asset: v || undefined } }); setDirty(true); }} opts={[["", "Không"], ...assets.filter((a) => a.grp === "texture").map((a) => [a.id, a.name] as [string, string])]} /></Row>
          </section>
        )}

        {L && typeof sel === "number" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">{LABEL[L.k]}</p>
              {L.k !== "photo" && <button type="button" onClick={() => removeLayer(sel)} className="inline-flex items-center gap-1 text-[12px] text-[#dc2626]"><Trash2 size={12} /> Xoá lớp</button>}
            </div>
            {B && (
              <div className="grid grid-cols-5 gap-1">
                {(["x", "y", "w", "h", "rot"] as const).map((key) => (
                  <label key={key} className="text-[10px] text-[#71717a]">{key === "rot" ? "Xoay°" : key.toUpperCase()}
                    <input type="number" step={key === "rot" ? 1 : 0.5} value={r1(B[key])} onChange={(e) => update(sel, (l) => withBox(l, { ...B, [key]: Number(e.target.value) }))}
                      className="h-7 w-full rounded-[6px] border border-[#e5e5e7] px-1 text-[12px] text-[#18181b]" />
                  </label>
                ))}
              </div>
            )}
            {L.k === "photo" && (
              <>
                <Row label="Khung"><Sel value={L.shape} onChange={(v) => update(sel, (l) => ({ ...l, shape: v as typeof L.shape }) as Layer)} opts={[["rect", "Chữ nhật"], ["polaroid", "Polaroid"], ["torn", "Giấy xé"], ["circle", "Tròn"], ["heart", "Tim"], ["frame", "Khung ảnh (chất liệu)"]]} /></Row>
                {L.shape === "frame" && <Row label="Chất liệu"><Sel value={L.asset ?? ""} onChange={(v) => update(sel, (l) => ({ ...l, asset: v || undefined }) as Layer)} opts={[["", "Polaroid mặc định"], ...assetOpts.map((a) => [a.id, a.name] as [string, string])]} /></Row>}
                <Row label="Ảnh số"><Sel value={String(L.slot)} onChange={(v) => update(sel, (l) => ({ ...l, slot: Number(v) }) as Layer)} opts={Array.from({ length: spread ? Math.max(3, tpl.layers.filter((x) => x.k === "photo").length) : n }, (_, i) => [String(i), `${i + 1}${i === 0 && !spread ? " (chính)" : ""}`] as [string, string])} /></Row>
              </>
            )}
            {(L.k === "tape" || L.k === "sticker" || L.k === "doodle" || L.k === "paper") && (
              <Row label="Chất liệu"><Sel value={L.asset ?? ""} onChange={(v) => update(sel, (l) => ({ ...l, asset: v || undefined }) as Layer)} opts={[["", "Mặc định (vẽ bằng code)"], ...assetOpts.map((a) => [a.id, a.name] as [string, string])]} /></Row>
            )}
            {"color" in L && <Row label="Màu"><input type="color" value={L.color} onChange={(e) => update(sel, (l) => ({ ...l, color: e.target.value }) as Layer)} /></Row>}
            {L.k === "tape" && <Row label="Hoạ tiết"><Sel value={L.pattern} onChange={(v) => update(sel, (l) => ({ ...l, pattern: v }) as Layer)} opts={[["stripe", "Sọc"], ["dots", "Chấm"], ["plain", "Trơn"]]} /></Row>}
            {L.k === "sticker" && <Row label="Hình"><Sel value={L.shape} onChange={(v) => update(sel, (l) => ({ ...l, shape: v }) as Layer)} opts={[["star", "Ngôi sao"], ["heart", "Trái tim"], ["flower", "Bông hoa"], ["bow", "Nơ"], ["sparkle", "Lấp lánh"]]} /></Row>}
            {L.k === "doodle" && <Row label="Hình"><Sel value={L.shape} onChange={(v) => update(sel, (l) => ({ ...l, shape: v }) as Layer)} opts={[["arrow", "Mũi tên"], ["swirl", "Xoắn"], ["dash", "Vòng nét đứt"]]} /></Row>}
            {L.k === "paper" && (
              <>
                <Row label="Loại giấy"><Sel value={L.paper} onChange={(v) => update(sel, (l) => ({ ...l, paper: v }) as Layer)} opts={[["note", "Giấy note"], ["grid", "Giấy kẻ ô"], ["ticket", "Vé"], ["kraft", "Giấy kraft"]]} /></Row>
                <Row label="Mép xé"><input type="checkbox" checked={L.torn} onChange={(e) => update(sel, (l) => ({ ...l, torn: e.target.checked }) as Layer)} className="h-4 w-4 accent-[#ff5fa2]" /></Row>
              </>
            )}
            {L.k === "wish" && (
              <>
                <Row label="Kiểu khung"><Sel value={L.card} onChange={(v) => update(sel, (l) => ({ ...l, card: v }) as Layer)} opts={[["card", "Thiệp nhỏ"], ["note", "Giấy note"], ["lined", "Giấy kẻ dòng"], ["label", "Nhãn"]]} /></Row>
                <Row label="Màu chữ"><input type="color" value={L.ink} onChange={(e) => update(sel, (l) => ({ ...l, ink: e.target.value }) as Layer)} /></Row>
                <textarea value={L.value} onChange={(e) => update(sel, (l) => ({ ...l, value: e.target.value }) as Layer)} rows={3} className="w-full rounded-[6px] border border-[#e5e5e7] px-2 py-1 text-[12px]" aria-label="Lời chúc mẫu" />
              </>
            )}
            {L.k === "text" && (
              <>
                <Row label="Font"><Sel value={L.font} onChange={(v) => update(sel, (l) => ({ ...l, font: v }) as Layer)} opts={[["hand", "Viết tay"], ["marker", "Bút dạ"], ["label", "Nhãn dán"]]} /></Row>
                <Row label="Cỡ chữ (mm)"><input type="number" step={0.2} value={r1(L.size)} onChange={(e) => update(sel, (l) => ({ ...l, size: Math.max(1.5, Number(e.target.value)) }) as Layer)} className="h-7 w-20 rounded-[6px] border border-[#e5e5e7] px-1 text-[12px]" /></Row>
                {L.arc && <Row label="Bán kính vòng chữ"><input type="number" step={0.5} value={r1(L.arc.r)} onChange={(e) => update(sel, (l) => ({ ...l, arc: { ...(l as typeof L).arc!, r: Number(e.target.value) } }) as Layer)} className="h-7 w-20 rounded-[6px] border border-[#e5e5e7] px-1 text-[12px]" /></Row>}
              </>
            )}
            <Row label="Khoá (khách không chọn / sửa được)"><input type="checkbox" checked={!!L.locked} onChange={(e) => update(sel, (l) => ({ ...l, locked: e.target.checked }) as Layer)} className="h-4 w-4 accent-[#ff5fa2]" /></Row>
            <p className="text-[11px] text-[#a1a1aa]">Kéo để di chuyển · kéo góc để đổi cỡ (Shift = tự do) · núm tròn để xoay · phím mũi tên dịch 0.5 mm.</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex items-center justify-between gap-2 text-[12px] text-[#52525b]"><span>{label}</span>{children}</label>;
}
function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 max-w-[180px] rounded-[6px] border border-[#e5e5e7] px-1 text-[12px] text-[#18181b]">{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
}
