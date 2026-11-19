"use client";
/* Hậu xử lý mặt nạ tách nền (chạy trên máy khách): độ cứng mép (ngưỡng alpha), bỏ đốm rời nhỏ / giữ vùng lớn nhất
   (hoặc nhiều vật), làm mềm mép, khử viền màu nền (defringe), sửa tay bằng cọ (xoá / khôi phục pixel gốc), cắt sát. */

export type RefineOpts = { hardness: number; feather: number; keepMany: boolean };
type Img = { w: number; h: number; data: Uint8ClampedArray };

// giãn (max) nhị phân bán kính r — 2 lượt ngang / dọc bằng cửa sổ trượt
function dilate(m: Uint8Array, w: number, h: number, r: number) {
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) { let c = 0; for (let x = -r; x < w; x++) { if (x + r < w && m[y * w + x + r]) c++; if (x - r - 1 >= 0 && m[y * w + x - r - 1]) c--; if (x >= 0) t[y * w + x] = c > 0 ? 1 : 0; } }
  for (let x = 0; x < w; x++) { let c = 0; for (let y = -r; y < h; y++) { if (y + r < h && t[(y + r) * w + x]) c++; if (y - r - 1 >= 0 && t[(y - r - 1) * w + x]) c--; if (y >= 0) o[y * w + x] = c > 0 ? 1 : 0; } }
  return o;
}
function blur(a: Float32Array, w: number, h: number, r: number) {
  if (r <= 0) return a;
  const t = new Float32Array(a.length), o = new Float32Array(a.length), k = 2 * r + 1;
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / k; s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / k; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  return o;
}

/** mặt nạ thô (0..255) → mặt nạ đã tinh chỉnh */
export function refineAlpha(alpha: Uint8Array, w: number, h: number, o: RefineOpts) {
  const n = w * h, win = Math.max(0.04, 1 - 0.92 * o.hardness), t0 = 0.5 - win / 2;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.min(1, Math.max(0, (alpha[i] / 255 - t0) / win));
  // vùng liền khối (alpha > 0.5): bỏ đốm nhỏ, giữ vùng lớn nhất (hoặc mọi vùng đủ lớn)
  const lab = new Int32Array(n), sizes: number[] = [0];
  for (let s = 0; s < n; s++) {
    if (lab[s] || a[s] <= 0.5) continue;
    const id = sizes.length; let c = 0; const st = [s]; lab[s] = id;
    while (st.length) { const p = st.pop()!; c++; const x = p % w; for (const q of [p - 1, p + 1, p - w, p + w]) { if (q < 0 || q >= n || lab[q] || a[q] <= 0.5 || Math.abs((q % w) - x) > 1) continue; lab[q] = id; st.push(q); } }
    sizes.push(c);
  }
  const big = Math.max(0, ...sizes), keep = sizes.map((c, i) => i > 0 && c >= n * 0.001 && (o.keepMany ? c >= big * 0.01 : c === big));
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = keep[lab[i]] ? 1 : 0;
  const near = dilate(fg, w, h, Math.max(3, Math.round(Math.max(w, h) / 300)));
  for (let i = 0; i < n; i++) if ((lab[i] && !keep[lab[i]]) || !near[i]) a[i] = 0;
  const b = blur(a, w, h, Math.round(o.feather));
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.round(b[i] * 255);
  return out;
}

/** màu nền ước lượng (trung bình các điểm gần như trong suốt) — để khử viền màu nền */
function bgColor(img: Img, alpha: Uint8Array) {
  let r = 0, g = 0, b = 0, c = 0;
  for (let i = 0; i < alpha.length; i += 3) if (alpha[i] < 8) { r += img.data[i * 4]; g += img.data[i * 4 + 1]; b += img.data[i * 4 + 2]; c++; }
  return c ? [r / c, g / c, b / c] : null;
}
/** ảnh gốc + mặt nạ (+ sửa tay: 1 = xoá, 2 = khôi phục pixel gốc) → canvas PNG cắt sát (lề 4px). color: nguồn màu riêng (Nền trơn) */
export function composeSticker(img: Img, alpha: Uint8Array, edits: Uint8Array | null, opts: { defringe?: boolean; color?: Uint8ClampedArray } = {}) {
  const { w, h } = img, n = w * h, out = new Uint8ClampedArray(n * 4), B = opts.defringe ? bgColor(img, alpha) : null;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) {
    const e = edits?.[i] ?? 0, src = e === 2 || !opts.color ? img.data : opts.color;
    const A = e === 1 ? 0 : e === 2 ? 255 : alpha[i];
    if (!A) continue;
    let r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    if (B && e !== 2 && A < 250 && A > 24) { const t = A / 255; r = (r - (1 - t) * B[0]) / t; g = (g - (1 - t) * B[1]) / t; b = (b - (1 - t) * B[2]) / t; }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = A;
    if (A > 10) { const x = i % w, y = (i - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const P = 4; x0 = Math.max(0, x0 - P); y0 = Math.max(0, y0 - P); x1 = Math.min(w - 1, x1 + P); y1 = Math.min(h - 1, y1 + P);
  const full = document.createElement("canvas"); full.width = w; full.height = h; full.getContext("2d")!.putImageData(new ImageData(out, w, h), 0, 0);
  const c = document.createElement("canvas"); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1; c.getContext("2d")!.drawImage(full, -x0, -y0);
  return c;
}
/** "Vùng giữ lại": ảnh gốc, phần bị bỏ hiện mờ (để biết chỗ cần cọ khôi phục) */
export function keptView(img: Img, alpha: Uint8Array, edits: Uint8Array | null) {
  const n = img.w * img.h, d = new Uint8ClampedArray(img.data);
  for (let i = 0; i < n; i++) { const e = edits?.[i] ?? 0, A = e === 1 ? 0 : e === 2 ? 255 : alpha[i]; d[i * 4 + 3] = Math.max(38, A); }
  return new ImageData(d, img.w, img.h);
}
