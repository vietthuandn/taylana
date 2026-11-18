"use client";

/* Mẫu hệ thống — ghép cảnh: bố cục tự động theo gói (Lưới · Xếp chồng · Một món), bóng đổ 2 lớp, grain 3%.
   Canvas vuông, đồ vật căn giữa, lề ~10%, cùng 1 tỉ lệ px/mm. Xoay nhẹ −4°…4° cố định theo seed.
   Mỗi đồ vật vẽ sẵn 1 lần ra canvas phụ (cache theo ảnh + tỉ lệ), chỉ vẽ lại khi ảnh tương ứng đổi. */
import type { GlassSettings, TrayStyle } from "@/lib/mockup/types";
import { CASE_H, CASE_W, COVER, DISC_R, drawBack, drawClosed, drawDisc, drawFan, drawOpen, drawSpread, idOf, type Src } from "./objects";

export type SystemPack = "box" | "combo1" | "combo2" | "booklet";
export type SystemArrange = "grid" | "stack" | "single";
export type SystemItem = "closed" | "open" | "back" | "booklet" | "disc";
export type SystemInput = {
  pack: SystemPack; frontOut?: Src; frontIn?: Src; backOut?: Src; backIn?: Src; disc?: Src; pages: Src[];
};
export type SystemOptions = { arrange: SystemArrange; single: SystemItem; seed: number; tray: TrayStyle; glass: GlassSettings };

/** Các món có trong gói (cho chip "Một món") */
export function itemsOf(inp: SystemInput): SystemItem[] {
  const out: SystemItem[] = ["closed", "open"];
  if (inp.pack !== "box") out.push("back");
  if (inp.pack === "booklet") out.push("booklet");
  out.push("disc");
  return out;
}

// số ngẫu nhiên cố định theo seed
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type Kind = "closed" | "open" | "openBare" | "back" | "spread" | "fan" | "disc";
const SIZE: Record<Kind, [number, number]> = {
  closed: [CASE_W, CASE_H], open: [CASE_W * 2, CASE_H], openBare: [CASE_W * 2, CASE_H], back: [CASE_W, CASE_H],
  spread: [COVER * 2, COVER + 4], fan: [COVER * 1.5, COVER * 1.32], disc: [DISC_R * 2, DISC_R * 2],
};
// đồ vật đặt trong cảnh (đơn vị mm, tâm so với tâm cảnh)
type Placed = { kind: Kind; x: number; y: number; rot: number };

// ---------- cache canvas từng đồ vật ----------
const cache = new Map<string, HTMLCanvasElement>();
function objectCanvas(kind: Kind, s: number, inp: SystemInput, o: SystemOptions) {
  const g = `${o.glass.strength}|${o.glass.angle}`;
  const key = [kind, s.toFixed(3), o.tray, g, idOf(inp.frontOut), idOf(inp.frontIn), idOf(inp.backOut), idOf(inp.backIn), idOf(inp.disc), inp.pages.map(idOf).join(",")].join("|");
  let c = cache.get(key);
  if (c) return c;
  switch (kind) {
    case "closed": c = drawClosed(s, inp.frontOut, inp.disc, o.glass); break;
    case "back": c = drawBack(s, inp.backOut, o.glass); break;
    case "open": c = drawOpen(s, inp.frontIn, inp.backIn, inp.disc, o.tray, o.glass, true); break;
    case "openBare": c = drawOpen(s, inp.frontIn, inp.backIn, inp.disc, o.tray, o.glass, false); break;
    case "spread": c = drawSpread(s, inp.pages[1] ?? null, inp.pages[2] ?? null); break;
    case "fan": c = drawFan(s, inp.pages.slice(0, 3)); break;
    case "disc": c = drawDisc(s, inp.disc ?? null); break;
  }
  if (cache.size > 40) cache.clear();
  cache.set(key, c);
  return c;
}

// ---------- bố cục ----------
const GAP = 16; // mm giữa các đồ vật
function rows(list: Kind[][]): Placed[] {
  const hs = list.map((r) => Math.max(...r.map((k) => SIZE[k][1])));
  const total = hs.reduce((a, b) => a + b, 0) + GAP * (list.length - 1);
  const out: Placed[] = [];
  let y = -total / 2;
  list.forEach((r, i) => {
    const w = r.reduce((a, k) => a + SIZE[k][0], 0) + GAP * (r.length - 1);
    let x = -w / 2;
    for (const k of r) { out.push({ kind: k, x: x + SIZE[k][0] / 2, y: y + hs[i] / 2, rot: 0 }); x += SIZE[k][0] + GAP; }
    y += hs[i] + GAP;
  });
  return out;
}
function layout(inp: SystemInput, o: SystemOptions): Placed[] {
  const p = inp.pack;
  if (o.arrange === "single") {
    const k: Kind = o.single === "booklet" ? "spread" : o.single;
    return [{ kind: k, x: 0, y: 0, rot: 0 }];
  }
  if (o.arrange === "stack") {
    // flat-lay: chồng lệch ở giữa, hộp đóng trên cùng, đĩa rời trồi ra 1 bên
    if (p === "box") return [
      { kind: "openBare", x: -10, y: -26, rot: 0 }, { kind: "disc", x: 70, y: 40, rot: 0 }, { kind: "closed", x: -28, y: 34, rot: 0 },
    ];
    const l: Placed[] = [{ kind: "open", x: -34, y: -44, rot: 0 }, { kind: "back", x: 70, y: 18, rot: 0 }];
    if (p === "booklet") l.push({ kind: "fan", x: 40, y: -40, rot: 0 });
    l.push({ kind: "disc", x: -96, y: 40, rot: 0 }, { kind: "closed", x: -18, y: 46, rot: 0 });
    return l;
  }
  // Lưới (mặc định)
  if (p === "box") return [{ kind: "open", x: -26, y: 0, rot: 0 }, { kind: "disc", x: 118, y: 34, rot: 0 }];
  if (p === "booklet") return rows([["closed", "spread"], ["open", "back"]]);
  return rows([["closed", "back"], ["open"]]);
}
// khung bao (mm) của bố cục, tính cả góc xoay
function bounds(list: Placed[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of list) {
    const [w, h] = SIZE[it.kind], a = (Math.abs(it.rot) * Math.PI) / 180;
    const bw = w * Math.cos(a) + h * Math.sin(a), bh = w * Math.sin(a) + h * Math.cos(a);
    x0 = Math.min(x0, it.x - bw / 2); x1 = Math.max(x1, it.x + bw / 2); y0 = Math.min(y0, it.y - bh / 2); y1 = Math.max(y1, it.y + bh / 2);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// bóng đổ 2 lớp của 1 đồ vật (chỉ bóng, không có hình — hình đặt ngoài khung, bóng dịch vào): cache cùng đồ vật
const shadows = new WeakMap<HTMLCanvasElement, { c: HTMLCanvasElement; pad: number }>();
function shadowOf(obj: HTMLCanvasElement, s: number) {
  const hit = shadows.get(obj);
  if (hit) return hit;
  const pad = Math.ceil(40 * s), FAR = obj.width + pad * 4;
  const c = document.createElement("canvas"); c.width = obj.width + pad * 2; c.height = obj.height + pad * 2;
  const x = c.getContext("2d")!;
  // bóng xa: nhạt, rộng, lệch xuống dưới phải
  x.shadowColor = "rgba(0,0,0,0.16)"; x.shadowBlur = 22 * s; x.shadowOffsetX = FAR + 6 * s; x.shadowOffsetY = 10 * s;
  x.drawImage(obj, pad - FAR, pad);
  // bóng tiếp xúc: đậm, sát cạnh
  x.shadowColor = "rgba(0,0,0,0.32)"; x.shadowBlur = 2.2 * s; x.shadowOffsetX = FAR + 0.4 * s; x.shadowOffsetY = 1 * s;
  x.drawImage(obj, pad - FAR, pad);
  const v = { c, pad };
  shadows.set(obj, v);
  return v;
}

// grain rất mịn (tile dùng chung)
let grain: HTMLCanvasElement | null = null;
function grainTile() {
  if (grain) return grain;
  grain = document.createElement("canvas"); grain.width = grain.height = 256;
  const x = grain.getContext("2d")!, d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  return grain;
}

/** Dựng cảnh vuông N×N. paintBg = null → nền trong suốt (tải PNG). */
export function renderSystem(N: number, inp: SystemInput, o: SystemOptions, paintBg: ((ctx: CanvasRenderingContext2D, W: number, H: number) => void) | null) {
  const r = rng(o.seed * 9973 + 17);
  const list = layout(inp, o).map((it) => ({ ...it, rot: (r() * 8 - 4), x: it.x + (r() - 0.5) * 6, y: it.y + (r() - 0.5) * 6 }));
  const b = bounds(list);
  const usable = N * 0.8; // lề 10% mỗi bên
  const s = Math.min(usable / b.w, usable / b.h); // px/mm chung
  const cx = N / 2 - (b.x0 + b.w / 2) * s, cy = N / 2 - (b.y0 + b.h / 2) * s;

  const out = document.createElement("canvas"); out.width = out.height = N;
  const x = out.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  if (paintBg) paintBg(x, N, N);
  for (const it of list) {
    const c = objectCanvas(it.kind, s, inp, o);
    const w = c.width, h = c.height;
    x.save();
    x.translate(cx + it.x * s, cy + it.y * s); x.rotate((it.rot * Math.PI) / 180);
    // bóng đổ (đổ lên cả đồ vật nằm dưới) rồi tới đồ vật
    const sh = shadowOf(c, s);
    x.drawImage(sh.c, -w / 2 - sh.pad, -h / 2 - sh.pad);
    x.drawImage(c, -w / 2, -h / 2);
    x.restore();
  }
  // grain 3%
  x.save(); x.globalAlpha = 0.03; x.globalCompositeOperation = paintBg ? "overlay" : "source-atop";
  x.fillStyle = x.createPattern(grainTile(), "repeat")!; x.fillRect(0, 0, N, N);
  x.restore();
  return out;
}
