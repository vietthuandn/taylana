"use client";
/* Bàn in → "Xem mockup" của 1 đơn: dùng lại bộ ghép cảnh mẫu hệ thống (lib/mockup/system — như trang Xem Mockup) với ảnh của
   đơn (lấy từ máy, IndexedDB): 3 bố cục Lưới · Chồng · Một (+ chọn món) và các màu nền. Không có 3D. */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { GRADIENTS, paintBackground, type Gradient } from "@/lib/mockup/backgrounds";
import { defaultGlass } from "@/lib/mockup/types";
import { itemsOf, renderSystem, type SystemArrange, type SystemInput, type SystemItem } from "@/lib/mockup/system/compose";
import { loadSprites } from "@/lib/mockup/system/sprites";
import { fileKey, getFile } from "@/lib/printShop/files";
import type { Item, Order, Pack } from "@/lib/printShop/types";
import { cx } from "@/components/admin/styles";

const ARR: [SystemArrange, string][] = [["grid", "Lưới"], ["stack", "Chồng"], ["single", "Một món"]];
const ITEM: Record<SystemItem, string> = { closed: "Hộp đóng", open: "Hộp mở", back: "Mặt sau", booklet: "Booklet", disc: "Mặt đĩa" };
type Img = HTMLImageElement;

/** ảnh của ô (đã xoay theo Bàn in) → canvas dùng như ảnh cho bộ ghép cảnh */
async function imgOf(batch: string, order: string, slot: string, rot: number): Promise<Img | undefined> {
  const f = await getFile(fileKey(batch, order, slot)).catch(() => undefined);
  if (!f) return undefined;
  const b = await createImageBitmap(f.blob).catch(() => null);
  if (!b) return undefined;
  const k = Math.min(1, 1600 / Math.max(b.width, b.height)), sw = rot % 180 !== 0;
  const w = Math.round(b.width * k), h = Math.round(b.height * k);
  const c = document.createElement("canvas"); c.width = sw ? h : w; c.height = sw ? w : h;
  const x = c.getContext("2d")!; x.translate(c.width / 2, c.height / 2); x.rotate((rot * Math.PI) / 180); x.drawImage(b, -w / 2, -h / 2, w, h); b.close();
  return c as unknown as Img;
}

export function MockupModal({ o, pack, batchId, items, onClose }: { o: Order; pack: Pack | null; batchId: string; items: Item[]; onClose: () => void }) {
  const [input, setInput] = useState<SystemInput | null>(null);
  const [arrange, setArrange] = useState<SystemArrange>("grid");
  const [single, setSingle] = useState<SystemItem>("closed");
  const [bg, setBg] = useState<Gradient>(GRADIENTS[0]);
  const [url, setUrl] = useState("");
  useEffect(() => {
    (async () => {
      const get = (s: string) => { const it = items.find((i) => i.slot === s); return it ? imgOf(batchId, o.id, s, it.rot) : Promise.resolve(undefined); };
      const front = pack?.front ?? 0;
      const pages = front >= 4 ? await Promise.all(Array.from({ length: front }, (_, i) => get(`f${i + 1}`))) : [];
      const [f1, f2, b1, b2, d] = await Promise.all([get("f1"), get("f2"), get("b1"), get("b2"), get("d")]);
      setInput({ pack: front >= 4 ? "booklet" : front === 2 ? "combo2" : (pack?.back ?? 0) > 0 ? "combo1" : "box", frontOut: f1, frontIn: f2, backOut: b1, backIn: b2, disc: d, pages });
    })();
  }, [batchId, o.id, pack, items]);
  useEffect(() => {
    if (!input) return;
    let off = false;
    (async () => {
      await loadSprites();
      if (off) return;
      const c = renderSystem(1200, input, { arrange, single, seed: 1, tray: "clear", glass: defaultGlass }, (ctx, w, h) => paintBackground(ctx, w, h, { kind: "gradient", g: bg }));
      if (!off) setUrl(c.toDataURL("image/jpeg", 0.9));
    })();
    return () => { off = true; };
  }, [input, arrange, single, bg]);
  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[13px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[760px] rounded-[14px] bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[15px] font-semibold">Mockup · #{o.seq} {o.username}</p>
          <span className="text-[12px] text-[#a1a1aa]">{pack?.name}</span>
          <button type="button" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-[6px] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="flex aspect-square max-h-[62dvh] w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#f4f4f5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="Mockup" className="h-full w-full object-contain" /> : <span className="text-[13px] text-[#a1a1aa]">Đang dựng mockup…</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {ARR.map(([k, l]) => <button key={k} type="button" onClick={() => setArrange(k)} className={chip(arrange === k)}>{l}</button>)}
          {arrange === "single" && input && <span className="ml-2 flex flex-wrap gap-1.5">{itemsOf(input).map((k) => <button key={k} type="button" onClick={() => setSingle(k)} className={chip(single === k)}>{ITEM[k]}</button>)}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {GRADIENTS.map((g) => <button key={g.id} type="button" onClick={() => setBg(g)} title={g.name} aria-label={g.name} className={cx("h-8 w-8 rounded-full border-2", bg.id === g.id ? "border-[#ff5fa2]" : "border-white ring-1 ring-[#e5e5e7]")} style={{ background: `linear-gradient(${g.angle}deg, ${g.stops.join(", ")})` }} />)}
        </div>
        <p className="mt-2 text-[12px] text-[#a1a1aa]">Ô chưa có ảnh hiện trống trên mockup.</p>
      </div>
    </div>
  );
}
