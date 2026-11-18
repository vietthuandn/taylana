/* Nhận diện ký tự font cut-out — phần chạy trong Web Worker (không đụng DOM).
   TỰ ĐỦ: mọi hàm phụ nằm TRONG engineMain — worker được tạo từ mã nguồn (đã biên dịch) của chính hàm này.
   Tin nhắn:
   - { t: "prep", id, w, h, data }  → tiền xử lý 1 mảnh: tách chữ khỏi nền giấy (k-means trên Lab, dự phòng Otsu + đảo màu),
       làm sạch (bỏ đốm, đóng lỗ 1px), cắt sát, chỉnh nghiêng (0°, ±8°, ±15° — khung bao hẹp nhất), viền trắng 20%, chữ cao ~96px.
       Trả về: vec (32×32 + HOG), h (chiều cao chữ gốc, px), variants (ảnh đen trắng thường / đảo cho Tesseract), preview.
   - { t: "refs", templates, training }  → nạp vector font mẫu + dữ liệu học.
   - { t: "match", id, vec }  → điểm theo font mẫu (NCC + HOG) và theo dữ liệu học (kNN, cosine). */
export function engineMain() {
  type Img = { w: number; h: number; data: Uint8ClampedArray };
  type Ref = { ch: string; vec: Float32Array };
  const N = 32, CELL = 8, BINS = 9, HOGLEN = (N / CELL) * (N / CELL) * BINS;
  let templates: Ref[] = [], training: Ref[] = [];
  const counts: Record<string, number> = {};

  // ---------- màu ----------
  function lab(r: number, g: number, b: number): [number, number, number] {
    const f = (c: number) => { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
    const R = f(r), G = f(g), B = f(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const t = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    x = t(x); y = t(y); z = t(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  // ---------- mặt nạ chữ ----------
  function textMask(img: Img): Uint8Array {
    const { w, h, data } = img, n = w * h;
    const opaque = new Uint8Array(n), L = new Float32Array(n), A = new Float32Array(n), Bc = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (data[i * 4 + 3] < 128) continue;
      opaque[i] = 1;
      const v = lab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]); L[i] = v[0]; A[i] = v[1]; Bc[i] = v[2];
    }
    // pixel "mép": sát pixel trong suốt hoặc sát khung ảnh (≤ 3px)
    const border = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!opaque[i]) continue;
      if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) { border[i] = 1; continue; }
      for (let dy = -3; dy <= 3 && !border[i]; dy++) for (let dx = -3; dx <= 3; dx++) if (!opaque[(y + dy) * w + x + dx]) { border[i] = 1; break; }
    }
    // k-means (k = 3) trên Lab, khởi tạo theo phân vị độ sáng
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (opaque[i]) idx.push(i);
    if (!idx.length) return new Uint8Array(n);
    const step = Math.max(1, Math.floor(idx.length / 5000)), sample = idx.filter((_, k) => k % step === 0);
    const byL = [...sample].sort((a, b) => L[a] - L[b]);
    const K = 3, cent: number[][] = [0.1, 0.5, 0.9].map((q) => { const i = byL[Math.floor(q * (byL.length - 1))]; return [L[i], A[i], Bc[i]]; });
    const asg = new Int32Array(n).fill(-1);
    for (let it = 0; it < 12; it++) {
      const sum = cent.map(() => [0, 0, 0, 0]);
      for (const i of sample) {
        const p = [L[i], A[i], Bc[i]];
        let best = 0, bd = Infinity;
        for (let c = 0; c < K; c++) { const dd = d2(p, cent[c]); if (dd < bd) { bd = dd; best = c; } }
        sum[best][0] += p[0]; sum[best][1] += p[1]; sum[best][2] += p[2]; sum[best][3]++;
      }
      for (let c = 0; c < K; c++) if (sum[c][3]) cent[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
    const bcount = [0, 0, 0], tot = [0, 0, 0];
    for (const i of idx) {
      const p = [L[i], A[i], Bc[i]];
      let best = 0, bd = Infinity;
      for (let c = 0; c < K; c++) { const dd = d2(p, cent[c]); if (dd < bd) { bd = dd; best = c; } }
      asg[i] = best; tot[best]++; if (border[i]) bcount[best]++;
    }
    // cụm chiếm phần lớn mép = nền giấy; cụm khác xa nền = chữ
    let paper = 0;
    for (let c = 1; c < K; c++) if (bcount[c] > bcount[paper]) paper = c;
    const far = cent.map((c) => Math.sqrt(d2(c, cent[paper])));
    const maxFar = Math.max(...far);
    const mask = new Uint8Array(n);
    if (maxFar >= 18) {
      for (const i of idx) if (asg[i] !== paper && far[asg[i]] >= maxFar * 0.55) mask[i] = 1;
      return mask;
    }
    // độ tương phản thấp → Otsu trên độ sáng, thử cả bản thường và đảo màu (chọn bản ít "chạm mép" hơn)
    const hist = new Array(101).fill(0);
    for (const i of idx) hist[Math.max(0, Math.min(100, Math.round(L[i])))]++;
    let sumAll = 0; for (let t = 0; t <= 100; t++) sumAll += t * hist[t];
    let wB = 0, sumB = 0, best = 0, thr = 50;
    for (let t = 0; t <= 100; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = idx.length - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF, v = wB * wF * (mB - mF) ** 2;
      if (v > best) { best = v; thr = t; }
    }
    const dark = new Uint8Array(n), light = new Uint8Array(n);
    let db = 0, lb = 0;
    for (const i of idx) { if (L[i] <= thr) { dark[i] = 1; if (border[i]) db++; } else { light[i] = 1; if (border[i]) lb++; } }
    return db <= lb ? dark : light;
  }
  // bỏ đốm nhỏ + đóng lỗ 1px
  function clean(m: Uint8Array, w: number, h: number) {
    const lab2 = new Int32Array(w * h), sizes: number[] = [0], st: number[] = [];
    let id = 0;
    for (let s = 0; s < w * h; s++) {
      if (!m[s] || lab2[s]) continue;
      id++; let size = 0; st.push(s); lab2[s] = id;
      while (st.length) {
        const i = st.pop()!, x = i % w, y = (i / w) | 0; size++;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && m[j] && !lab2[j]) { lab2[j] = id; st.push(j); }
      }
      sizes.push(size);
    }
    const big = Math.max(0, ...sizes), keep = Math.max(4, big * 0.04);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (lab2[i] && sizes[lab2[i]] >= keep) out[i] = 1;
    // đóng 1px: giãn rồi co
    const dil = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && out[Y * w + X]) { v = 1; break; } } dil[y * w + x] = v; }
    const ero = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 1; for (let dy = -1; dy <= 1 && v; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h || !dil[Y * w + X]) { v = 0; break; } } ero[y * w + x] = v || out[y * w + x]; }
    return ero;
  }
  // xoay mặt nạ (độ) quanh tâm, cắt sát theo khung chữ → { m, w, h }
  function rotateCrop(m: Uint8Array, w: number, h: number, deg: number) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), cx = w / 2, cy = h / 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) {
      const X = (x - cx) * c - (y - cy) * s, Y = (x - cx) * s + (y - cy) * c;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    if (x0 === Infinity) return { m: new Uint8Array(1), w: 1, h: 1, bw: 1 };
    const W = Math.max(1, Math.ceil(x1 - x0 + 1)), H = Math.max(1, Math.ceil(y1 - y0 + 1)), out = new Uint8Array(W * H);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const rx = X + x0, ry = Y + y0;
      const sx = Math.round(rx * c + ry * s + cx), sy = Math.round(-rx * s + ry * c + cy);
      if (sx >= 0 && sy >= 0 && sx < w && sy < h && m[sy * w + sx]) out[Y * W + X] = 1;
    }
    return { m: out, w: W, h: H, bw: x1 - x0 };
  }
  // ảnh đen trắng cho Tesseract / xem trước: chữ cao ~96px, viền trắng 20%
  function raster(m: Uint8Array, w: number, h: number, inv: boolean): Img {
    const k = 96 / Math.max(h, 1), pad = Math.round(Math.max(w, h) * k * 0.2) + 4;
    const W = Math.round(w * k) + pad * 2, H = Math.round(h * k) + pad * 2, data = new Uint8ClampedArray(W * H * 4);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const sx = Math.floor((X - pad) / k), sy = Math.floor((Y - pad) / k);
      const ink = sx >= 0 && sy >= 0 && sx < w && sy < h && m[sy * w + sx] === 1;
      const v = ink !== inv ? 0 : 255, o = (Y * W + X) * 4;
      data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
    }
    return { w: W, h: H, data };
  }
  // vector đặc trưng: ảnh 32 × 32 (giữ tỉ lệ, căn giữa, khử răng cưa theo diện tích) + HOG (4 × 4 ô, 9 hướng)
  function features(m: Uint8Array, w: number, h: number) {
    const g = new Float32Array(N * N), s = (N - 4) / Math.max(w, h), ox = (N - w * s) / 2, oy = (N - h * s) / 2;
    if (s < 1) {
      // thu nhỏ: cộng dồn theo diện tích phủ
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) {
        const X = Math.min(N - 1, Math.floor(ox + x * s)), Y = Math.min(N - 1, Math.floor(oy + y * s));
        g[Y * N + X] += s * s;
      }
    } else {
      // phóng to (mảnh nhỏ): lấy mẫu ngược để không thủng lỗ
      for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) {
        const sx = Math.floor((X - ox) / s), sy = Math.floor((Y - oy) / s);
        if (sx >= 0 && sy >= 0 && sx < w && sy < h && m[sy * w + sx]) g[Y * N + X] = 1;
      }
    }
    for (let i = 0; i < N * N; i++) g[i] = Math.min(1, g[i]);
    const hog = new Float32Array(HOGLEN);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const gx = g[y * N + x + 1] - g[y * N + x - 1], gy = g[(y + 1) * N + x] - g[(y - 1) * N + x];
      const mag = Math.hypot(gx, gy);
      if (!mag) continue;
      let ang = Math.atan2(gy, gx); if (ang < 0) ang += Math.PI;
      const bin = Math.min(BINS - 1, Math.floor((ang / Math.PI) * BINS));
      hog[(((y / CELL) | 0) * (N / CELL) + ((x / CELL) | 0)) * BINS + bin] += mag;
    }
    let nn = 0; for (const v of hog) nn += v * v; nn = Math.sqrt(nn) || 1;
    const vec = new Float32Array(N * N + HOGLEN);
    vec.set(g, 0);
    for (let i = 0; i < HOGLEN; i++) vec[N * N + i] = hog[i] / nn;
    return vec;
  }
  function prep(img: Img, lite = false) {
    const m = clean(textMask(img), img.w, img.h);
    let best = rotateCrop(m, img.w, img.h, 0), bestA = 0;
    for (const a of [8, -8, 15, -15]) { const r = rotateCrop(m, img.w, img.h, a); if (r.bw < best.bw * 0.94) { best = r; bestA = a; } }
    if (lite) return { vec: features(best.m, best.w, best.h), h: best.h, angle: bestA, variants: [], preview: null };
    return { vec: features(best.m, best.w, best.h), h: best.h, angle: bestA, variants: [raster(best.m, best.w, best.h, false), raster(best.m, best.w, best.h, true)], preview: raster(best.m, best.w, best.h, false) };
  }
  // ---------- so khớp ----------
  function sim(a: Float32Array, b: Float32Array) {
    let ma = 0, mb = 0;
    for (let i = 0; i < N * N; i++) { ma += a[i]; mb += b[i]; }
    ma /= N * N; mb /= N * N;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < N * N; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
    const ncc = da && db ? num / Math.sqrt(da * db) : 0;
    let hc = 0; for (let i = N * N; i < a.length; i++) hc += a[i] * b[i];
    return 0.5 * Math.max(0, ncc) + 0.5 * Math.max(0, hc);
  }
  function match(vec: Float32Array) {
    const tmpl: Record<string, number> = {};
    for (const t of templates) { const s = sim(vec, t.vec); if (!(t.ch in tmpl) || s > tmpl[t.ch]) tmpl[t.ch] = s; }
    const knn: Record<string, number> = {};
    if (training.length) {
      const k = Math.min(5, training.length);
      const top = training.map((t) => ({ ch: t.ch, s: sim(vec, t.vec) })).sort((a, b) => b.s - a.s).slice(0, k);
      const tot = top.reduce((a, b) => a + b.s, 0) || 1;
      for (const x of top) knn[x.ch] = (knn[x.ch] ?? 0) + x.s / tot * Math.min(1, top[0].s * 1.15);
    }
    return { tmpl, knn };
  }

  const ctx = self as unknown as { postMessage: (m: unknown, t?: Transferable[]) => void; onmessage: ((e: MessageEvent) => void) | null };
  ctx.onmessage = (e: MessageEvent) => {
    const msg = e.data as { t: string; id?: number; lite?: boolean; w?: number; h?: number; data?: Uint8ClampedArray; vec?: number[]; templates?: { ch: string; vec: number[] }[]; training?: { ch: string; vec: number[] }[] };
    try {
      if (msg.t === "prep") {
        const r = prep({ w: msg.w!, h: msg.h!, data: msg.data! }, !!msg.lite);
        ctx.postMessage({ id: msg.id, ok: true, vec: Array.from(r.vec), h: r.h, angle: r.angle, variants: r.variants, preview: r.preview });
      } else if (msg.t === "refs") {
        templates = (msg.templates ?? []).map((t) => ({ ch: t.ch, vec: Float32Array.from(t.vec) }));
        training = (msg.training ?? []).map((t) => ({ ch: t.ch, vec: Float32Array.from(t.vec) }));
        for (const k of Object.keys(counts)) delete counts[k];
        for (const t of training) counts[t.ch] = (counts[t.ch] ?? 0) + 1;
        ctx.postMessage({ id: msg.id, ok: true });
      } else if (msg.t === "match") {
        ctx.postMessage({ id: msg.id, ok: true, ...match(Float32Array.from(msg.vec!)), counts });
      }
    } catch (err) { ctx.postMessage({ id: msg.id, ok: false, error: String(err) }); }
  };
}
