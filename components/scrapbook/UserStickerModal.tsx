"use client";

/* Tải sticker của bạn: PNG có vùng trong suốt → dùng luôn alpha (bỏ qua mô hình). Ảnh chụp / JPG → tách nền:
   "Tự động (AI)" (MODNet nếu có người, không thì U²-Netp) · "Chân dung" · "Đồ vật" · "Nền trơn" (dò màu nền cũ, cho tờ sticker / nền trắng).
   Mô hình chạy trên trình duyệt (lib/bgRemoval, Web Worker), chỉ tải lần đầu. Chỉnh: độ cứng mép + làm mềm mép (AI) / độ nhạy nền
   (Nền trơn), giữ nhiều vật, cọ xoá / cọ khôi phục (lấy lại pixel gốc) có chỉnh cỡ cọ, viền trắng kiểu sticker bế.
   Bố cục: 2 khung cùng cao 320px (ảnh co vừa, căn giữa, không tràn), điều khiển nằm dưới khung, thanh nút dính đáy. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Loader2, Paintbrush, X } from "lucide-react";
import { clearBgCache, removeBackground, type BgStep } from "@/lib/bgRemoval";
import { composeSticker, keptView, refineAlpha } from "@/lib/bgRemoval/post";
import { flatAlpha, hasAlpha, readImageData, withBorder } from "@/lib/scrapbook/userSticker";
import { Button } from "@/components/ui/kit";
import { cx } from "@/components/ui/styles";

const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
type Img = { w: number; h: number; data: Uint8ClampedArray };
type Method = "auto" | "portrait" | "object" | "flat";
type Raw = { alpha: Uint8Array; color?: Uint8ClampedArray; used?: string; ai: boolean };
const METHODS: [Method, string][] = [["auto", "Tự động (AI)"], ["portrait", "Chân dung"], ["object", "Đồ vật"], ["flat", "Nền trơn"]];
const MB = (b: number) => Math.max(0, Math.round(b / 1024 / 1024));

/** initialBorder / okLabel: dùng lại làm modal "Xoá nền" cho ảnh tự do (mặc định không viền — viền chỉnh riêng ở nút "Viền") */
export function UserStickerModal({ files, onAdd, onClose, initialBorder = "thin", okLabel = "Thêm vào thiết kế" }: { files: File[]; onAdd: (png: Blob) => void; onClose: () => void; initialBorder?: "none" | "thin" | "thick"; okLabel?: string }) {
  const [i, setI] = useState(0);
  const [img, setImg] = useState<Img | null>(null);
  const [alphaImg, setAlphaImg] = useState(false);
  const [method, setMethod] = useState<Method>("auto");
  const [raw, setRaw] = useState<Raw | null>(null);
  const [status, setStatus] = useState<BgStep | { k: "idle" }>({ k: "idle" });
  const [aiFail, setAiFail] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [err, setErr] = useState("");
  const [tol, setTol] = useState(28);
  const [hard, setHard] = useState(0.5);
  const [feather, setFeather] = useState(1);
  const [keepMany, setKeepMany] = useState(false);
  const [tool, setTool] = useState<"erase" | "restore" | null>(null);
  const [brushPct, setBrushPct] = useState(3);
  const [border, setBorder] = useState<"none" | "thin" | "thick">(initialBorder);
  const [thick, setThick] = useState(0);
  const [ver, setVer] = useState(0);
  const edits = useRef<Uint8Array | null>(null);
  const editCv = useRef<HTMLCanvasElement>(null), prevCv = useRef<HTMLCanvasElement>(null), painting = useRef(false), raf = useRef(0);

  // đọc ảnh (giữ tối đa cạnh dài 2048px — mặt nạ áp lên ảnh gốc này)
  useEffect(() => {
    let off = false;
    setImg(null); setRaw(null); setErr(""); setTool(null);
    readImageData(files[i]).then((d) => { if (off) return; edits.current = new Uint8Array(d.w * d.h); setImg(d); setAlphaImg(hasAlpha(d.data)); }).catch(() => setErr("Không đọc được ảnh này."));
    return () => { off = true; };
  }, [files, i]);
  // tách nền theo cách đã chọn
  useEffect(() => {
    if (!img) return;
    let off = false;
    if (alphaImg) { const a = new Uint8Array(img.w * img.h); for (let k = 0; k < a.length; k++) a[k] = img.data[k * 4 + 3]; setRaw({ alpha: a, ai: false }); return; }
    setErr("");
    const t = setTimeout(async () => {
      try {
        if (method === "flat") {
          setStatus({ k: "run" });
          const r = await flatAlpha(img, tol, keepMany);
          if (off) return;
          if (!r.found) setErr("Không tách được nền — thử đổi độ nhạy hoặc dùng AI.");
          setRaw({ alpha: r.alpha, color: r.color, ai: false });
        } else {
          setAiFail("");
          // tải (MB) → khởi động → tách nền; mỗi bước có thời hạn (lib/bgRemoval)
          const r = await removeBackground(img, method, (st) => { if (!off) setStatus(st); });
          if (off) return;
          setRaw({ alpha: r.alpha, used: r.used, ai: true });
        }
      } catch (e) {
        if (off) return;
        if (method === "flat") setErr("Xoá nền thất bại.");
        else setAiFail(e instanceof Error ? e.message : "Lỗi");
      } finally { if (!off) setStatus({ k: "idle" }); }
    }, method === "flat" ? 250 : 0);
    return () => { off = true; clearTimeout(t); };
  }, [img, alphaImg, method, tol, keepMany, attempt]);

  // mặt nạ cuối (AI: độ cứng mép + làm mềm + giữ vùng lớn nhất / nhiều vật)
  const alpha = useMemo(() => (!raw || !img ? null : raw.ai ? refineAlpha(raw.alpha, img.w, img.h, { hardness: hard, feather, keepMany }) : raw.alpha), [raw, img, hard, feather, keepMany]);
  const result = useMemo(() => (img && alpha ? composeSticker(img, alpha, edits.current, { defringe: !!raw?.ai, color: raw?.color }) : null), [img, alpha, raw, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const longSide = result ? Math.max(result.width, result.height) : 400;
  const t = border === "none" ? 0 : thick || (border === "thin" ? 0.02 : 0.05) * longSide;
  const preview = useMemo(() => (result ? withBorder(result, t) : null), [result, t]);
  useEffect(() => {
    const c = prevCv.current;
    if (!c) return;
    c.width = preview?.width ?? 1; c.height = preview?.height ?? 1;
    const x = c.getContext("2d")!; x.clearRect(0, 0, c.width, c.height); if (preview) x.drawImage(preview, 0, 0);
  }, [preview]);
  const drawKept = () => {
    const c = editCv.current;
    if (!c || !img || !alpha) return;
    if (c.width !== img.w || c.height !== img.h) { c.width = img.w; c.height = img.h; }
    c.getContext("2d")!.putImageData(keptView(img, alpha, edits.current), 0, 0);
  };
  useEffect(drawKept, [img, alpha, ver]); // eslint-disable-line react-hooks/exhaustive-deps

  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!painting.current || !tool || !img || !edits.current) return;
    const r = e.currentTarget.getBoundingClientRect(), cx0 = ((e.clientX - r.left) / r.width) * img.w, cy0 = ((e.clientY - r.top) / r.height) * img.h;
    const R = Math.max(2, (brushPct / 100) * Math.max(img.w, img.h)), v = tool === "erase" ? 1 : 2, E = edits.current;
    for (let y = Math.max(0, Math.floor(cy0 - R)); y <= Math.min(img.h - 1, Math.ceil(cy0 + R)); y++)
      for (let x = Math.max(0, Math.floor(cx0 - R)); x <= Math.min(img.w - 1, Math.ceil(cx0 + R)); x++)
        if ((x - cx0) ** 2 + (y - cy0) ** 2 <= R * R) E[y * img.w + x] = v;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(drawKept);
  }
  async function add() {
    if (!preview) return;
    const blob = await new Promise<Blob | null>((res) => preview.toBlob(res, "image/png"));
    if (blob) onAdd(blob);
    if (i + 1 < files.length) setI(i + 1); else onClose();
  }
  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[12px] font-medium", on ? "border-[var(--c-primary)] bg-[var(--c-secondary)] text-[var(--c-primary)]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  const busy = status.k !== "idle";
  const busyText = status.k === "load" ? (status.cached ? "Đang tải bộ tách nền..." : `Đang tải (${MB(status.loaded)} / ${MB(status.total)}MB)`)
    : status.k === "init" ? "Đang khởi động" : "Đang tách nền";
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#efeff1] px-5 py-3">
          <p className="text-[16px] font-semibold">Tải sticker của bạn {files.length > 1 ? `(${i + 1}/${files.length})` : ""}</p>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alphaImg ? <p className="mb-3 rounded-[10px] bg-[#f0fdf4] p-3 text-[13px] text-[#15803d]">Ảnh PNG đã có nền trong suốt — dùng luôn, chỉ cắt sát theo khung bao.</p> : (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] font-medium">Cách tách nền</span>
              {METHODS.map(([k, l]) => <button key={k} type="button" disabled={busy} onClick={() => setMethod(k)} className={chip(method === k)}>{l}</button>)}
              {raw?.used && method === "auto" && <span className="text-[12px] text-[#71717a]">· đã dùng {raw.used === "portrait" ? "Chân dung" : "Đồ vật"}</span>}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {/* trái: vùng giữ lại + sửa tay */}
            <div className="min-w-0">
              <Box busy={busy} text={busyText} label="Vùng giữ lại (phần mờ là phần bị bỏ — bôi cọ để sửa)">
                <canvas ref={editCv} className={cx("block h-auto max-h-full w-auto max-w-full touch-none", tool ? "cursor-crosshair" : "")}
                  onPointerDown={(e) => { if (!tool) return; e.currentTarget.setPointerCapture(e.pointerId); painting.current = true; paint(e); }}
                  onPointerMove={paint} onPointerUp={() => { if (painting.current) { painting.current = false; setVer((v) => v + 1); } }} />
              </Box>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setTool(tool === "erase" ? null : "erase")} className={chip(tool === "erase")}><Eraser size={13} className="mr-1 inline" />Cọ xoá</button>
                  <button type="button" onClick={() => setTool(tool === "restore" ? null : "restore")} className={chip(tool === "restore")}><Paintbrush size={13} className="mr-1 inline" />Cọ khôi phục</button>
                  <button type="button" onClick={() => { if (img) { edits.current = new Uint8Array(img.w * img.h); setVer((v) => v + 1); } }} className="text-[12px] text-[#71717a] hover:text-[#18181b]">Bỏ sửa tay</button>
                </div>
                <Range label="Cỡ cọ" value={brushPct} min={0.5} max={10} step={0.5} unit="%" onChange={setBrushPct} />
                {!alphaImg && method === "flat" && <Range label="Độ nhạy nền" value={tol} min={6} max={80} step={1} unit="" onChange={setTol} />}
                {!alphaImg && method !== "flat" && (
                  <>
                    <Range label="Độ cứng mép" value={Math.round(hard * 100)} min={0} max={100} step={5} unit="%" onChange={(v) => setHard(v / 100)} />
                    <Range label="Làm mềm mép" value={feather} min={0} max={4} step={1} unit="px" onChange={setFeather} />
                  </>
                )}
                {!alphaImg && <label className="flex items-center gap-2 text-[13px] text-[#3f3f46]"><input type="checkbox" checked={keepMany} onChange={(e) => setKeepMany(e.target.checked)} className="h-4 w-4 accent-[var(--c-primary)]" /> Giữ nhiều vật</label>}
              </div>
            </div>
            {/* phải: xem trước (đã tính viền trắng khi co cho vừa khung) */}
            <div className="min-w-0">
              <Box busy={busy} text={busyText} label="Xem trước">
                <canvas ref={prevCv} className="block h-auto max-h-full w-auto max-w-full" />
              </Box>
              <div className="mt-3 space-y-2">
                <p className="text-[13px] font-medium">Thêm viền trắng?</p>
                <div className="flex flex-wrap gap-1.5">
                  {([["none", "Không viền"], ["thin", "Viền mảnh"], ["thick", "Viền dày"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setBorder(k); setThick(0); }} className={chip(border === k)}>{l}</button>)}
                </div>
                {border !== "none" && <Range label="Độ dày viền" value={Math.round(t)} min={2} max={Math.max(10, Math.round(longSide * 0.1))} step={1} unit="px" onChange={setThick} />}
              </div>
              {err && <p className="mt-3 text-[12px] text-[#dc2626]">{err}</p>}
              {aiFail && method !== "flat" && !alphaImg && (
                <div className="mt-3 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] p-3">
                  <p className="text-[13px] font-medium text-[#b91c1c]">Không tách nền được trên thiết bị này.</p>
                  <p className="mt-0.5 text-[11px] text-[#71717a]">{aiFail}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>Thử lại</Button>
                    <Button size="sm" variant="secondary" onClick={async () => { await clearBgCache(); setAttempt((a) => a + 1); }}>Xoá bộ nhớ đệm và thử lại</Button>
                    <Button size="sm" onClick={() => { setAiFail(""); setMethod("flat"); }}>Dùng cách Nền trơn</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-[#efeff1] bg-white px-5 py-3">
          {files.length > 1 && i + 1 < files.length && <Button variant="secondary" onClick={() => setI(i + 1)}>Bỏ qua ảnh này</Button>}
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={add} disabled={busy || !preview}>{okLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function Box({ children, label, busy, text }: { children: React.ReactNode; label: string; busy: boolean; text: string }) {
  return (
    <div>
      <p className="mb-1 truncate text-[12px] text-[#71717a]">{label}</p>
      <div className={cx("relative flex h-[320px] items-center justify-center overflow-hidden rounded-[10px] border border-[#e5e5e7] p-2", checker)}>
        {children}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/75 text-center text-[13px] font-medium text-[#3f3f46]">
            <span className="px-4"><Loader2 size={22} className="mx-auto mb-2 animate-spin text-[var(--c-primary)]" />{text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
function Range({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block text-[12px] text-[#52525b]">
      <span className="flex justify-between">{label}<span className="tabular-nums">{value}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--c-primary)]" />
    </label>
  );
}
