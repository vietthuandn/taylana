/* Lỗ đặt ảnh của khung PNG (HoleRegion): dò bằng Web Worker (lib/frames/detectHole.js), vẽ đường đi / mặt nạ theo đa giác
   ở MỌI độ phân giải (bản in 300 DPI không răng cưa), tạo ảnh mặt nạ PNG để lưu (tương thích chỗ còn dùng mask_url). */
import type { HoleRegion, Rect01 } from "@/lib/scrapbook/types";
import { detectHoles as detectSync, quadOf } from "./detectHole.js";

type Src = CanvasImageSource & { width: number; height: number };
export type DetectOpts = { thr?: number; grow?: number }; // ngưỡng alpha (mặc định 32) · nở mép px theo ảnh khung gốc (mặc định 3)

/** dò lỗ trên ảnh khung (tối đa 1600px cạnh dài) — chạy trong Web Worker, lỗi thì chạy thẳng */
export async function detectFrameHoles(img: Src, o: DetectOpts = {}): Promise<HoleRegion[]> {
  const k = Math.min(1, 1600 / Math.max(img.width, img.height)), W = Math.max(1, Math.round(img.width * k)), H = Math.max(1, Math.round(img.height * k));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true })!; x.drawImage(img, 0, 0, W, H);
  const rgba = x.getImageData(0, 0, W, H).data;
  const opt = { thr: o.thr ?? 32 };
  let raw: Omit<HoleRegion, "g">[];
  try {
    raw = await new Promise((res, rej) => {
      const w = new Worker(new URL("./detectHole.js", import.meta.url), { type: "module" });
      w.onmessage = (e) => { w.terminate(); if (e.data.error) rej(new Error(e.data.error)); else res(e.data.holes); };
      w.onerror = (e) => { w.terminate(); rej(e); };
      w.postMessage({ rgba, W, H, opt });
    });
  } catch { raw = detectSync(rgba, W, H, opt); }
  const g = (o.grow ?? 3) / img.width;
  return raw.map((r) => (r.kind === "mask" ? { ...r, g } : r));
}

export const bboxOf = (pts: [number, number][]): Rect01 => ({
  x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])),
});
export const unionBox = (rs: HoleRegion[]): Rect01 | null => (rs.length ? { x0: Math.min(...rs.map((r) => r.bbox.x0)), y0: Math.min(...rs.map((r) => r.bbox.y0)), x1: Math.max(...rs.map((r) => r.bbox.x1)), y1: Math.max(...rs.map((r) => r.bbox.y1)) } : null);
/** 4 góc xấp xỉ từ đa giác (đổi "Theo hình dạng" → "4 góc") */
export function quadFrom(pts: [number, number][]): [number, number][] {
  const S = 10000, q = quadOf(pts.map(([x, y]) => [Math.round(x * S), Math.round(y * S)])) as [number, number][];
  return q.map(([x, y]) => [Math.min(1, x / S), Math.min(1, y / S)]);
}
/** 1 vùng chữ nhật đúng trục (không cần mặt nạ) */
export const isAxisQuad = (r: HoleRegion) => r.kind === "quad" && r.pts.length === 4 && (() => {
  const xs = [...new Set(r.pts.map((p) => Math.round(p[0] * 1000)))], ys = [...new Set(r.pts.map((p) => Math.round(p[1] * 1000)))];
  return xs.length <= 2 && ys.length <= 2;
})();
/** cần mặt nạ khi có vùng theo hình dạng, nhiều vùng, hoặc 4 góc lệch (phối cảnh) */
export const needsMask = (rs: HoleRegion[]) => rs.length > 1 || rs.some((r) => !isAxisQuad(r));

/** đường đi của 1 lỗ trong khung W × H */
export function holePath(r: HoleRegion, W: number, H: number) {
  const p = new Path2D();
  r.pts.forEach(([x, y], i) => (i ? p.lineTo(x * W, y * H) : p.moveTo(x * W, y * H)));
  p.closePath();
  return p;
}
/** mặt nạ 1 lỗ (alpha) cỡ cw × ch, khung chiếm W × H (đơn vị của ctx đã scale): tô + viền dày 2 × nở mép (= nở đều mọi phía) */
export function holeMask(r: HoleRegion, cw: number, ch: number, W: number, H: number, soft = 0) {
  const m = document.createElement("canvas"); m.width = cw; m.height = ch;
  const y = m.getContext("2d")!; y.scale(cw / W, ch / H);
  if (soft) y.filter = `blur(${soft}px)`;
  const path = holePath(r, W, H);
  y.fillStyle = "#000"; y.fill(path);
  const gw = (r.g ?? 0) * W;
  if (gw > 0) { y.lineJoin = "round"; y.lineWidth = gw * 2; y.strokeStyle = "#000"; y.stroke(path); }
  return m;
}
/** vẽ ảnh vào từng lỗ (coverCrop theo khung bao đã nở của lỗ) rồi cắt bằng mặt nạ đúng hình — ctx đang ở hệ toạ độ khung 0..W × 0..H.
    put(ctx, cx, cy, w, h): vẽ ảnh phủ kín ô w × h có tâm (cx, cy) */
export function drawHoles(x: CanvasRenderingContext2D, rs: HoleRegion[], W: number, H: number, pxW: number, pxH: number, put: (c: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => void) {
  for (const r of rs) {
    const g = (r.g ?? 0) * W, b = r.bbox;
    const bx = b.x0 * W - g, by = b.y0 * H - g, bw = (b.x1 - b.x0) * W + g * 2, bh = (b.y1 - b.y0) * H + g * 2;
    const p = document.createElement("canvas"); p.width = pxW; p.height = pxH;
    const pc = p.getContext("2d")!; pc.imageSmoothingQuality = "high"; pc.scale(pxW / W, pxH / H);
    put(pc, bx + bw / 2, by + bh / 2, bw, bh);
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.globalCompositeOperation = "destination-in";
    pc.drawImage(holeMask(r, pxW, pxH, W, H), 0, 0);
    x.drawImage(p, 0, 0, W, H);
  }
}
/** ảnh mặt nạ đen trắng (trắng = vùng ảnh) đúng cỡ ảnh khung, mép mềm ~1px — lưu làm mask_url */
export async function maskPng(rs: HoleRegion[], W: number, H: number): Promise<Blob> {
  const k = Math.min(1, 2400 / Math.max(W, H)), cw = Math.max(1, Math.round(W * k)), ch = Math.max(1, Math.round(H * k));
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const x = c.getContext("2d")!; x.fillStyle = "#000"; x.fillRect(0, 0, cw, ch);
  for (const r of rs) {
    const m = holeMask(r, cw, ch, cw, ch, 0.5);
    const w = document.createElement("canvas"); w.width = cw; w.height = ch;
    const wc = w.getContext("2d")!; wc.drawImage(m, 0, 0); wc.globalCompositeOperation = "source-in"; wc.fillStyle = "#fff"; wc.fillRect(0, 0, cw, ch);
    x.drawImage(w, 0, 0);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Không tạo được mặt nạ"))), "image/png"));
}
