"use client";

/* Bộ chọn khung dùng chung (trình sửa mẫu admin + CD Scrapbook + Booklet Scrapbook):
   "Hình dạng cơ bản" (Chữ nhật, Vuông, Tròn, Tim, Polaroid, Giấy xé) · các nhóm theo BỘ KHUNG trong thư viện (chỉ bộ / khung
   đang bật; thumbnail trên nền caro kèm ảnh thử bên trong để thấy vùng ảnh) · tìm theo tên · chip lọc theo bộ · "Không khung".
   mode "decor": chỉ khung PNG (khung trang trí, không chứa ảnh). */
import { useEffect, useMemo, useState } from "react";
import { Circle, Heart, Plus, RectangleHorizontal, Search, Square, X } from "lucide-react";
import { framePreview } from "@/lib/scrapbook/frames";
import type { LoadedFrame } from "@/lib/scrapbook/render";
import { samplePhotos } from "@/lib/scrapbook/samples";
import type { Frame, FrameSet, PhotoShape } from "@/lib/scrapbook/types";
import { cx } from "@/components/ui/styles";

export type FrameChoice = { kind: "none" } | { kind: "shape"; shape: PhotoShape; ratio: number; name: string } | { kind: "frame"; frame: Frame };
export const SHAPES: { shape: PhotoShape; ratio: number; name: string; icon: React.ReactNode }[] = [
  { shape: "rect", ratio: 0.78, name: "Chữ nhật", icon: <RectangleHorizontal size={22} /> },
  { shape: "rect", ratio: 1, name: "Vuông", icon: <Square size={22} /> },
  { shape: "circle", ratio: 1, name: "Tròn", icon: <Circle size={22} /> },
  { shape: "heart", ratio: 1, name: "Tim", icon: <Heart size={22} /> },
  { shape: "polaroid", ratio: 1, name: "Polaroid", icon: <span className="block h-[22px] w-[18px] border-[2.5px] border-b-[6px] border-current" /> },
  { shape: "torn", ratio: 0.8, name: "Giấy xé", icon: <span className="block h-[18px] w-[22px] bg-current [clip-path:polygon(0_8%,20%_0,45%_6%,70%_0,100%_7%,96%_40%,100%_75%,92%_100%,60%_94%,30%_100%,4%_95%,0_60%)]" /> },
];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
/** tên ngắn của hình dạng / khung (danh sách lớp, nút khung hiện tại) */
export const shapeName = (shape: string, ratio = 1) => (shape === "rect" ? (Math.abs(ratio - 1) < 0.02 ? "Vuông" : "Chữ nhật") : SHAPES.find((s) => s.shape === shape)?.name ?? shape);

export function FramePicker({ frames, sets, loaded, current, mode = "photo", allowNone = true, title, onPick, onClose }: {
  frames: Frame[]; sets: FrameSet[]; loaded: Record<string, LoadedFrame | undefined>; current?: string | null;
  mode?: "photo" | "decor"; allowNone?: boolean; title?: string; onPick: (v: FrameChoice) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [set, setSet] = useState("all");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const sample = useMemo(() => samplePhotos()[2], []);
  const active = useMemo(() => sets.filter((s) => s.is_active && frames.some((f) => f.set_id === s.id && f.is_active)), [sets, frames]);
  const list = useMemo(() => frames.filter((f) => f.is_active && active.some((s) => s.id === f.set_id) && (set === "all" || f.set_id === set) && (!q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()))), [frames, active, set, q]);
  useEffect(() => {
    const t = setTimeout(() => {
      const out: Record<string, string> = {};
      for (const f of list) { const lf = loaded[f.id]; if (lf && !thumbs[f.id]) { try { out[f.id] = mode === "photo" ? framePreview(lf, sample) : f.url; } catch { /* bỏ */ } } }
      if (Object.keys(out).length) setThumbs((c) => ({ ...c, ...out }));
    }, 30);
    return () => clearTimeout(t);
  }, [list, loaded, sample, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const chip = (on: boolean) => cx("h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#efeff1] px-5 py-3">
          <p className="text-[16px] font-semibold">{title ?? (mode === "decor" ? "Khung trang trí" : "Chọn khung")}</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-[#71717a] hover:text-[#18181b]"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {mode === "photo" && (
            <section>
              <p className="mb-2 text-[13px] font-medium">Hình dạng cơ bản</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SHAPES.map((s) => (
                  <button key={s.name} type="button" onClick={() => onPick({ kind: "shape", shape: s.shape, ratio: s.ratio, name: s.name })}
                    className="grid h-[72px] place-items-center rounded-[10px] border border-[#e5e5e7] text-[12px] text-[#52525b] hover:border-[#ff5fa2] hover:text-[#ff5fa2]"><span className="grid place-items-center gap-1">{s.icon}{s.name}</span></button>
                ))}
              </div>
            </section>
          )}
          {allowNone && mode === "photo" && <button type="button" onClick={() => onPick({ kind: "none" })} className={cx("h-8 rounded-full border px-4 text-[13px] font-medium", !current ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] hover:border-[#ff5fa2]")}>Không khung</button>}
          {active.length ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-[13px] font-medium">Thư viện khung</p>
                <label className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên..." className="h-8 w-44 rounded-[8px] border border-[#e5e5e7] pl-8 pr-2 text-[13px] outline-none focus:border-[#ff5fa2]" />
                </label>
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                <button type="button" onClick={() => setSet("all")} className={chip(set === "all")}>Tất cả</button>
                {active.map((s) => <button key={s.id} type="button" onClick={() => setSet(s.id)} className={chip(set === s.id)}>{s.name}</button>)}
              </div>
              {active.filter((s) => list.some((f) => f.set_id === s.id)).map((s) => (
                <div key={s.id}>
                  <p className="mb-1 text-[12px] font-medium text-[#52525b]">{s.name}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {list.filter((f) => f.set_id === s.id).map((f) => (
                      <button key={f.id} type="button" onClick={() => onPick({ kind: "frame", frame: f })} title={f.name}
                        className={cx("overflow-hidden rounded-[8px] border text-center", current === f.id ? "border-[#ff5fa2] ring-2 ring-[#ff5fa2]/30" : "border-[#e5e5e7] hover:border-[#ff5fa2]")}>
                        <span className={cx("grid aspect-square place-items-center p-1.5", checker)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumbs[f.id] ?? f.url} alt={f.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                        </span>
                        <span className="block truncate px-1 py-0.5 text-[11px] text-[#52525b]">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!list.length && <p className="text-[13px] text-[#71717a]">Không có khung phù hợp.</p>}
            </section>
          ) : <p className="rounded-[10px] bg-[#fafafa] p-3 text-[13px] text-[#71717a]">Thư viện chưa có khung nào đang bật.</p>}
        </div>
      </div>
    </div>
  );
}

/** "+ Thêm khung ảnh": bước 1 chọn khung (FramePicker) → bước 2 chọn ảnh (ảnh chưa dùng trước, "Tải ảnh mới", "Bỏ qua" = khung trống) */
export function AddFrameFlow({ frames, sets, loaded, photos, used, onDone, onUpload, onClose }: {
  frames: Frame[]; sets: FrameSet[]; loaded: Record<string, LoadedFrame | undefined>;
  photos: { id: string; url: string }[]; used: Set<string>;
  onDone: (c: FrameChoice, photoId: string | null) => void; onUpload: (f: File) => Promise<string | null>; onClose: () => void;
}) {
  const [choice, setChoice] = useState<FrameChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const fileIn = useMemo(() => ({ current: null as HTMLInputElement | null }), []);
  if (!choice) return <FramePicker frames={frames} sets={sets} loaded={loaded} title="Thêm khung ảnh · chọn khung" allowNone={false} onPick={setChoice} onClose={onClose} />;
  const list = [...photos].sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id)));
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#efeff1] px-5 py-3">
          <p className="text-[16px] font-semibold">Thêm khung ảnh · chọn ảnh</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-[#71717a] hover:text-[#18181b]"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            <button type="button" disabled={busy} onClick={() => fileIn.current?.click()} className="grid aspect-square place-items-center rounded-[8px] border-[1.5px] border-dashed border-[#d4d4d8] text-center text-[12px] font-medium text-[#52525b] hover:border-[#ff5fa2] disabled:opacity-50">
              <span><Plus size={16} className="mx-auto mb-1" />{busy ? "Đang tải..." : "Tải ảnh mới"}</span>
            </button>
            {list.map((p) => (
              <button key={p.id} type="button" onClick={() => onDone(choice, p.id)} className="relative aspect-square overflow-hidden rounded-[8px] border border-[#e5e5e7] hover:ring-2 hover:ring-[#ff5fa2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                {used.has(p.id) && <span className="absolute left-1 top-1 rounded-[4px] bg-black/60 px-1 text-[9px] leading-[14px] text-white">Đang dùng</span>}
              </button>
            ))}
          </div>
          <input ref={(el) => { fileIn.current = el; }} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setBusy(true); const id = await onUpload(f); setBusy(false); if (id) onDone(choice, id); }} />
        </div>
        <div className="flex shrink-0 justify-between gap-2 border-t border-[#efeff1] px-5 py-3">
          <button type="button" onClick={() => setChoice(null)} className="h-9 rounded-[8px] border border-[#e5e5e7] px-4 text-[13px] font-medium hover:bg-[#f4f4f5]">Đổi khung</button>
          <button type="button" onClick={() => onDone(choice, null)} className="h-9 rounded-[8px] border border-[#e5e5e7] px-4 text-[13px] font-medium hover:bg-[#f4f4f5]">Bỏ qua (khung trống)</button>
        </div>
      </div>
    </div>
  );
}
