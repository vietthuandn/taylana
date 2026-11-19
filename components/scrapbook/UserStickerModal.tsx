"use client";

/* Tải sticker của bạn: PNG trong suốt dùng luôn (cắt sát); ảnh chụp / JPG → xoá nền (giữ vùng lớn nhất) với thanh "Độ nhạy nền",
   cọ xoá / cọ khôi phục; chọn viền trắng (Không / Mảnh / Dày, chỉnh độ dày). Nhiều ảnh → duyệt lần lượt. Chạy hoàn toàn trên máy khách. */
import { useEffect, useRef, useState } from "react";
import { Eraser, Paintbrush, X } from "lucide-react";
import { brush, type Item, type Sheet } from "@/lib/stickerSlicer";
import { cropAlpha, cutCanvas, hasAlpha, readImageData, removeBg, withBorder } from "@/lib/scrapbook/userSticker";
import { Button } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";

const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
type Img = { w: number; h: number; data: Uint8ClampedArray };

export function UserStickerModal({ files, onAdd, onClose }: { files: File[]; onAdd: (png: Blob) => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [img, setImg] = useState<Img | null>(null);
  const [alpha, setAlpha] = useState(false);
  const [tol, setTol] = useState(28);
  const [cut, setCut] = useState<{ sheet: Sheet; item: Item } | null>(null);
  const [tool, setTool] = useState<"erase" | "restore" | null>(null);
  const [border, setBorder] = useState<"none" | "thin" | "thick">("thin");
  const [thick, setThick] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ver, setVer] = useState(0);
  const prev = useRef<HTMLCanvasElement>(null), edit = useRef<HTMLCanvasElement>(null), painting = useRef(false);

  useEffect(() => {
    let off = false;
    setImg(null); setCut(null); setErr(""); setTool(null);
    readImageData(files[i]).then((d) => { if (off) return; setImg(d); setAlpha(hasAlpha(d.data)); }).catch(() => setErr("Không đọc được ảnh này."));
    return () => { off = true; };
  }, [files, i]);
  // xoá nền (ảnh không trong suốt) — chạy lại khi đổi độ nhạy
  useEffect(() => {
    if (!img || alpha) return;
    let off = false;
    setBusy(true);
    const t = setTimeout(() => removeBg(img, tol).then((r) => { if (!off) { setCut(r); setVer((v) => v + 1); if (!r) setErr("Không tách được nền — thử đổi độ nhạy."); else setErr(""); } }).catch(() => setErr("Xoá nền thất bại.")).finally(() => !off && setBusy(false)), 250);
    return () => { off = true; clearTimeout(t); };
  }, [img, alpha, tol]);
  const base = (): HTMLCanvasElement | null => (alpha ? (img ? cropAlpha(img) : null) : cut ? cutCanvas(cut.sheet, cut.item) : null);
  const size = () => { const b = base(); return b ? Math.max(b.width, b.height) : 400; };
  const t = border === "none" ? 0 : (thick || (border === "thin" ? 0.02 : 0.05) * size());
  // xem trước (có viền) + khung sửa (toàn khung bao của vùng, để cọ)
  useEffect(() => {
    const b = base(), c = prev.current;
    if (c) { const out = b ? withBorder(b, t) : null; c.width = out?.width ?? 1; c.height = out?.height ?? 1; const x = c.getContext("2d")!; x.clearRect(0, 0, c.width, c.height); if (out) x.drawImage(out, 0, 0); }
    const e = edit.current;
    if (e && cut && !alpha) {
      const it = cut.item, bw = it.x1 - it.x0 + 1, bh = it.y1 - it.y0 + 1;
      e.width = bw; e.height = bh;
      const x = e.getContext("2d")!, d = x.createImageData(bw, bh);
      for (let y = 0; y < bh; y++) for (let xx = 0; xx < bw; xx++) {
        const s = ((it.y0 + y) * cut.sheet.w + it.x0 + xx) * 4, o = (y * bw + xx) * 4, v = it.mask[y * bw + xx];
        const src = v === 2 ? cut.sheet.orig : cut.sheet.res.rgba;
        d.data[o] = cut.sheet.orig[s]; d.data[o + 1] = cut.sheet.orig[s + 1]; d.data[o + 2] = cut.sheet.orig[s + 2];
        d.data[o + 3] = v ? (v === 2 ? 255 : src[s + 3]) : 40; // phần bị xoá: hiện mờ để cọ khôi phục
      }
      x.putImageData(d, 0, 0);
    }
  }, [cut, ver, alpha, img, border, thick]); // eslint-disable-line react-hooks/exhaustive-deps
  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!painting.current || !tool || !cut) return;
    const r = e.currentTarget.getBoundingClientRect(), it = cut.item, bw = it.x1 - it.x0 + 1;
    const px = it.x0 + ((e.clientX - r.left) / r.width) * bw, py = it.y0 + ((e.clientY - r.top) / r.height) * (it.y1 - it.y0 + 1);
    brush(it, px, py, Math.max(4, bw / 30), tool === "erase" ? 0 : 2);
    setVer((v) => v + 1);
  }
  async function add() {
    const b = base();
    if (!b) return;
    const out = withBorder(b, t);
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
    if (blob) onAdd(blob);
    if (i + 1 < files.length) setI(i + 1); else onClose();
  }
  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[12px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b]");
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#efeff1] px-5 py-3">
          <p className="text-[16px] font-semibold">Tải sticker của bạn {files.length > 1 ? `(${i + 1}/${files.length})` : ""}</p>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </div>
        <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <div>
            {!alpha && cut && (
              <>
                <p className="mb-1 text-[12px] text-[#71717a]">Vùng giữ lại (bôi cọ để sửa)</p>
                <canvas ref={edit} className={cx("block max-h-[300px] w-full touch-none object-contain", checker, tool ? "cursor-crosshair" : "")}
                  onPointerDown={(e) => { if (!tool) return; e.currentTarget.setPointerCapture(e.pointerId); painting.current = true; paint(e); }} onPointerMove={paint} onPointerUp={() => { painting.current = false; }} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setTool(tool === "erase" ? null : "erase")} className={chip(tool === "erase")}><Eraser size={13} className="mr-1 inline" />Cọ xoá</button>
                  <button type="button" onClick={() => setTool(tool === "restore" ? null : "restore")} className={chip(tool === "restore")}><Paintbrush size={13} className="mr-1 inline" />Cọ khôi phục</button>
                </div>
                <label className="mt-3 block text-[12px] text-[#52525b]">Độ nhạy nền ({tol})
                  <input type="range" min={6} max={80} value={tol} onChange={(e) => setTol(Number(e.target.value))} className="w-full accent-[#ff5fa2]" />
                </label>
              </>
            )}
            {alpha && <p className="rounded-[10px] bg-[#f0fdf4] p-3 text-[13px] text-[#15803d]">Ảnh PNG đã có nền trong suốt — dùng luôn, chỉ cắt sát theo khung bao.</p>}
            {busy && <p className="mt-2 text-[12px] text-[#71717a]">Đang xoá nền...</p>}
            {err && <p className="mt-2 text-[12px] text-[#dc2626]">{err}</p>}
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[#71717a]">Xem trước</p>
            <div className={cx("grid h-[260px] place-items-center rounded-[10px] p-3", checker)}><canvas ref={prev} className="max-h-full max-w-full" /></div>
            <p className="mb-1 mt-3 text-[13px] font-medium">Thêm viền trắng?</p>
            <div className="flex flex-wrap gap-1.5">
              {([["none", "Không viền"], ["thin", "Viền mảnh"], ["thick", "Viền dày"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setBorder(k); setThick(0); }} className={chip(border === k)}>{l}</button>)}
            </div>
            {border !== "none" && (
              <label className="mt-2 block text-[12px] text-[#52525b]">Độ dày viền
                <input type="range" min={2} max={Math.max(10, Math.round(size() * 0.1))} value={Math.round(t)} onChange={(e) => setThick(Number(e.target.value))} className="w-full accent-[#ff5fa2]" />
              </label>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#efeff1] px-5 py-3">
          {files.length > 1 && i + 1 < files.length && <Button variant="secondary" onClick={() => setI(i + 1)}>Bỏ qua ảnh này</Button>}
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={add} disabled={busy || !(alpha ? img : cut)}>Thêm vào thiết kế</Button>
        </div>
      </div>
    </div>
  );
}
