/* Dò các LỖ đặt ảnh của khung PNG (chạy trong Web Worker; cũng gọi thẳng được khi trình duyệt không tạo được worker).
   1. pixel "trống" = alpha < ngưỡng · 2. loang từ mép ảnh → vùng trống BÊN NGOÀI khung · 3. vùng trống còn lại = các lỗ
   4. gán nhãn từng lỗ, bỏ lỗ < 1% diện tích · 5. dò đường viền (Moore) → phân loại:
      tứ giác xấp xỉ khớp ≥ 96% diện tích + đa giác rút gọn ~4 đỉnh + góc gần vuông → "quad" (4 điểm) · còn lại → "mask" (đa giác RDP ~1.5px).
   Kết quả: toạ độ 0..1 theo ảnh, xếp theo thứ tự đọc (trên → dưới, trái → phải). */

const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1]; // 8 hướng theo chiều kim đồng hồ, bắt đầu từ Tây

/** @param {Uint8ClampedArray} rgba @param {number} W @param {number} H @param {{thr?: number, minFrac?: number, eps?: number}} [opt] */
export function detectHoles(rgba, W, H, opt = {}) {
  const thr = opt.thr ?? 32, minFrac = opt.minFrac ?? 0.01, eps = opt.eps ?? 1.5, N = W * H;
  const st = new Uint8Array(N); // 0 đặc · 1 trống · 2 trống bên ngoài · 3 đã gán nhãn
  for (let i = 0; i < N; i++) if (rgba[i * 4 + 3] < thr) st[i] = 1;
  const q = new Int32Array(N);
  let qh = 0, qt = 0;
  const out = (i) => { if (st[i] === 1) { st[i] = 2; q[qt++] = i; } };
  for (let x = 0; x < W; x++) { out(x); out((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { out(y * W); out(y * W + W - 1); }
  while (qh < qt) { const i = q[qh++], x = i % W; if (x > 0) out(i - 1); if (x < W - 1) out(i + 1); if (i >= W) out(i - W); if (i < N - W) out(i + W); }

  const lab = new Int32Array(N), holes = [];
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (st[s] !== 1) continue;
    id++; qh = 0; qt = 0; st[s] = 3; lab[s] = id; q[qt++] = s;
    let area = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (qh < qt) {
      const i = q[qh++], x = i % W, y = (i - x) / W;
      area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1];
      for (const j of nb) if (j >= 0 && st[j] === 1) { st[j] = 3; lab[j] = id; q[qt++] = j; }
    }
    if (area >= minFrac * N) holes.push({ id, start: s, area, x0, y0, x1, y1 });
  }

  const res = holes.map((h) => {
    const c = trace(lab, W, H, h.id, h.start % W, Math.floor(h.start / W), h.area);
    const quad = quadOf(c);
    const qa = Math.abs(shoelace(quad)), fit = Math.min(qa, h.area) / Math.max(qa, h.area, 1);
    const diag = Math.hypot(h.x1 - h.x0 + 1, h.y1 - h.y0 + 1);
    const coarse = rdpClosed(c, Math.max(2, diag * 0.015));
    const right = angles(quad).every((a) => Math.abs(a - 90) <= 12);
    const isQuad = fit >= 0.96 && coarse.length <= 6 && right;
    const pts = isQuad ? quad : rdpClosed(c, eps).map(([x, y]) => [x + 0.5, y + 0.5]);
    return {
      kind: isQuad ? "quad" : "mask",
      pts: pts.map(([x, y]) => [x / W, y / H]),
      bbox: { x0: h.x0 / W, y0: h.y0 / H, x1: (h.x1 + 1) / W, y1: (h.y1 + 1) / H },
    };
  });
  res.sort((a, b) => (Math.abs(a.bbox.y0 - b.bbox.y0) < 0.05 ? a.bbox.x0 - b.bbox.x0 : a.bbox.y0 - b.bbox.y0));
  return res;
}

/** đường viền ngoài của 1 lỗ (Moore-neighbor tracing), bắt đầu ở pixel trên cùng bên trái */
function trace(lab, W, H, id, sx, sy, area) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === id;
  const pts = [[sx, sy]];
  let cx = sx, cy = sy, b = 0, guard = area * 4 + 16;
  while (guard-- > 0) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (b + k) % 8, nx = cx + DX[d], ny = cy + DY[d];
      if (!inside(nx, ny)) continue;
      const p = (b + k + 7) % 8, px = cx + DX[p], py = cy + DY[p];
      cx = nx; cy = ny;
      b = dirOf(px - cx, py - cy);
      found = true; break;
    }
    if (!found || (cx === sx && cy === sy)) break;
    pts.push([cx, cy]);
  }
  return pts;
}
function dirOf(dx, dy) { for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d; return 0; }

/** tứ giác xấp xỉ: 4 điểm cực theo đường chéo (TL, TR, BR, BL), lấy theo mép pixel */
export function quadOf(c) {
  let tl = c[0], tr = c[0], br = c[0], bl = c[0];
  for (const p of c) {
    if (p[0] + p[1] < tl[0] + tl[1]) tl = p;
    if (p[0] + p[1] > br[0] + br[1]) br = p;
    if (p[0] - p[1] > tr[0] - tr[1]) tr = p;
    if (p[0] - p[1] < bl[0] - bl[1]) bl = p;
  }
  return [[tl[0], tl[1]], [tr[0] + 1, tr[1]], [br[0] + 1, br[1] + 1], [bl[0], bl[1] + 1]];
}
function shoelace(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; } return a / 2; }
function angles(p) {
  return p.map((c, i) => {
    const a = p[(i + p.length - 1) % p.length], b = p[(i + 1) % p.length];
    const v1 = [a[0] - c[0], a[1] - c[1]], v2 = [b[0] - c[0], b[1] - c[1]];
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  });
}

/** Ramer–Douglas–Peucker cho đường khép kín (tách ở điểm xa điểm đầu nhất), không đệ quy */
export function rdpClosed(c, eps) {
  if (c.length < 4) return c.slice();
  let far = 0, fd = -1;
  for (let i = 1; i < c.length; i++) { const d = (c[i][0] - c[0][0]) ** 2 + (c[i][1] - c[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const ring = [...c, c[0]];
  const a = rdp(ring, 0, far, eps), b = rdp(ring, far, ring.length - 1, eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
function rdp(p, s, e, eps) {
  const keep = new Uint8Array(p.length); keep[s] = keep[e] = 1;
  const stack = [[s, e]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [ax, ay] = p[i0], [bx, by] = p[i1], len = Math.hypot(bx - ax, by - ay);
    let md = -1, mi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = len ? Math.abs((bx - ax) * (ay - p[i][1]) - (ax - p[i][0]) * (by - ay)) / len : Math.hypot(p[i][0] - ax, p[i][1] - ay);
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; stack.push([i0, mi], [mi, i1]); }
  }
  const out = [];
  for (let i = s; i <= e; i++) if (keep[i]) out.push(p[i]);
  return out;
}

// ---------- Web Worker: nhận { rgba, W, H, opt } → trả { holes } ----------
if (typeof self !== "undefined" && typeof window === "undefined" && typeof self.postMessage === "function") {
  self.onmessage = (e) => {
    try { const { rgba, W, H, opt } = e.data; self.postMessage({ holes: detectHoles(rgba, W, H, opt) }); }
    catch (err) { self.postMessage({ error: String(err && err.message || err) }); }
  };
}
