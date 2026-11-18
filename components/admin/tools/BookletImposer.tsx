"use client";

/* Dàn trang booklet (đóng gáy giữa) — xử lý 100% trên trình duyệt, không upload, không lưu gì.
   1 chọn số trang → 2 tải ảnh (đọc số trang từ tên file) → 3 sắp xếp → 4 xem trước tờ in → 5 tải về (.zip JPG 300 DPI). */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, ImagePlus, RefreshCw, RotateCcw, Upload, X } from "lucide-react";
import { BOOKLET_PAGE_CM, BOOKLET_SHEET, cmToPx } from "@/lib/printSpecs";
import { impose, sideFileName, sideLabel } from "@/lib/imposition";
import { ACCEPT_IMG, LOW_DPI, canvasToJpeg, drawFit, effectiveDpi, fitScale, loadImage, newCanvas, saveZip, type LoadedImage } from "@/lib/imageTools";
import { Button, Card, Select, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { useLeaveGuard } from "./useLeaveGuard";

type Fit = "cover" | "contain";
const COUNTS = [
  { n: 4, sub: "1 tờ gập đôi · 2 mặt in" },
  { n: 8, sub: "2 tờ lồng nhau · 4 mặt in" },
  { n: 12, sub: "3 tờ lồng nhau · 6 mặt in" },
  { n: 16, sub: "4 tờ lồng nhau · 8 mặt in" },
];
const PAGE_PX = cmToPx(BOOKLET_PAGE_CM);

// Số trang đứng riêng trong tên file: "1.jpg", "trang 02.png", "page-3.jpg", "booklet_4.jpg"
function pageFromName(name: string): number | null {
  const base = name.replace(/\.[^.]+$/, "").toLowerCase();
  const m = base.match(/(?<![a-z0-9])0*(\d{1,3})(?![0-9a-z])/g);
  if (!m) return null;
  const v = Number(m[m.length - 1].replace(/\D/g, ""));
  return v > 0 ? v : null;
}

export function BookletImposer() {
  const [n, setN] = useState<number | null>(null);
  const [pages, setPages] = useState<(LoadedImage | null)[]>([]);
  const [fit, setFit] = useState<Fit>("cover");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const all = useRef<LoadedImage[]>([]);
  useLeaveGuard(pages.some(Boolean));
  useEffect(() => () => all.current.forEach((x) => URL.revokeObjectURL(x.url)), []);
  const track = (list: LoadedImage[]) => { all.current.push(...list); return list; };

  const sides = useMemo(() => (n ? impose(n) : []), [n]);
  const filled = pages.filter(Boolean).length;

  function start(count: number) { setN(count); setPages(Array(count).fill(null)); setModal(true); }
  function reset() {
    if (pages.some(Boolean) && !window.confirm("Xoá hết ảnh và làm lại?")) return;
    all.current.forEach((x) => URL.revokeObjectURL(x.url)); all.current = [];
    setN(null); setPages([]); setFit("cover");
  }
  async function setPageFile(i: number, f: File) {
    const [img] = track([await loadImage(f)]);
    if (img.error) return toast(`${f.name}: ${img.error}`, "err");
    setPages((p) => p.map((x, k) => (k === i ? img : x)));
  }
  function swap(a: number, b: number) {
    if (a === b) return;
    setPages((p) => { const q = [...p]; [q[a], q[b]] = [q[b], q[a]]; return q; });
  }

  async function download() {
    if (!n) return;
    setBusy(true);
    try {
      const W = cmToPx(BOOKLET_SHEET.w), H = cmToPx(BOOKLET_SHEET.h);
      const files: { name: string; blob: Blob }[] = [];
      for (const s of sides) {
        const { c, ctx } = newCanvas(W, H);
        const half = W / 2; // mỗi nửa 12 × 12 cm
        const L = pages[s.left - 1], R = pages[s.right - 1];
        if (L) drawFit(ctx, L.el, 0, 0, half, H, fit);
        if (R) drawFit(ctx, R.el, half, 0, half, H, fit);
        files.push({ name: sideFileName(s), blob: await canvasToJpeg(c) });
      }
      await saveZip(files, `Booklet-${n}-trang.zip`);
      toast("Đã tải xuống");
    } catch (e) { toast(e instanceof Error ? e.message : "Xuất file thất bại", "err"); }
    setBusy(false);
  }

  // ---------- Bước 1 ----------
  if (!n) {
    return (
      <Card title="Bước 1 · Chọn số trang booklet" description="Mỗi trang 12 × 12 cm. Ảnh chỉ xử lý trên máy bạn, không tải lên server.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COUNTS.map((c) => (
            <button key={c.n} type="button" onClick={() => start(c.n)}
              className="rounded-[12px] border border-[#e5e5e7] bg-white p-6 text-left transition-colors hover:border-[#ff5fa2]">
              <p className="text-[28px] font-bold tracking-[-0.02em] text-[#18181b]">{c.n} trang</p>
              <p className="mt-1 text-[13px] text-[#71717a]">{c.sub}</p>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- Bước 3 ---------- */}
      <Card title={`Bước 3 · Sắp xếp ${n} trang`} description="Kéo thả ảnh giữa các ô để đổi chỗ. Ô trống: kéo ảnh vào hoặc bấm để tải lên."
        actions={<>
          <Button variant="secondary" size="sm" icon={<Upload size={16} />} onClick={() => setModal(true)}>Tải nhiều ảnh</Button>
          <Button variant="ghost" size="sm" icon={<RotateCcw size={16} />} onClick={reset}>Làm lại</Button>
        </>}>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[13px]">
          <span className="font-medium">Ảnh không vuông:</span>
          <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
            {(["cover", "contain"] as Fit[]).map((f) => (
              <button key={f} type="button" onClick={() => setFit(f)}
                className={cx("rounded-[6px] px-3 py-1.5 font-medium", fit === f ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]")}>
                {f === "cover" ? "Phủ kín (cắt bớt)" : "Vừa khung (thêm nền trắng)"}
              </button>
            ))}
          </div>
          <span className="text-[#71717a]">{filled}/{n} trang có ảnh</span>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {pages.map((p, i) => <PageCell key={i} no={i + 1} img={p} fit={fit} onFile={(f) => setPageFile(i, f)} onClear={() => setPages((q) => q.map((x, k) => (k === i ? null : x)))} onSwap={(from) => swap(from, i)} />)}
        </ul>
      </Card>

      {/* ---------- Bước 4 ---------- */}
      <Card title="Bước 4 · Xem trước dàn trang in" description="Mỗi tờ in 24 × 12 cm ghép 2 trang. Đường gáy ở giữa chỉ để xem, không in ra.">
        <ul className="grid gap-4 md:grid-cols-2">
          {sides.map((s) => (
            <li key={s.index}>
              <div className="relative grid aspect-[2/1] grid-cols-2 overflow-hidden rounded-[4px] border border-[#e5e5e7] bg-white shadow-sm">
                {[s.left, s.right].map((no) => {
                  const img = pages[no - 1];
                  return (
                    <div key={no} className="relative overflow-hidden bg-white">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt="" className={cx("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")} />
                      ) : <span className="absolute inset-0 grid place-items-center text-[12px] text-[#d4d4d8]">Trống</span>}
                      <span className="absolute bottom-1 left-1 rounded-[4px] bg-black/60 px-1.5 text-[11px] font-semibold text-white">{no}</span>
                    </div>
                  );
                })}
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-[#ff5fa2]/70" />
              </div>
              <p className="mt-2 text-[13px] text-[#3f3f46]">{sideLabel(s)}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* ---------- Bước 5 ---------- */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {filled < n && <p className="mr-auto text-[13px] text-[#b45309]">Còn {n - filled} trang trống — sẽ để trắng khi in.</p>}
        <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={reset}>Làm lại</Button>
        <Button icon={<Download size={16} />} loading={busy} onClick={download}>Tải về ({n / 2} file JPG)</Button>
      </div>

      {modal && <UploadModal n={n} pages={pages} track={track} onClose={() => setModal(false)} onDone={(p) => { setPages(p); setModal(false); }} />}
    </div>
  );
}

// ---------- 1 ô trang ----------
function PageCell({ no, img, fit, onFile, onClear, onSwap }: { no: number; img: LoadedImage | null; fit: Fit; onFile: (f: File) => void; onClear: () => void; onSwap: (from: number) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const dpi = img ? effectiveDpi(fitScale(img.w, img.h, PAGE_PX, PAGE_PX, fit)) : 0;
  return (
    <li draggable={!!img}
      onDragStart={(e) => { e.dataTransfer.setData("text/page", String(no - 1)); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const from = e.dataTransfer.getData("text/page");
        if (from !== "") onSwap(Number(from));
        else if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]);
      }}
      className={cx("group relative aspect-square overflow-hidden rounded-[10px] border bg-white", over ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7]", img && "cursor-grab active:cursor-grabbing")}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.url} alt="" draggable={false} className={cx("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")} />
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="grid h-full w-full place-items-center bg-[#fafafa] text-[#a1a1aa] hover:text-[#ff5fa2]">
          <span className="text-center text-[12px]"><ImagePlus size={20} className="mx-auto mb-1" />Tải ảnh</span>
        </button>
      )}
      <span className="pointer-events-none absolute left-2 top-2 grid h-8 min-w-8 place-items-center rounded-[8px] bg-[#18181b]/80 px-2 text-[18px] font-bold text-white">{no}</span>
      {img && (
        <>
          <button type="button" onClick={onClear} aria-label="Xoá ảnh" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"><X size={14} /></button>
          <button type="button" onClick={() => input.current?.click()} className="absolute bottom-2 right-2 inline-flex h-7 items-center gap-1 rounded-[6px] bg-white/95 px-2 text-[12px] font-medium text-[#18181b] shadow opacity-0 transition-opacity group-hover:opacity-100">
            <RefreshCw size={12} /> Đổi ảnh
          </button>
          {dpi < LOW_DPI && (
            <span className="absolute inset-x-2 bottom-10 flex items-center gap-1 rounded-[6px] bg-[#f97316]/95 px-2 py-1 text-[11px] font-medium leading-tight text-white">
              <AlertTriangle size={12} className="shrink-0" /> Ảnh có thể bị mờ khi in (đang ~{dpi} DPI)
            </span>
          )}
        </>
      )}
      <input ref={input} type="file" accept={ACCEPT_IMG} className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </li>
  );
}

// ---------- Bước 2: modal tải ảnh ----------
function UploadModal({ n, pages, track, onClose, onDone }: {
  n: number; pages: (LoadedImage | null)[]; track: (l: LoadedImage[]) => LoadedImage[];
  onClose: () => void; onDone: (p: (LoadedImage | null)[]) => void;
}) {
  const [assign, setAssign] = useState<(LoadedImage | null)[]>(pages);
  const [pending, setPending] = useState<LoadedImage[]>([]); // cần chọn số trang
  const [errors, setErrors] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function add(list: File[]) {
    if (!list.length) return;
    setLoading(true);
    const imgs = track(await Promise.all(list.map(loadImage)));
    setLoading(false);
    setErrors((e) => [...e, ...imgs.filter((x) => x.error).map((x) => `${x.name}: ${x.error}`)]);
    const next = [...assign];
    const left: LoadedImage[] = [];
    for (const img of imgs.filter((x) => !x.error)) {
      const no = pageFromName(img.name);
      if (no && no <= n && !next[no - 1]) next[no - 1] = img;
      else left.push(img); // không có số, vượt quá n hoặc trùng số
    }
    setAssign(next);
    setPending((p) => [...p, ...left]);
  }
  const empty = assign.map((x, i) => (x ? 0 : i + 1)).filter(Boolean) as number[];
  const extra = Math.max(0, pending.length - empty.length);

  function pickPage(img: LoadedImage, no: number) {
    setAssign((a) => a.map((x, i) => (i === no - 1 ? img : x)));
    setPending((p) => p.filter((x) => x.id !== img.id));
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] bg-white">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#e5e5e7] px-5">
          <p className="text-[16px] font-semibold">Bước 2 · Tải ảnh cho {n} trang</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-[8px] text-[#71717a] hover:bg-[#f4f4f5]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files)); }}
            className={cx("grid cursor-pointer place-items-center rounded-[12px] border-2 border-dashed px-4 py-12 text-center", over ? "border-[#ff5fa2] bg-[#fff5f9]" : "border-[#d4d4d8] bg-[#fafafa]")}>
            <Upload size={24} className="mb-2 text-[#a1a1aa]" />
            <p className="text-[15px] font-medium">{loading ? "Đang đọc ảnh..." : "Kéo thả ảnh vào đây hoặc bấm để chọn"}</p>
            <p className="mt-1 text-[13px] text-[#71717a]">JPG, PNG, WEBP · chọn nhiều file · đặt tên có số trang (1.jpg, trang 02.png, page-3.jpg)</p>
          </div>
          <input ref={input} type="file" multiple accept={ACCEPT_IMG} className="sr-only"
            onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; add(f); }} />

          <p className="mt-4 text-[13px] text-[#3f3f46]">Đã xếp {n - empty.length}/{n} trang.</p>
          {empty.length > 0 && !pending.length && <p className="mt-1 text-[13px] text-[#b45309]">Còn thiếu trang: {empty.join(", ")}</p>}
          {extra > 0 && <p className="mt-1 text-[13px] text-[#b45309]">Có {extra} ảnh dư (nhiều hơn {n} trang) — các ảnh không được xếp sẽ bị bỏ.</p>}
          {errors.map((e) => <p key={e} className="mt-1 text-[13px] text-[#dc2626]">{e}</p>)}

          {pending.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[13px] font-semibold">Cần chọn số trang</p>
              <ul className="space-y-2">
                {pending.map((img) => (
                  <li key={img.id} className="flex items-center gap-3 rounded-[10px] border border-[#e5e5e7] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-12 w-12 shrink-0 rounded-[6px] object-cover" />
                    <span className="min-w-0 flex-1 truncate text-[13px]" title={img.name}>{img.name}</span>
                    <Select className="!w-36" value="" disabled={!empty.length} onChange={(e) => e.target.value && pickPage(img, Number(e.target.value))}>
                      <option value="">{empty.length ? "Chọn trang…" : "Hết trang trống"}</option>
                      {empty.map((no) => <option key={no} value={no}>Trang {no}</option>)}
                    </Select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e5e5e7] px-5 py-4">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={() => onDone(assign)}>Tiếp tục</Button>
        </div>
      </div>
    </div>
  );
}
