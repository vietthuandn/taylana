"use client";

/* Admin → Quản lý chất liệu → "Tách từ tờ sticker": 1 ảnh tờ sticker → từng món PNG nền trong suốt.
   Xử lý trên trình duyệt (Web Worker, lib/stickerSlicer). Duyệt: bật / tắt từng món, đổi tên / nhóm / tông màu,
   gộp, tách thủ công (vẽ khung / vẽ đường cắt), cọ xoá / khôi phục — rồi lưu các món đã chọn vào bucket "scrapbook". */
import { useCallback, useEffect, useRef, useState } from "react";
import { Brush, Combine, Eraser, Link2, MousePointer2, RotateCcw, Scissors, Square, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/storage/client";
import { brush, itemCanvas, itemFromRect, itemsFromSheet, mergeItems, readSheet, runSlice, splitItem, type Item, type Sheet } from "@/lib/stickerSlicer";
import { ASSET_GROUPS, TONES } from "@/lib/scrapbook/types";
import { Button, Select, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Tool = "select" | "rect" | "split" | "erase" | "restore";
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";

export function SheetSlicer({ onDone }: { onDone: () => void }) {
  const [src, setSrc] = useState<Blob | null>(null);
  const [link, setLink] = useState("");
  const [defGrp, setDefGrp] = useState<string>("auto");
  const [tol, setTol] = useState(24);
  const [minPct, setMinPct] = useState(0.05);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [size, setSize] = useState(12);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [ver, setVer] = useState(0);
  const fileIn = useRef<HTMLInputElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const draw = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const painting = useRef(false);

  // dán từ clipboard (Ctrl + V)
  useEffect(() => {
    const h = (e: ClipboardEvent) => { const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); setSrc(f); } };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, []);
  async function fromLink() {
    if (!/^https?:\/\//i.test(link.trim())) return toast("Link phải bắt đầu bằng https://", "err");
    setBusy("Đang tải ảnh...");
    try {
      const r = await fetch(`/api/img-proxy?url=${encodeURIComponent(link.trim())}`);
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Không tải được ảnh");
      setSrc(await r.blob());
    } catch (e) { toast(e instanceof Error ? e.message : "Không tải được ảnh", "err"); }
    setBusy("");
  }

  // xử lý (Web Worker)
  const process = useCallback(async (blob: Blob) => {
    setBusy("Đang tách sticker...");
    try {
      const img = await readSheet(blob);
      const res = await runSlice(img.data, img.w, img.h, { tolerance: tol, minAreaPct: minPct, close: 3 });
      const s: Sheet = { w: img.w, h: img.h, orig: img.data, res };
      setSheet(s);
      setItems(itemsFromSheet(s, defGrp === "auto" ? null : defGrp));
      setPicked([]);
      if (!res.comps.length) toast("Không tìm thấy món nào — thử tăng “Độ nhạy nền” hoặc giảm “Kích thước nhỏ nhất”.", "err");
    } catch (e) { toast(e instanceof Error ? e.message : "Không đọc được ảnh", "err"); }
    setBusy("");
  }, [tol, minPct, defGrp]);
  useEffect(() => { if (src) process(src); }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // ảnh gốc
  useEffect(() => {
    const c = view.current;
    if (!c || !sheet) return;
    c.width = sheet.w; c.height = sheet.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(sheet.orig), sheet.w, sheet.h), 0, 0);
  }, [sheet]);
  // khung quanh từng món + số thứ tự
  const paintOverlay = useCallback(() => {
    const c = overlay.current;
    if (!c || !sheet) return;
    c.width = sheet.w; c.height = sheet.h;
    const x = c.getContext("2d")!, lw = Math.max(2, sheet.w / 500);
    x.font = `700 ${lw * 9}px Inter, sans-serif`; x.textBaseline = "top";
    items.forEach((it, i) => {
      const on = picked.includes(it.key);
      x.lineWidth = on ? lw * 2 : lw;
      x.strokeStyle = on ? "#2563eb" : it.checked ? "#ff5fa2" : "rgba(120,120,130,0.6)";
      x.setLineDash(it.checked ? [] : [lw * 3, lw * 2]);
      x.strokeRect(it.x0, it.y0, it.x1 - it.x0, it.y1 - it.y0);
      x.setLineDash([]);
      const t = String(i + 1), tw = x.measureText(t).width + lw * 4;
      x.fillStyle = it.checked ? "#ff5fa2" : "#a1a1aa"; x.fillRect(it.x0, it.y0, tw, lw * 12);
      x.fillStyle = "#fff"; x.fillText(t, it.x0 + lw * 2, it.y0 + lw * 1.5);
    });
    const d = draw.current;
    if (d) {
      x.strokeStyle = "#2563eb"; x.lineWidth = lw * 1.5; x.setLineDash([lw * 4, lw * 3]);
      if (tool === "rect") x.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      if (tool === "split") { x.beginPath(); x.moveTo(d.x0, d.y0); x.lineTo(d.x1, d.y1); x.stroke(); }
    }
  }, [sheet, items, picked, tool]);
  useEffect(() => { paintOverlay(); }, [paintOverlay]);

  // thumbnail từng món
  useEffect(() => {
    if (!sheet) return;
    const t = setTimeout(() => {
      const out: Record<string, string> = {};
      for (const it of items) { const c = itemCanvas(sheet, it); if (c) out[it.key] = c.toDataURL("image/png"); }
      setThumbs(out);
    }, 60);
    return () => clearTimeout(t);
  }, [sheet, items, ver]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * sheet!.w, y: ((e.clientY - r.top) / r.height) * sheet!.h }; };
  const one = items.find((i) => i.key === picked[0]) ?? null;
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!sheet) return;
    const p = pos(e);
    if (tool === "select") {
      const hit = [...items].reverse().find((it) => p.x >= it.x0 && p.x <= it.x1 && p.y >= it.y0 && p.y <= it.y1);
      if (hit) setItems((c) => c.map((i) => (i.key === hit.key ? { ...i, checked: !i.checked } : i)));
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "erase" || tool === "restore") {
      if (!one) return toast("Bấm chọn 1 món ở danh sách bên phải trước.", "err");
      painting.current = true; brush(one, p.x, p.y, size, tool === "erase" ? 0 : 2); setVer((v) => v + 1); return;
    }
    if (tool === "split" && !one) return toast("Bấm chọn 1 món ở danh sách bên phải để chia đôi.", "err");
    draw.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!sheet) return;
    const p = pos(e);
    if (painting.current && one) { brush(one, p.x, p.y, size, tool === "erase" ? 0 : 2); setVer((v) => v + 1); return; }
    if (draw.current) { draw.current = { ...draw.current, x1: p.x, y1: p.y }; paintOverlay(); }
  }
  function up() {
    painting.current = false;
    const d = draw.current;
    draw.current = null;
    if (!d || !sheet) { paintOverlay(); return; }
    if (tool === "rect") {
      const it = itemFromRect(sheet, d, defGrp === "auto" ? "sticker" : defGrp, items.length + 1);
      if (it) { setItems((c) => [...c, it]); setPicked([it.key]); }
    } else if (tool === "split" && one && Math.hypot(d.x1 - d.x0, d.y1 - d.y0) > 4) {
      const [a, b] = splitItem(one, { x: d.x0, y: d.y0 }, { x: d.x1, y: d.y1 });
      setItems((c) => c.flatMap((i) => (i.key === one.key ? [a, b] : [i])));
      setPicked([a.key]);
    }
    paintOverlay();
  }
  function merge() {
    if (!sheet || picked.length < 2) return;
    const list = items.filter((i) => picked.includes(i.key));
    const m = mergeItems(sheet, list);
    setItems((c) => [...c.filter((i) => !picked.includes(i.key)), m]);
    setPicked([m.key]);
  }
  const patch = (key: string, v: Partial<Item>) => setItems((c) => c.map((i) => (i.key === key ? { ...i, ...v } : i)));

  async function saveAll() {
    if (!sheet) return;
    const list = items.filter((i) => i.checked);
    if (!list.length) return toast("Chưa chọn món nào.", "err");
    const sb = createClient();
    setBusy("Đang lưu..."); setProgress(0);
    let ok = 0;
    for (const [i, it] of list.entries()) {
      const c = itemCanvas(sheet, it);
      if (!c) continue;
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) continue;
      let url: string;
      try { url = (await uploadFile("scrapbook", blob, { folder: it.grp, contentType: "image/png" })).url!; }
      catch (e) { toast("Tải ảnh thất bại: " + (e instanceof Error ? e.message : ""), "err"); break; }
      const ins = await sb.from("scrapbook_assets").insert({ name: it.name.trim() || `Sticker ${i + 1}`, grp: it.grp, tone: it.tone, url, sort_order: Date.now() % 1e6 + i });
      if (ins.error) { toast(ins.error.message, "err"); break; }
      ok++;
      setProgress((i + 1) / list.length);
    }
    setBusy("");
    if (ok) { toast(`Đã lưu ${ok} món`); onDone(); }
  }

  if (!sheet) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="mb-1 block text-[13px] font-medium">Nhóm mặc định cho cả tờ</span>
            <Select value={defGrp} onChange={(e) => setDefGrp(e.target.value)} className="w-56">
              <option value="auto">Tự đoán (dài → băng dính)</option>
              {ASSET_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </label>
        </div>
        <button type="button" onClick={() => fileIn.current?.click()} onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setSrc(f); }}
          className="grid w-full place-items-center rounded-[12px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] px-4 py-10 text-center hover:border-[#ff5fa2]">
          <Upload size={22} className="mb-1 text-[#a1a1aa]" />
          <span className="text-[14px] font-medium">{busy || "Kéo thả, bấm để chọn, hoặc Ctrl + V để dán ảnh tờ sticker"}</span>
          <span className="text-[12px] text-[#71717a]">JPG, PNG, WEBP, JFIF · ảnh lớn được thu nhỏ còn 4000px · xử lý ngay trên trình duyệt</span>
        </button>
        <input ref={fileIn} type="file" accept="image/jpeg,image/png,image/webp,.jfif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setSrc(f); }} />
        <div className="flex gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Hoặc dán link ảnh (tối đa 15MB)" className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
          <Button variant="secondary" icon={<Link2 size={16} />} onClick={fromLink} disabled={!!busy}>Tải từ link</Button>
        </div>
      </div>
    );
  }

  const checked = items.filter((i) => i.checked).length;
  const tools: [Tool, string, React.ReactNode][] = [["select", "Chọn / bỏ món", <MousePointer2 key="s" size={15} />], ["rect", "Tách thủ công: vẽ khung", <Square key="r" size={15} />], ["split", "Chia đôi: vẽ đường cắt", <Scissors key="c" size={15} />], ["erase", "Cọ xoá", <Eraser key="e" size={15} />], ["restore", "Cọ khôi phục", <Brush key="b" size={15} />]];
  return (
    <div className="space-y-3">
      {/* công cụ */}
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] p-2">
        <label className="flex items-center gap-2 text-[12px]">Độ nhạy nền <input type="range" min={4} max={90} value={tol} onChange={(e) => setTol(Number(e.target.value))} className="w-28 accent-[#ff5fa2]" /> <span className="w-6 tabular-nums">{tol}</span></label>
        <label className="flex items-center gap-2 text-[12px]">Kích thước nhỏ nhất <input type="range" min={0.005} max={1} step={0.005} value={minPct} onChange={(e) => setMinPct(Number(e.target.value))} className="w-28 accent-[#ff5fa2]" /> <span className="w-12 tabular-nums">{minPct.toFixed(3)}%</span></label>
        <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => src && process(src)} disabled={!!busy}>Dò lại</Button>
        <span className="h-5 w-px bg-[#e5e5e7]" />
        {tools.map(([k, t, ic]) => (
          <button key={k} type="button" onClick={() => setTool(k)} title={t} aria-label={t}
            className={cx("grid h-8 w-8 place-items-center rounded-[6px] border", tool === k ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b]")}>{ic}</button>
        ))}
        {(tool === "erase" || tool === "restore") && <label className="flex items-center gap-2 text-[12px]">Cỡ cọ <input type="range" min={2} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24 accent-[#ff5fa2]" /></label>}
        <Button size="sm" variant="secondary" icon={<Combine size={14} />} onClick={merge} disabled={picked.length < 2}>Gộp ({picked.length})</Button>
        <span className="ml-auto text-[13px] font-medium">Đã chọn {checked} / {items.length} món</span>
      </div>
      <p className="text-[12px] text-[#71717a]">
        Bấm khung trên ảnh để bật / tắt món. Bấm thẻ bên phải để chọn món (giữ Ctrl / Shift để chọn nhiều → Gộp). Chia đôi / cọ sửa áp dụng cho món đang chọn.
      </p>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* ảnh gốc + khung */}
        <div className={cx("relative overflow-hidden rounded-[10px] border border-[#e5e5e7]", checker)}>
          <canvas ref={view} className="block h-auto w-full" />
          <canvas ref={overlay} className={cx("absolute inset-0 h-full w-full touch-none", tool === "select" ? "cursor-pointer" : "cursor-crosshair")}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          {busy && <div className="absolute inset-0 grid place-items-center bg-white/70 text-[14px] font-medium">{busy}</div>}
        </div>
        {/* các món đã tách */}
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((it, i) => (
              <li key={it.key} onClick={(e) => setPicked((p) => (e.ctrlKey || e.metaKey || e.shiftKey ? (p.includes(it.key) ? p.filter((k) => k !== it.key) : [...p, it.key]) : p[0] === it.key && p.length === 1 ? [] : [it.key]))}
                className={cx("rounded-[10px] border p-1.5", picked.includes(it.key) ? "border-[#2563eb] ring-2 ring-[#2563eb]/25" : "border-[#e5e5e7]", !it.checked && "opacity-50")}>
                <div className={cx("relative grid aspect-square place-items-center overflow-hidden rounded-[6px]", checker)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[it.key] && <img src={thumbs[it.key]} alt="" className="max-h-full max-w-full object-contain" />}
                  <span className="absolute left-1 top-1 rounded-[4px] bg-black/70 px-1 text-[10px] font-semibold text-white">{i + 1}</span>
                  <input type="checkbox" checked={it.checked} onClick={(e) => e.stopPropagation()} onChange={(e) => patch(it.key, { checked: e.target.checked })} aria-label="Chọn món" className="absolute right-1 top-1 h-4 w-4 accent-[#ff5fa2]" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setItems((c) => c.filter((x) => x.key !== it.key)); }} aria-label="Xoá món" className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[#dc2626] shadow"><X size={12} /></button>
                </div>
                <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                  <input value={it.name} onChange={(e) => patch(it.key, { name: e.target.value })} className="h-7 w-full rounded-[6px] border border-[#e5e5e7] px-1.5 text-[12px]" aria-label="Tên" />
                  <div className="flex gap-1">
                    <select value={it.grp} onChange={(e) => patch(it.key, { grp: e.target.value })} className="h-7 min-w-0 flex-1 rounded-[6px] border border-[#e5e5e7] text-[11px]" aria-label="Nhóm">
                      {ASSET_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name.split(" (")[0]}</option>)}
                    </select>
                    <select value={it.tone} onChange={(e) => patch(it.key, { tone: e.target.value })} className="h-7 min-w-0 flex-1 rounded-[6px] border border-[#e5e5e7] text-[11px]" aria-label="Tông màu">
                      {TONES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {busy === "Đang lưu..." && <div className="h-2 overflow-hidden rounded-full bg-[#f4f4f5]"><div className="h-full bg-[#ff5fa2] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => { setSheet(null); setItems([]); setSrc(null); }}>Chọn ảnh khác</Button>
        <Button onClick={saveAll} loading={busy === "Đang lưu..."} disabled={!checked}>Lưu các món đã chọn ({checked})</Button>
      </div>
    </div>
  );
}
