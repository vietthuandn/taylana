"use client";

/* Cắt đúng khổ — xử lý 100% trên trình duyệt, không upload, không lưu gì.
   Mỗi ảnh nhớ khổ + vị trí cắt riêng. Mặc định "Phủ kín" căn giữa. Xuất JPG đúng khổ, 300 DPI, RGB. */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Maximize, Minimize, Trash2, Upload } from "lucide-react";
import { PRINT_FORMATS, cmToPx, sizeTag, type PrintFormat } from "@/lib/printSpecs";
import { ACCEPT_IMG, LOW_DPI, canvasToJpeg, effectiveDpi, fitScale, loadImage, newCanvas, saveBlob, saveZip, type LoadedImage } from "@/lib/imageTools";
import { Button, Card, Input, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { useLeaveGuard } from "./useLeaveGuard";

// Vị trí cắt trong toạ độ file xuất (px): ảnh phóng theo s, góc trên-trái ở (x, y)
type Crop = { s: number; x: number; y: number };
type Item = LoadedImage & { fmt: PrintFormat; crop: Crop };

const CUSTOM_ID = "custom";
const outSize = (f: PrintFormat) => ({ W: cmToPx(f.w), H: cmToPx(f.h) });
function fitCrop(img: { w: number; h: number }, f: PrintFormat, mode: "cover" | "contain"): Crop {
  const { W, H } = outSize(f);
  const s = fitScale(img.w, img.h, W, H, mode);
  return { s, x: (W - img.w * s) / 2, y: (H - img.h * s) / 2 };
}
const baseName = (n: string) => n.replace(/\.[^.]+$/, "");

export function CropTool() {
  const [fmtId, setFmtId] = useState(PRINT_FORMATS[0].id);
  const [custom, setCustom] = useState({ w: 10, h: 10 });
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  useLeaveGuard(items.length > 0);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const chosenFmt = (): PrintFormat => fmtId === CUSTOM_ID
    ? { id: CUSTOM_ID, label: "Tuỳ chỉnh", w: Math.max(0.5, custom.w || 1), h: Math.max(0.5, custom.h || 1) }
    : PRINT_FORMATS.find((f) => f.id === fmtId)!;
  const cur = items.find((x) => x.id === sel) ?? null;

  async function add(list: File[]) {
    if (!list.length) return;
    const f = chosenFmt();
    const loaded = await Promise.all(list.map(loadImage));
    urls.current.push(...loaded.map((x) => x.url));
    const next = loaded.map((x) => ({ ...x, fmt: f, crop: x.error ? { s: 1, x: 0, y: 0 } : fitCrop(x, f, "cover") }));
    setItems((cur) => [...cur, ...next]);
    if (!sel) setSel(next.find((x) => !x.error)?.id ?? next[0]?.id ?? null);
  }
  const update = (id: string, p: Partial<Item>) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x)));

  // chọn khổ: áp cho ảnh đang sửa (khổ riêng từng ảnh)
  function chooseFormat(id: string) {
    setFmtId(id);
    const f = id === CUSTOM_ID ? { id: CUSTOM_ID, label: "Tuỳ chỉnh", w: Math.max(0.5, custom.w || 1), h: Math.max(0.5, custom.h || 1) } : PRINT_FORMATS.find((x) => x.id === id)!;
    if (cur && !cur.error) update(cur.id, { fmt: f, crop: fitCrop(cur, f, "cover") });
  }
  function applyCustom(w: number, h: number) {
    setCustom({ w, h });
    if (fmtId === CUSTOM_ID && cur && !cur.error && w > 0 && h > 0) {
      const f = { id: CUSTOM_ID, label: "Tuỳ chỉnh", w, h };
      update(cur.id, { fmt: f, crop: fitCrop(cur, f, "cover") });
    }
  }
  function applyAll() {
    const f = cur?.fmt ?? chosenFmt();
    setItems((list) => list.map((x) => (x.error ? x : { ...x, fmt: f, crop: fitCrop(x, f, "cover") })));
    toast(`Đã áp dụng khổ ${f.label} (${sizeTag(f.w, f.h)}) cho tất cả ảnh`);
  }
  // chọn ảnh khác → chip khổ hiện đúng khổ của ảnh đó
  function select(it: Item) {
    setSel(it.id);
    setFmtId(it.fmt.id);
    if (it.fmt.id === CUSTOM_ID) setCustom({ w: it.fmt.w, h: it.fmt.h });
  }

  async function render(it: Item) {
    const { W, H } = outSize(it.fmt);
    const { c, ctx } = newCanvas(W, H);
    ctx.drawImage(it.el, it.crop.x, it.crop.y, it.w * it.crop.s, it.h * it.crop.s);
    return { name: `${baseName(it.name)}_${sizeTag(it.fmt.w, it.fmt.h)}.jpg`, blob: await canvasToJpeg(c) };
  }
  async function downloadOne() {
    if (!cur || cur.error) return;
    setBusy(true);
    try { const f = await render(cur); saveBlob(f.blob, f.name); toast("Đã tải xuống"); }
    catch (e) { toast(e instanceof Error ? e.message : "Xuất file thất bại", "err"); }
    setBusy(false);
  }
  async function downloadAll() {
    const ok = items.filter((x) => !x.error);
    if (!ok.length) return;
    setBusy(true);
    try {
      const files = [];
      for (const it of ok) files.push(await render(it));
      // tên trùng (cùng tên gốc, cùng khổ) → thêm số
      const seen = new Map<string, number>();
      for (const f of files) { const k = seen.get(f.name) ?? 0; seen.set(f.name, k + 1); if (k) f.name = f.name.replace(/\.jpg$/, `-${k + 1}.jpg`); }
      await saveZip(files, `Cat-dung-kho-${files.length}-anh.zip`);
      toast("Đã tải xuống");
    } catch (e) { toast(e instanceof Error ? e.message : "Xuất file thất bại", "err"); }
    setBusy(false);
  }
  function remove(id: string) {
    setItems((list) => list.filter((x) => x.id !== id));
    if (sel === id) setSel(items.find((x) => x.id !== id && !x.error)?.id ?? null);
  }

  const chip = (on: boolean) => cx("h-9 rounded-[8px] border px-[14px] text-[14px] transition-colors",
    on ? "border-[#ff5fa2] bg-[#fff5f9] text-[#ff5fa2] shadow-[inset_0_0_0_0.5px_#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#18181b] hover:border-[#a1a1aa]");

  return (
    <div className="space-y-6">
      <Card title="Khổ in" description="Khung cắt khoá đúng tỉ lệ khổ. Chọn khổ sẽ áp cho ảnh đang sửa.">
        <div className="flex flex-wrap items-center gap-2">
          {PRINT_FORMATS.map((f) => (
            <button key={f.id} type="button" className={chip(fmtId === f.id)} onClick={() => chooseFormat(f.id)}>
              {f.label} {sizeTag(f.w, f.h).replace("x", " × ").replace("cm", " cm")}{f.round ? " (tròn)" : ""}
            </button>
          ))}
          <button type="button" className={chip(fmtId === CUSTOM_ID)} onClick={() => chooseFormat(CUSTOM_ID)}>Tuỳ chỉnh</button>
          {fmtId === CUSTOM_ID && (
            <span className="flex items-center gap-2 text-[13px]">
              <Input type="number" min={0.5} step={0.1} value={custom.w} className="!w-20" onChange={(e) => applyCustom(Number(e.target.value), custom.h)} aria-label="Rộng (cm)" />
              ×
              <Input type="number" min={0.5} step={0.1} value={custom.h} className="!w-20" onChange={(e) => applyCustom(custom.w, Number(e.target.value))} aria-label="Cao (cm)" />
              cm
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* danh sách ảnh */}
        <Card title={`Ảnh (${items.length})`} padded={false}
          actions={items.length > 1 ? <Button variant="ghost" size="sm" onClick={applyAll}>Áp dụng khổ này cho tất cả ảnh</Button> : undefined}>
          <div className="p-4">
            <div onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files)); }}
              className={cx("grid cursor-pointer place-items-center rounded-[12px] border-2 border-dashed px-4 py-6 text-center", over ? "border-[#ff5fa2] bg-[#fff5f9]" : "border-[#d4d4d8] bg-[#fafafa]")}>
              <Upload size={20} className="mb-1 text-[#a1a1aa]" />
              <p className="text-[14px] font-medium">Kéo thả hoặc bấm để chọn ảnh</p>
              <p className="text-[12px] text-[#71717a]">JPG, PNG, WEBP · chọn nhiều file</p>
            </div>
            <input ref={input} type="file" multiple accept={ACCEPT_IMG} className="sr-only"
              onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; add(f); }} />
          </div>
          <ul className="max-h-[520px] divide-y divide-[#efeff1] overflow-y-auto border-t border-[#efeff1]">
            {items.map((it) => {
              const dpi = it.error ? 0 : effectiveDpi(it.crop.s);
              return (
                <li key={it.id}>
                  <div role="button" tabIndex={0} onClick={() => !it.error && select(it)} onKeyDown={(e) => e.key === "Enter" && !it.error && select(it)}
                    className={cx("flex cursor-pointer items-center gap-3 px-4 py-3", sel === it.id ? "bg-[#fff5f9]" : "hover:bg-[#fafafa]")}>
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[6px] bg-[#f4f4f5]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {!it.error && <img src={it.url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#18181b]" title={it.name}>{it.name}</p>
                      {it.error ? <p className="text-[12px] text-[#dc2626]">{it.error}</p> : (
                        <p className="text-[12px] text-[#71717a]">{it.fmt.label} · {sizeTag(it.fmt.w, it.fmt.h)}</p>
                      )}
                      {!it.error && dpi < LOW_DPI && <p className="flex items-center gap-1 text-[12px] text-[#ea580c]"><AlertTriangle size={12} /> Ảnh có thể bị mờ khi in (đang ~{dpi} DPI)</p>}
                    </div>
                    <button type="button" aria-label="Bỏ ảnh" onClick={(e) => { e.stopPropagation(); remove(it.id); }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
                  </div>
                </li>
              );
            })}
            {!items.length && <li className="px-4 py-8 text-center text-[13px] text-[#71717a]">Chưa có ảnh.</li>}
          </ul>
        </Card>

        {/* vùng sửa */}
        <Card title={cur ? cur.name : "Vùng cắt"} description={cur ? `${cur.fmt.label} · ${sizeTag(cur.fmt.w, cur.fmt.h)} · ${outSize(cur.fmt).W} × ${outSize(cur.fmt).H} px` : "Chọn 1 ảnh ở danh sách để chỉnh vị trí cắt."}
          actions={<>
            <Button variant="secondary" size="sm" icon={<Download size={16} />} disabled={!cur || busy} onClick={downloadOne}>Tải ảnh này</Button>
            <Button size="sm" icon={<Download size={16} />} loading={busy} disabled={!items.some((x) => !x.error)} onClick={downloadAll}>Tải tất cả (.zip)</Button>
          </>}>
          {cur && !cur.error ? <Editor key={cur.id + cur.fmt.id + cur.fmt.w + cur.fmt.h} item={cur} onCrop={(crop) => update(cur.id, { crop })} />
            : <div className="grid h-80 place-items-center rounded-[12px] bg-[#fafafa] text-[13px] text-[#a1a1aa]">Chưa chọn ảnh</div>}
        </Card>
      </div>
    </div>
  );
}

// ---------- Khung cắt: kéo để di chuyển, cuộn / thanh trượt để phóng to ----------
function Editor({ item, onCrop }: { item: Item; onCrop: (c: Crop) => void }) {
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 600, h: 420 });
  const drag = useRef<{ x: number; y: number; c: Crop } | null>(null);
  const { W, H } = outSize(item.fmt);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // khung cắt chiếm ~80% vùng sửa
  const k = Math.min((box.w * 0.8) / W, (box.h * 0.8) / H); // px màn hình / px file
  const fw = W * k, fh = H * k, fx = (box.w - fw) / 2, fy = (box.h - fh) / 2;
  const cover = fitScale(item.w, item.h, W, H, "cover");
  const contain = fitScale(item.w, item.h, W, H, "contain");
  const minS = contain * 0.5, maxS = cover * 4;

  function zoomTo(s: number) {
    s = Math.min(maxS, Math.max(minS, s));
    const c = item.crop;
    // giữ nguyên điểm ở giữa khung
    const cx = (W / 2 - c.x) / c.s, cy = (H / 2 - c.y) / c.s;
    onCrop({ s, x: W / 2 - cx * s, y: H / 2 - cy * s });
  }
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomTo(item.crop.s * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  const round = item.fmt.round;
  return (
    <div>
      <div ref={area} className="relative h-[420px] cursor-grab touch-none select-none overflow-hidden rounded-[12px] bg-[#27272a] active:cursor-grabbing sm:h-[480px]"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, c: item.crop }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          onCrop({ ...d.c, x: d.c.x + (e.clientX - d.x) / k, y: d.c.y + (e.clientY - d.y) / k });
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {/* nền trắng của file xuất */}
        <div className="absolute bg-white" style={{ left: fx, top: fy, width: fw, height: fh }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
          style={{ left: fx + item.crop.x * k, top: fy + item.crop.y * k, width: item.w * item.crop.s * k, height: item.h * item.crop.s * k }} />
        {/* làm tối phần ngoài khung cắt */}
        <div className="pointer-events-none absolute border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" style={{ left: fx, top: fy, width: fw, height: fh }}>
          {round && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-dashed border-[#ff5fa2]" />
              <span className="absolute left-1/2 top-1/2 h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[#ff5fa2] bg-black/20" />
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-[#71717a]">Thu phóng</span>
        <input type="range" min={minS} max={maxS} step={(maxS - minS) / 200} value={item.crop.s} onChange={(e) => zoomTo(Number(e.target.value))} className="w-48 accent-[#ff5fa2]" aria-label="Thu phóng" />
        <Button variant="secondary" size="sm" icon={<Minimize size={16} />} onClick={() => onCrop(fitCrop(item, item.fmt, "contain"))}>Vừa khung</Button>
        <Button variant="secondary" size="sm" icon={<Maximize size={16} />} onClick={() => onCrop(fitCrop(item, item.fmt, "cover"))}>Phủ kín</Button>
        {round && <span className="text-[12px] text-[#71717a]">Vòng tròn và lỗ giữa chỉ để xem — file xuất vẫn vuông, nền trắng.</span>}
      </div>
    </div>
  );
}
