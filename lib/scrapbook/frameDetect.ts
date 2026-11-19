"use client";
/* Tự dò vùng ảnh của khung PNG: vùng trong suốt liền khối lớn nhất nằm BÊN TRONG khung (không chạm mép ảnh). */
import type { Rect01 } from "./types";

export function detectRegion(img: CanvasImageSource & { width: number; height: number }): Rect01 | null {
  const k = Math.min(1, 400 / Math.max(img.width, img.height)), W = Math.max(1, Math.round(img.width * k)), H = Math.max(1, Math.round(img.height * k));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true })!; x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data, seen = new Uint8Array(W * H);
  let best: { n: number; x0: number; y0: number; x1: number; y1: number } | null = null;
  const stack: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || d[s * 4 + 3] > 24) continue;
    let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, edge = false;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!, px = p % W, py = (p - px) / W;
      n++; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      if (px === 0 || py === 0 || px === W - 1 || py === H - 1) edge = true;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || seen[q] || Math.abs((q % W) - px) > 1 || d[q * 4 + 3] > 24) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    if (!edge && n > W * H * 0.02 && (!best || n > best.n)) best = { n, x0, y0, x1, y1 };
  }
  return best ? { x0: best.x0 / W, y0: best.y0 / H, x1: (best.x1 + 1) / W, y1: (best.y1 + 1) / H } : null;
}
