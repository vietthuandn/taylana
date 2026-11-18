/* Tách tờ sticker — phần tính toán thuần (chạy trong Web Worker, không đụng DOM).
   1) Xoá nền: ảnh có alpha → dùng luôn; ảnh không alpha → lấy màu nền từ 4 góc + 4 cạnh, loang TỪ MÉP VÀO theo ngưỡng
      (chỉ vùng nối liền mép bị xoá → phần trắng bên trong sticker được giữ), mép mềm (mờ alpha 1px) + khử viền trắng.
   2) Tách món: mặt nạ alpha > 20 → đóng hình (close) → gán nhãn vùng liền khối → bỏ vùng quá nhỏ. */

export type SliceParams = { tolerance: number; minAreaPct: number; close: number };
export type Comp = { id: number; x0: number; y0: number; x1: number; y1: number; area: number };
export type SliceResult = { w: number; h: number; rgba: Uint8ClampedArray; labels: Int32Array; comps: Comp[]; hadAlpha: boolean; bg: [number, number, number] };

function hasAlpha(d: Uint8ClampedArray) {
  let n = 0;
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250 && ++n > 50) return true;
  return false;
}
function sampleBg(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const pts: [number, number][] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 40));
  for (let x = 0; x < w; x += step) pts.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y += step) pts.push([0, y], [w - 1, y]);
  const ch = [0, 1, 2].map((c) => pts.map(([x, y]) => d[(y * w + x) * 4 + c]).sort((a, b) => a - b)[Math.floor(pts.length / 2)]);
  return [ch[0], ch[1], ch[2]];
}
// lọc max / min 1 chiều (cửa sổ 2r + 1) — dùng cho giãn / co hình vuông tách theo trục
function pass1d(src: Uint8Array, w: number, h: number, r: number, horiz: boolean, max: boolean) {
  const out = new Uint8Array(src.length);
  const L = horiz ? w : h, M = horiz ? h : w;
  for (let m = 0; m < M; m++) for (let l = 0; l < L; l++) {
    let v = max ? 0 : 1;
    for (let k = -r; k <= r && (max ? v === 0 : v === 1); k++) {
      const q = l + k;
      if (q < 0 || q >= L) { if (!max) v = 0; continue; }
      const s = horiz ? src[m * w + q] : src[q * w + m];
      v = max ? Math.max(v, s) : Math.min(v, s);
    }
    out[horiz ? m * w + l : l * w + m] = v;
  }
  return out;
}
const dilate = (m: Uint8Array, w: number, h: number, r: number) => pass1d(pass1d(m, w, h, r, true, true), w, h, r, false, true);
const erode = (m: Uint8Array, w: number, h: number, r: number) => pass1d(pass1d(m, w, h, r, true, false), w, h, r, false, false);

export function slice(src: Uint8ClampedArray, w: number, h: number, p: SliceParams): SliceResult {
  const d = new Uint8ClampedArray(src);
  const N = w * h;
  const alpha = hasAlpha(d);
  const bg = sampleBg(d, w, h);
  if (!alpha) {
    // loang từ mép vào: pixel gần màu nền + nối liền mép → nền
    const tol2 = p.tolerance * p.tolerance * 3;
    const near = (i: number) => { const r = d[i * 4] - bg[0], g = d[i * 4 + 1] - bg[1], b = d[i * 4 + 2] - bg[2]; return r * r + g * g + b * b <= tol2; };
    const isBg = new Uint8Array(N), q = new Int32Array(N);
    let head = 0, tail = 0;
    const push = (i: number) => { if (!isBg[i] && near(i)) { isBg[i] = 1; q[tail++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (head < tail) {
      const i = q[head++], x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
    }
    // mép mềm: mờ alpha 1px (3 × 3)
    const a = new Uint8ClampedArray(N);
    for (let i = 0; i < N; i++) a[i] = isBg[i] ? 0 : 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (a[i] === 0 && !(x > 0 && a[i - 1]) && !(x < w - 1 && a[i + 1]) && !(y > 0 && a[i - w]) && !(y < h - 1 && a[i + w])) { d[i * 4 + 3] = 0; continue; }
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) { s += a[Y * w + X]; c++; } }
      const v = Math.round(s / c);
      d[i * 4 + 3] = v;
      // khử viền trắng: tách màu nền khỏi pixel bán trong suốt
      if (v > 0 && v < 255) {
        const k = v / 255;
        for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.max(0, Math.min(255, (d[i * 4 + ch] - bg[ch] * (1 - k)) / k));
      }
    }
  }
  // mặt nạ → đóng hình → gán nhãn vùng liền khối
  let mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = d[i * 4 + 3] > 20 ? 1 : 0;
  if (p.close > 0) mask = erode(dilate(mask, w, h, p.close), w, h, p.close);
  const labels = new Int32Array(N);
  const comps: Comp[] = [];
  const st = new Int32Array(N);
  const minArea = (p.minAreaPct / 100) * N;
  let next = 1;
  for (let s0 = 0; s0 < N; s0++) {
    if (!mask[s0] || labels[s0]) continue;
    const id = next++;
    let sp = 0, area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    st[sp++] = s0; labels[s0] = id;
    while (sp) {
      const i = st[--sp], x = i % w, y = (i / w) | 0;
      area++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) if (j >= 0 && mask[j] && !labels[j]) { labels[j] = id; st[sp++] = j; }
    }
    if (area >= minArea) comps.push({ id, x0, y0, x1, y1, area });
  }
  return { w, h, rgba: d, labels, comps, hadAlpha: alpha, bg };
}
