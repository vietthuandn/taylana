"use client";

/* Admin → Quản lý chất liệu → tab "Font cut-out": bộ font chữ cắt dán (mỗi ký tự nhiều biến thể).
   Tải tờ chữ → tách từng mảnh (lib/stickerSlicer, giữ nền giấy của mảnh) → gán ký tự bằng nhận diện (lib/cutoutOcr:
   tiền xử lý + Tesseract + font mẫu + dữ liệu học, chạy trong Web Worker) hoặc "Theo thứ tự" (chuỗi ký tự đọc trái → phải, trên → dưới) → duyệt / sửa → lưu vào cutout_glyphs. */
import { promptDialog } from "@/components/ui/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Combine, Link2, Plus, Square, Trash2, Upload, Wand2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadImg } from "@/lib/mockup/images";
import { uploadFile, deleteFiles } from "@/lib/storage/client";
import { itemCanvas, itemFromRect, itemsFromSheet, mergeItems, readSheet, runSlice, type Item, type Sheet } from "@/lib/stickerSlicer";
import { DIACRITICS, SECTIONS, TONES, charLabel, drawCutout, keyToChar, kindOf, layoutCutout, loadCutoutFont, missingChars, type CutoutFont, type Glyph } from "@/lib/scrapbook/cutout";
import { revalidatePublic } from "@/app/admin/actions";
import { Badge, Button, Card, EmptyState, Input, Message, Toggle, confirmDialog, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { addTraining, closeTesseract, fixCase, initRefs, prepCanvas, rawToUrl, recognize, type Recog } from "@/lib/cutoutOcr";
import { OCR_CONFIG } from "@/lib/cutoutOcr/config";
// font mẫu cho so khớp ký tự (lib/cutoutOcr/config.ts → TEMPLATE_FONTS)
import "@fontsource/inter/400.css";
import "@fontsource/inter/800.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/oswald/500.css";
import "@fontsource/anton/400.css";
import "@fontsource/lora/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/roboto-slab/700.css";

type Msg = { type: "ok" | "err"; text: string } | null;
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
const PATHS = ["/thiet-ke/cd-template"];
const storagePath = (url: string) => url; // xoá theo link (lib/storage nhận cả link R2 lẫn Supabase cũ)

// ảnh xem trước: chữ "Taylana" dựng bằng chính bộ font
async function previewOf(fontId: string, glyphs: Glyph[]) {
  const f = await loadCutoutFont(fontId, glyphs, (u) => loadImg(u), new Set("TaylanTAYLANa".split("")));
  const { pieces, bounds } = layoutCutout("Taylana", f, { size: 20, curve: 0, chaos: 0.35, spacing: 0, seed: 7 });
  const k = 6, pad = 4, W = (bounds.x1 - bounds.x0 + pad * 2) * k, H = (bounds.y1 - bounds.y0 + pad * 2) * k;
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H));
  const x = c.getContext("2d")!;
  x.scale(k, k); x.translate(pad - bounds.x0, pad - bounds.y0);
  drawCutout(x, pieces, k);
  return c.toDataURL("image/png");
}

export function CutoutAdmin() {
  const [fonts, setFonts] = useState<CutoutFont[]>([]);
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [f, g] = await Promise.all([sb.from("cutout_fonts").select("*").order("sort_order").order("created_at"), sb.from("cutout_glyphs").select("*").order("ch").order("sort_order")]);
    if (f.error) setMsg({ type: "err", text: "Chưa có bảng font cut-out — cần chạy supabase/migration_scrapbook_cutout.sql." });
    setFonts((f.data ?? []) as CutoutFont[]); setGlyphs((g.data ?? []) as Glyph[]); setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fonts.forEach((f) => previewOf(f.id, glyphs).then((u) => setPreviews((p) => ({ ...p, [f.id]: u }))).catch(() => {})); }, [fonts, glyphs]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PATHS); await load(); };

  async function create() {
    if (!name.trim()) return;
    const { data, error } = await createClient().from("cutout_fonts").insert({ name: name.trim(), sort_order: (fonts.at(-1)?.sort_order ?? 0) + 1 }).select("id").single();
    if (error) return setMsg({ type: "err", text: error.message });
    setName(""); setOpen(data.id as string);
    await after("Đã tạo bộ font.");
  }
  async function patch(id: string, v: Partial<CutoutFont>, text = "Đã lưu.") {
    const { error } = await createClient().from("cutout_fonts").update(v).eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(text);
  }
  async function removeFont(f: CutoutFont) {
    if (!await confirmDialog(`Xoá bộ font "${f.name}" và toàn bộ mảnh chữ?`, { danger: true, ok: "Xoá" })) return;
    const sb = createClient();
    const paths = glyphs.filter((g) => g.font_id === f.id).map((g) => storagePath(g.url)).filter(Boolean) as string[];
    const { error } = await sb.from("cutout_fonts").delete().eq("id", f.id);
    if (error) return setMsg({ type: "err", text: error.message });
    if (paths.length) await deleteFiles({ urls: paths }).catch(() => 0);
    if (open === f.id) setOpen(null);
    await after("Đã xoá bộ font.");
  }
  async function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= fonts.length) return;
    const sb = createClient();
    await Promise.all([sb.from("cutout_fonts").update({ sort_order: fonts[j].sort_order }).eq("id", fonts[i].id), sb.from("cutout_fonts").update({ sort_order: fonts[i].sort_order }).eq("id", fonts[j].id)]);
    await after("Đã đổi thứ tự.");
  }
  async function editGlyph(g: Glyph) {
    const v = await promptDialog({ title: "Sửa ký tự của mảnh", message: `Hiện tại: ${charLabel(g.ch)}`, label: "Ký tự mới", defaultValue: g.ch, confirmText: "Lưu ký tự" });
    if (v === null) return;
    const ch = keyToChar([...v.trim()].pop() ?? "");
    if (!ch || ch === g.ch) return;
    const sb = createClient();
    const { error } = await sb.from("cutout_glyphs").update({ ch, kind: kindOf(ch) }).eq("id", g.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await sb.from("cutout_training").update({ ch }).eq("glyph_id", g.id);
    await after(`Đã đổi ký tự thành “${charLabel(ch)}”.`);
  }
  async function removeGlyph(g: Glyph) {
    const sb = createClient();
    const { error } = await sb.from("cutout_glyphs").delete().eq("id", g.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await deleteFiles({ urls: [g.url] }).catch(() => 0);
    await after("Đã xoá biến thể.");
  }

  const missing = useMemo(() => Object.fromEntries(fonts.map((f) => [f.id, missingChars(glyphs.filter((g) => g.font_id === f.id))])), [fonts, glyphs]);
  const warn = (f: CutoutFont) => {
    const m = missing[f.id] ?? [];
    if (!m.length) return null;
    const all = showAll === f.id;
    const list = (all ? m : m.slice(0, 12)).map(charLabel).join(", ");
    return (
      <p key={f.id} className="rounded-[8px] bg-[#fff7ed] px-3 py-1.5 text-[12px] text-[#c2410c]">
        Bộ “{f.name}” còn thiếu: {list}{!all && m.length > 12 ? ` … (+${m.length - 12})` : ""}
        {m.length > 12 && <button type="button" onClick={() => setShowAll(all ? null : f.id)} className="ml-2 font-semibold underline-offset-2 hover:text-[#9a3412]">{all ? "Thu gọn" : "Xem tất cả"}</button>}
      </p>
    );
  };
  const cur = fonts.find((f) => f.id === open) ?? null;

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-6">
      {fonts.some((f) => missing[f.id]?.length) && <div className="space-y-1.5">{fonts.map(warn)}</div>}
      <Card title="Bộ font cut-out" description="Mỗi bộ gồm nhiều mảnh chữ cắt từ báo / tạp chí. Mỗi ký tự có thể có nhiều biến thể, khi dựng chữ web chọn ngẫu nhiên.">
        <div className="mb-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bộ font mới (ví dụ: Tạp chí)" className="max-w-xs" onKeyDown={(e) => e.key === "Enter" && create()} />
          <Button icon={<Plus size={16} />} onClick={create}>Tạo bộ font</Button>
        </div>
        {fonts.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fonts.map((f, i) => (
              <li key={f.id} className={cx("rounded-[12px] border p-3", open === f.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/20" : "border-[#e5e5e7]")}>
                <button type="button" onClick={() => setOpen(open === f.id ? null : f.id)} className={cx("grid h-20 w-full place-items-center overflow-hidden rounded-[8px]", checker)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {previews[f.id] ? <img src={previews[f.id]} alt="" className="max-h-full max-w-full" /> : <span className="text-[12px] text-[#a1a1aa]">Taylana</span>}
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <input defaultValue={f.name} onBlur={(e) => e.target.value.trim() && e.target.value !== f.name && patch(f.id, { name: e.target.value.trim() })} className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent px-1 text-[14px] font-medium hover:border-[#e5e5e7]" aria-label="Tên bộ font" />
                  {missing[f.id]?.length ? <Badge tone="amber">Chưa đủ</Badge> : <Badge tone="green">Đủ</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[12px] text-[#71717a]">
                  <span>{glyphs.filter((g) => g.font_id === f.id).length} mảnh</span>
                  <span className="ml-auto" />
                  <Toggle checked={f.is_active} onChange={(v) => patch(f.id, { is_active: v }, v ? "Đã bật." : "Đã tắt.")} label="" />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên" className="grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[#f4f4f5] disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === fonts.length - 1} aria-label="Xuống" className="grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[#f4f4f5] disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => removeFont(f)} aria-label="Xoá" className="grid h-7 w-7 place-items-center rounded-[6px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 size={14} /></button>
                </div>
                <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setOpen(open === f.id ? null : f.id)}>{open === f.id ? "Đóng" : "Mở bộ font"}</Button>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Chưa có bộ font nào.</EmptyState>}
      </Card>

      {cur && (
        <>
          <Card title={`Tải tờ chữ vào “${cur.name}”`} description="Ảnh tờ chữ cắt (JPG / PNG, nhiều ảnh được). Web tách từng mảnh, giữ nguyên nền giấy của mảnh, rồi đoán ký tự.">
            <GlyphSlicer fontId={cur.id} onDone={() => after("Đã lưu các mảnh chữ.")} />
          </Card>
          <Card title={`Ký tự trong “${cur.name}”`}>
            {warn(cur)}
            <div className="mt-3 space-y-5">
              {[...SECTIONS, { id: "pre", name: "Chữ có dấu dựng sẵn (không bắt buộc — có thì ưu tiên dùng)", chars: [...new Set(glyphs.filter((g) => g.font_id === cur.id && g.kind === "precomposed").map((g) => g.ch))] }].map((sec) => (
                <section key={sec.id}>
                  <p className="mb-2 text-[13px] font-semibold">{sec.name}</p>
                  {sec.chars.length ? (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-9">
                      {sec.chars.map((ch) => {
                        const vs = glyphs.filter((g) => g.font_id === cur.id && g.ch === ch);
                        return (
                          <div key={ch} className={cx("rounded-[8px] border p-1", vs.length ? "border-[#e5e5e7]" : "border-dashed border-[#f59e0b]")}>
                            <p className="text-center text-[12px] font-semibold">{charLabel(ch)} <span className="font-normal text-[#a1a1aa]">({vs.length})</span></p>
                            <div className="mt-1 flex flex-wrap justify-center gap-1">
                              {vs.map((g) => (
                                <span key={g.id} className={cx("group relative grid h-9 w-9 place-items-center overflow-hidden rounded-[4px]", checker)}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={g.url} alt="" title="Bấm để sửa ký tự" onClick={() => editGlyph(g)} className="max-h-full max-w-full cursor-pointer" loading="lazy" />
                                  <button type="button" onClick={() => removeGlyph(g)} aria-label="Xoá biến thể" className="absolute right-0 top-0 hidden h-4 w-4 place-items-center rounded-bl-[4px] bg-black/55 text-white group-hover:grid"><X size={10} /></button>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-[12px] text-[#a1a1aa]">Chưa có.</p>}
                </section>
              ))}
            </div>
          </Card>
        </>
      )}
      <Message msg={msg} />
    </div>
  );
}

// ---------- tải tờ chữ → tách mảnh → gán ký tự (OCR / theo thứ tự) → lưu ----------
type GItem = Item & { sheet: number; ch: string; conf: number | null; recog?: Recog | null; confirmed?: boolean; unsure?: boolean };
const needsReview = (i: GItem) => !i.confirmed && (!i.ch || !!i.unsure || (i.conf !== null && i.conf < OCR_CONFIG.reviewBelow * 100));
function GlyphSlicer({ fontId, onDone }: { fontId: string; onDone: () => void }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [items, setItems] = useState<GItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState("");
  const [focus, setFocus] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [view, setView] = useState(0);
  const [rectMode, setRectMode] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<"all" | "review" | "done">("all");
  const [showPrep, setShowPrep] = useState(false);
  const [preps, setPreps] = useState<Record<string, string>>({});
  const fileIn = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const draw = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  // thứ tự đọc: theo hàng (trên → dưới), trong hàng trái → phải
  const reading = (list: GItem[]) => {
    const out: GItem[] = [];
    const bySheet = [...new Set(list.map((i) => i.sheet))].sort((a, b) => a - b);
    for (const s of bySheet) {
      const L = list.filter((i) => i.sheet === s).sort((a, b) => a.y0 - b.y0);
      const hMed = L.map((i) => i.y1 - i.y0).sort((a, b) => a - b)[Math.floor(L.length / 2)] ?? 1;
      const rows: GItem[][] = [];
      for (const it of L) {
        const cy = (it.y0 + it.y1) / 2, row = rows.find((r) => Math.abs((r[0].y0 + r[0].y1) / 2 - cy) < hMed * 0.5);
        if (row) row.push(it); else rows.push([it]);
      }
      rows.forEach((r) => out.push(...r.sort((a, b) => a.x0 - b.x0)));
    }
    return out;
  };
  async function addFiles(files: Blob[]) {
    setBusy("Đang tách mảnh chữ...");
    try {
      const next = [...sheets], add: GItem[] = [];
      for (const f of files) {
        const img = await readSheet(f);
        const res = await runSlice(img.data, img.w, img.h, { tolerance: 24, minAreaPct: 0.02, close: 2 });
        const s: Sheet = { w: img.w, h: img.h, orig: img.data, res };
        const idx = next.push(s) - 1;
        add.push(...itemsFromSheet(s, "sticker").map((it) => ({ ...it, sheet: idx, ch: "", conf: null })));
      }
      setSheets(next);
      setItems((c) => reading([...c, ...add]));
    } catch (e) { toast(e instanceof Error ? e.message : "Không đọc được ảnh", "err"); }
    setBusy("");
  }
  async function fromLink() {
    if (!/^https?:\/\//i.test(link.trim())) return toast("Link phải bắt đầu bằng https://", "err");
    try { const r = await fetch(`/api/img-proxy?url=${encodeURIComponent(link.trim())}`); if (!r.ok) throw new Error("Không tải được ảnh"); await addFiles([await r.blob()]); setLink(""); }
    catch (e) { toast(e instanceof Error ? e.message : "Không tải được ảnh", "err"); }
  }
  useEffect(() => {
    const t = setTimeout(() => {
      const out: Record<string, string> = {};
      for (const it of items) { const c = itemCanvas(sheets[it.sheet], it); if (c) out[it.key] = c.toDataURL("image/png"); }
      setThumbs(out);
    }, 50);
    return () => clearTimeout(t);
  }, [items, sheets]);
  // ảnh gốc của tờ đang xem + khung các mảnh
  useEffect(() => {
    const c = canvas.current, s = sheets[view];
    if (!c || !s) return;
    c.width = s.w; c.height = s.h;
    const x = c.getContext("2d")!;
    x.putImageData(new ImageData(new Uint8ClampedArray(s.orig), s.w, s.h), 0, 0);
    const lw = Math.max(2, s.w / 500);
    items.forEach((it) => {
      if (it.sheet !== view) return;
      x.lineWidth = picked.includes(it.key) ? lw * 2 : lw;
      x.strokeStyle = picked.includes(it.key) ? "#2563eb" : it.conf !== null && needsReview(it) ? "#f97316" : "#ff5fa2";
      x.strokeRect(it.x0, it.y0, it.x1 - it.x0, it.y1 - it.y0);
    });
    const d = draw.current;
    if (d) { x.strokeStyle = "#2563eb"; x.setLineDash([lw * 4, lw * 3]); x.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); x.setLineDash([]); }
  }, [sheets, view, items, picked, busy]);
  const visible = items.map((it, i) => ({ it, i })).filter(({ it }) => (filter === "all" ? true : filter === "review" ? it.conf !== null ? needsReview(it) : !it.ch : !!it.confirmed));

  // nhận diện từng mảnh: tiền xử lý + Tesseract + font mẫu + dữ liệu học (tất cả trên trình duyệt)
  async function ocr() {
    setBusy("Đang tải bộ nhận diện chữ..."); setProgress(0);
    try {
      await initRefs();
      let out = [...items];
      for (const [i, it] of out.entries()) {
        if (it.confirmed) continue;
        setBusy(`Đang nhận diện ${i + 1} / ${out.length}...`); setProgress((i + 1) / out.length);
        const c = itemCanvas(sheets[it.sheet], it);
        if (!c) continue;
        out[i] = { ...it, recog: await recognize(c) };
      }
      out = fixCase(out).map((it) => {
        const r = it.recog;
        if (!r || it.confirmed) return it;
        const top = r.cands[0];
        const unsure = r.unsure || !top || top.score < 0.3;
        return { ...it, ch: unsure ? "" : top.ch, conf: top ? Math.round(top.score * 100) : 0, unsure };
      });
      setItems(out);
      setPreps(Object.fromEntries(out.filter((i) => i.recog?.previewUrl).map((i) => [i.key, i.recog!.previewUrl])));
    } catch (e) { toast("Nhận diện chữ thất bại: " + (e instanceof Error ? e.message : String(e)), "err"); }
    await closeTesseract().catch(() => {});
    setBusy("");
  }
  // xem bản đen trắng đã xử lý (tính cho các mảnh chưa có)
  async function togglePrep() {
    const on = !showPrep; setShowPrep(on);
    if (!on) return;
    const next = { ...preps };
    for (const it of items) {
      if (next[it.key]) continue;
      const c = itemCanvas(sheets[it.sheet], it);
      if (!c) continue;
      const p = await prepCanvas(c);
      if (p.preview) next[it.key] = rawToUrl(p.preview);
    }
    setPreps(next);
  }
  const assign = (i: number, ch: string) => setItems((c) => c.map((x, j) => (j === i ? { ...x, ch, conf: 100, confirmed: true, unsure: false } : x)));
  const next = (i: number) => { const L = visible.map((v) => v.i), k = L.indexOf(i); setFocus(L[k + 1] ?? L[k] ?? null); };
  // gán theo thứ tự đọc
  function assignOrder() {
    const chars = [...order.replace(/\s/g, "")];
    if (!chars.length) return toast("Nhập chuỗi ký tự theo đúng thứ tự trên tờ.", "err");
    const L = reading(items);
    setItems(L.map((it, i) => (i < chars.length ? { ...it, ch: chars[i], conf: 100, confirmed: true, unsure: false } : it)));
    if (chars.length !== L.length) toast(`Chuỗi có ${chars.length} ký tự, tờ có ${L.length} mảnh — kiểm tra lại các mảnh cuối.`, "err");
  }
  // gán nhanh bằng bàn phím: chọn mảnh → gõ phím → nhảy sang mảnh tiếp.
  // 1 / 2 / 3: chọn ứng viên gợi ý · Enter: xác nhận gợi ý đầu tiên (số 1, 2, 3 gõ vào ô ký tự bên dưới mảnh)
  function onKey(e: React.KeyboardEvent) {
    if (focus === null || (e.target as HTMLElement).tagName === "INPUT") return;
    const it = items[focus];
    if (!it) return;
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); setItems((c) => c.map((x, j) => (j === focus ? { ...x, ch: "", confirmed: false } : x))); return; }
    if (e.key === "ArrowRight") return setFocus(Math.min(items.length - 1, focus + 1));
    if (e.key === "ArrowLeft") return setFocus(Math.max(0, focus - 1));
    const cands = it.recog?.cands ?? [];
    if (e.key === "Enter") {
      e.preventDefault();
      const ch = it.ch || cands[0]?.ch;
      if (ch) { assign(focus, ch); next(focus); }
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (cands.length && "123".includes(e.key)) {
      const c = cands[Number(e.key) - 1];
      if (c) { assign(focus, c.ch); next(focus); }
      return;
    }
    assign(focus, keyToChar(e.key));
    next(focus);
  }
  const setMark = (ch: string) => { if (focus === null) return; assign(focus, ch); next(focus); };
  function merge() {
    const list = items.filter((i) => picked.includes(i.key));
    if (list.length < 2 || new Set(list.map((i) => i.sheet)).size > 1) return toast("Chọn từ 2 mảnh cùng 1 tờ (giữ Ctrl / Shift khi bấm).", "err");
    const m = mergeItems(sheets[list[0].sheet], list);
    setItems((c) => reading([...c.filter((i) => !picked.includes(i.key)), { ...m, sheet: list[0].sheet, ch: list[0].ch, conf: null }]));
    setPicked([m.key]);
  }
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(), s = sheets[view]; return { x: ((e.clientX - r.left) / r.width) * s.w, y: ((e.clientY - r.top) / r.height) * s.h }; };

  async function save() {
    const list = items.filter((i) => i.ch);
    if (!list.length) return toast("Chưa gán ký tự cho mảnh nào.", "err");
    const sb = createClient();
    setBusy("Đang lưu..."); setProgress(0);
    let ok = 0;
    const train: { glyph_id: string; ch: string; vec: number[]; font_id: string }[] = [];
    for (const [i, it] of list.entries()) {
      const c = itemCanvas(sheets[it.sheet], it);
      if (!c) continue;
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) continue;
      let url: string;
      try { url = (await uploadFile("scrapbook", blob, { folder: `cutout/${fontId}`, contentType: "image/png" })).url!; }
      catch (e) { toast("Tải ảnh thất bại: " + (e instanceof Error ? e.message : ""), "err"); break; }
      const ins = await sb.from("cutout_glyphs").insert({ font_id: fontId, ch: it.ch, kind: kindOf(it.ch), url, w: c.width, h: c.height, sort_order: i }).select("id").single();
      if (ins.error) { toast(ins.error.message, "err"); break; }
      // dữ liệu học: vector đặc trưng của mảnh + ký tự admin đã gán
      try { const vec = it.recog?.prep.vec ?? (await prepCanvas(c, true)).vec; train.push({ glyph_id: ins.data.id, ch: it.ch, vec, font_id: fontId }); } catch { /* bỏ qua mảnh lỗi */ }
      ok++; setProgress((i + 1) / list.length);
    }
    if (train.length) { setBusy("Đang cập nhật dữ liệu học..."); try { await addTraining(train); } catch (e) { toast("Chưa lưu được dữ liệu học: " + (e instanceof Error ? e.message : String(e)), "err"); } }
    setBusy("");
    if (ok) { toast(`Đã lưu ${ok} mảnh chữ`); setSheets([]); setItems([]); onDone(); }
  }

  if (!sheets.length) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => fileIn.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); }}
          className="grid w-full place-items-center rounded-[12px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] px-4 py-8 text-center hover:border-[#ff5fa2]">
          <Upload size={20} className="mb-1 text-[#a1a1aa]" />
          <span className="text-[14px] font-medium">{busy || "Kéo thả hoặc bấm để chọn 1 hoặc nhiều ảnh tờ chữ"}</span>
        </button>
        <input ref={fileIn} type="file" multiple accept="image/jpeg,image/png,image/webp,.jfif" className="sr-only" onChange={(e) => { if (e.target.files?.length) addFiles([...e.target.files]); e.target.value = ""; }} />
        <div className="flex gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Hoặc dán link ảnh" className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#e5e5e7] px-3 text-[14px]" />
          <Button variant="secondary" icon={<Link2 size={16} />} onClick={fromLink}>Tải từ link</Button>
        </div>
      </div>
    );
  }
  const low = items.filter((i) => i.conf !== null && needsReview(i)).length;
  return (
    <div className="space-y-3" onKeyDown={onKey}>
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] p-2">
        <Button size="sm" icon={<Wand2 size={14} />} onClick={ocr} disabled={!!busy}>Tự nhận diện (OCR)</Button>
        <input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="Theo thứ tự: ABCDEFGHIJ…" className="h-8 w-56 rounded-[6px] border border-[#e5e5e7] px-2 text-[13px]" />
        <Button size="sm" variant="secondary" onClick={assignOrder}>Gán theo thứ tự</Button>
        <span className="h-5 w-px bg-[#e5e5e7]" />
        <Button size="sm" variant="secondary" icon={<Combine size={14} />} onClick={merge} disabled={picked.length < 2}>Gộp ({picked.length})</Button>
        <button type="button" onClick={() => setRectMode((v) => !v)} title="Tách thủ công: vẽ khung trên ảnh"
          className={cx("inline-flex h-8 items-center gap-1 rounded-[6px] border px-2 text-[12px]", rectMode ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white")}><Square size={13} /> Vẽ khung</button>
        <Button size="sm" variant="secondary" onClick={() => fileIn.current?.click()} icon={<Plus size={14} />}>Thêm tờ</Button>
        <input ref={fileIn} type="file" multiple accept="image/jpeg,image/png,image/webp,.jfif" className="sr-only" onChange={(e) => { if (e.target.files?.length) addFiles([...e.target.files]); e.target.value = ""; }} />
        <span className="ml-auto text-[12px]">{items.filter((i) => i.ch).length} / {items.length} mảnh đã gán{low ? ` · ${low} mảnh cần kiểm tra` : ""}</span>
      </div>
      {busy && <div><p className="text-[12px]">{busy}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]"><div className="h-full bg-[#ff5fa2]" style={{ width: `${progress * 100}%` }} /></div></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div>
          {sheets.length > 1 && <div className="mb-2 flex gap-1">{sheets.map((_, i) => <button key={i} type="button" onClick={() => setView(i)} className={cx("h-7 rounded-full border px-3 text-[12px]", view === i ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-[#e5e5e7]")}>Tờ {i + 1}</button>)}</div>}
          <canvas ref={canvas} className={cx("block h-auto w-full touch-none rounded-[10px] border border-[#e5e5e7]", checker, rectMode ? "cursor-crosshair" : "cursor-pointer")}
            onPointerDown={(e) => {
              const p = pos(e);
              if (rectMode) { e.currentTarget.setPointerCapture(e.pointerId); draw.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; return; }
              const i = items.findIndex((it) => it.sheet === view && p.x >= it.x0 && p.x <= it.x1 && p.y >= it.y0 && p.y <= it.y1);
              if (i >= 0) { setFocus(i); grid.current?.focus(); }
            }}
            onPointerMove={(e) => { if (draw.current) { const p = pos(e); draw.current = { ...draw.current, x1: p.x, y1: p.y }; setPicked((x) => [...x]); } }}
            onPointerUp={() => {
              const d = draw.current; draw.current = null;
              if (!d) return;
              const it = itemFromRect(sheets[view], d, "sticker", items.length + 1);
              if (it) setItems((c) => reading([...c, { ...it, sheet: view, ch: "", conf: null }]));
            }} />
        </div>
        <div>
          <div className="mb-2 flex flex-wrap gap-1">
            <span className="text-[12px] text-[#71717a]">Gán dấu cho mảnh đang chọn:</span>
            {[...TONES, ...DIACRITICS].map((m) => <button key={m.ch} type="button" onClick={() => setMark(m.ch)} className="h-7 rounded-full border border-[#e5e5e7] px-2 text-[11px] hover:border-[#ff5fa2]">{m.name}</button>)}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1">
            {([["all", "Tất cả", items.length], ["review", "Cần kiểm tra", items.filter((i) => (i.conf !== null ? needsReview(i) : !i.ch)).length], ["done", "Đã xác nhận", items.filter((i) => i.confirmed).length]] as const).map(([k, l, n]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={cx("h-7 rounded-full border px-3 text-[12px]", filter === k ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7]")}>{l} ({n})</button>
            ))}
            <button type="button" onClick={togglePrep} className={cx("ml-auto h-7 rounded-full border px-3 text-[12px]", showPrep ? "border-[#2563eb] bg-[#eff6ff] text-[#2563eb]" : "border-[#e5e5e7]")}>Xem bản đã xử lý</button>
          </div>
          <div ref={grid} tabIndex={0} className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto rounded-[10px] p-1 outline-none sm:grid-cols-6">
            {visible.map(({ it, i }) => (
              <div key={it.key} onClick={(e) => { setFocus(i); grid.current?.focus(); if (e.ctrlKey || e.metaKey || e.shiftKey) setPicked((p) => (p.includes(it.key) ? p.filter((k) => k !== it.key) : [...p, it.key])); else setPicked([it.key]); }}
                className={cx("rounded-[8px] border-2 p-1", focus === i ? "border-[#2563eb]" : it.confirmed ? "border-[#86efac]" : it.conf !== null && needsReview(it) ? "border-[#f97316]" : "border-[#e5e5e7]")}>
                <div className={cx("relative grid aspect-square place-items-center overflow-hidden rounded-[4px]", checker, showPrep && preps[it.key] && "grid-cols-2 gap-0.5")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[it.key] && <img src={thumbs[it.key]} alt="" className="max-h-full max-w-full" />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {showPrep && preps[it.key] && <img src={preps[it.key]} alt="Bản đã xử lý" className="max-h-full max-w-full border border-[#e5e5e7] bg-white" />}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setItems((c) => c.filter((x) => x.key !== it.key)); }} aria-label="Xoá mảnh" className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[#dc2626] shadow"><X size={10} /></button>
                </div>
                <input value={it.ch ? charLabel(it.ch) : ""} onChange={(e) => { const v = [...e.target.value].pop() ?? ""; setItems((c) => c.map((x, j) => (j === i ? { ...x, ch: keyToChar(v), conf: 100, confirmed: !!v, unsure: false } : x))); }}
                  onClick={(e) => e.stopPropagation()} placeholder="?" aria-label="Ký tự"
                  className="mt-1 h-6 w-full rounded-[4px] border border-[#e5e5e7] text-center text-[12px] font-semibold" />
                {it.recog && it.recog.cands.length > 0 ? (
                  <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {it.recog.cands.map((c, k) => (
                      <button key={c.ch + k} type="button" title={`Phím ${k + 1}`} onClick={(e) => { e.stopPropagation(); assign(i, c.ch); }}
                        className={cx("rounded-[4px] border px-1 text-[10px] leading-4", it.ch === c.ch ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#ff5fa2]")}>
                        <b>{charLabel(c.ch)}</b> {Math.round(c.score * 100)}%
                      </button>
                    ))}
                  </div>
                ) : it.conf !== null && !it.confirmed && <p className={cx("text-center text-[10px]", needsReview(it) ? "text-[#ea580c]" : "text-[#71717a]")}>{it.conf}%</p>}
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-[#a1a1aa]">Bấm 1 mảnh rồi gõ phím để gán ký tự (phân biệt hoa / thường) — tự nhảy sang mảnh kế tiếp. Phím 1 / 2 / 3 chọn ứng viên gợi ý, Enter xác nhận gợi ý đầu (số 1, 2, 3 thì gõ vào ô bên dưới mảnh). Dấu: ´ sắc · ` huyền · ~ ngã · ^ mũ, hoặc dùng các nút ở trên.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setSheets([]); setItems([]); }}>Huỷ</Button>
        <Button onClick={save} loading={busy === "Đang lưu..."} disabled={!items.some((i) => i.ch)}>Lưu {items.filter((i) => i.ch).length} mảnh đã gán</Button>
      </div>
    </div>
  );
}
