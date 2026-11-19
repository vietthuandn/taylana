/* Web Worker tách nền (module worker dựng từ mã nguồn của hàm này — mọi hàm phụ nằm BÊN TRONG, không import ngoài).
   - "init": nạp onnxruntime-web (dynamic import từ CDN, ghim phiên bản), WebGPU nếu có, không thì WASM.
   - "fetch": tải mô hình (Cache Storage trước — kiểm tra dung lượng, hỏng thì xoá; không có thì tải mạng + báo tiến độ).
   - "create": khởi tạo phiên chạy (WebGPU có hạn, lỗi thì WASM); thành công mới ghi mô hình vào Cache Storage.
   - "run": ảnh gốc RGBA → thu về cạnh dài ~1024 (MODNet, bội số 32) / 320 × 320 (U²-Netp) → mặt nạ alpha
     → phóng lại đúng kích thước gốc bằng lọc có hướng (guided filter theo ảnh gốc) để mép sắc. "auto": MODNet trước,
     nếu không giống người (ngưỡng từ chính mặt nạ MODNet) thì chạy U²-Netp. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function bgWorkerMain() {
  const S: any = self;
  let ort: any = null;
  let ep = "wasm";
  const sessions: Record<string, any> = {};
  const post = (m: any, tr?: Transferable[]) => S.postMessage(m, tr ?? []);

  const bufs: Record<string, { buf: ArrayBuffer; cached: boolean }> = {};
  const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) => new Promise<T>((res, rej) => { const t = setTimeout(() => rej(new Error(`Quá thời gian (${what})`)), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });
  async function init(ortUrl: string, wasmBase: string) {
    if (ort) return;
    // import() qua Function: bundler không đụng tới (thư viện tải từ CDN, ghim phiên bản)
    const dyn = new Function("u", "return import(u)") as (u: string) => Promise<any>;
    const mod = await dyn(ortUrl);
    ort = mod.default ?? mod;
    ort.env.wasm.wasmPaths = wasmBase; // file .wasm / .mjs lấy từ CDN cùng phiên bản
    ort.env.wasm.numThreads = S.crossOriginIsolated ? Math.min(4, S.navigator?.hardwareConcurrency || 2) : 1; // đa luồng cần crossOriginIsolated
    ort.env.wasm.proxy = false;
  }
  /** tải mô hình: Cache Storage (kiểm tra dung lượng khớp, hỏng thì xoá) → không có thì tải mạng + báo tiến độ. CHƯA ghi cache ở bước này. */
  async function fetchModel(key: string, url: string, cacheName: string, guess: number) {
    try {
      const cache = await caches.open(cacheName), hit = await cache.match(url);
      if (hit) {
        const want = Number(hit.headers.get("x-size")) || 0, b = await hit.arrayBuffer();
        if (want > 0 && b.byteLength === want) { bufs[key] = { buf: b, cached: true }; post({ t: "progress", key, loaded: b.byteLength, total: b.byteLength, cached: true }); return b.byteLength; }
        await cache.delete(url); // cache hỏng → xoá, tải lại
      }
    } catch { /* không dùng được Cache Storage → tải mạng */ }
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok || !r.body) throw new Error(`Không tải được mô hình (${r.status})`);
    const total = Number(r.headers.get("content-length")) || guess;
    const reader = r.body.getReader(), chunks: Uint8Array[] = [];
    let loaded = 0, last = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); loaded += value.byteLength;
      if (loaded - last > 256 * 1024) { last = loaded; post({ t: "progress", key, loaded, total }); }
    }
    const cl = Number(r.headers.get("content-length")) || 0;
    if (cl && loaded !== cl) throw new Error("Tải mô hình không đủ dung lượng");
    post({ t: "progress", key, loaded, total: loaded });
    const buf = new Uint8Array(loaded);
    let o = 0; for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
    bufs[key] = { buf: buf.buffer, cached: false };
    return loaded;
  }
  /** khởi tạo phiên chạy: WebGPU (có hạn 15 giây) → lỗi / quá hạn thì WASM. Thành công mới ghi mô hình vào Cache Storage. */
  async function create(key: string, url: string, cacheName: string) {
    if (sessions[key]) return;
    const b = bufs[key];
    if (!b) throw new Error("Chưa tải mô hình");
    const bytes = new Uint8Array(b.buf);
    try {
      if (S.navigator?.gpu) {
        try { sessions[key] = await withTimeout(ort.InferenceSession.create(bytes.slice(), { executionProviders: ["webgpu"] }), 12000, "WebGPU"); ep = "webgpu"; }
        catch { sessions[key] = null; }
      }
      if (!sessions[key]) { sessions[key] = await ort.InferenceSession.create(bytes.slice(), { executionProviders: ["wasm"] }); ep = "wasm"; }
    } catch (e) {
      if (b.cached) { try { await (await caches.open(cacheName)).delete(url); } catch { /* bỏ */ } }
      delete bufs[key];
      throw e;
    }
    if (!b.cached) {
      try { await (await caches.open(cacheName)).put(url, new Response(b.buf, { headers: { "content-type": "application/octet-stream", "x-size": String(b.buf.byteLength) } })); } catch { /* hết chỗ / chế độ riêng tư */ }
    }
    delete bufs[key];
  }
  // lỗi xảy ra ngoài các lệnh await (vd. trong thư viện) → báo về trang chính, không để treo
  S.addEventListener("unhandledrejection", (e: any) => post({ t: "fatal", error: String(e?.reason?.message ?? e?.reason ?? "Lỗi bộ tách nền") }));
  S.addEventListener("error", (e: any) => post({ t: "fatal", error: String(e?.message ?? "Lỗi bộ tách nền") }));

  // ---------- ảnh ----------
  function resize(data: Uint8ClampedArray, w: number, h: number, W: number, H: number) {
    const src = new OffscreenCanvas(w, h); src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
    const dst = new OffscreenCanvas(W, H); const x = dst.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, W, H);
    return x.getImageData(0, 0, W, H).data;
  }
  function toTensor(px: Uint8ClampedArray, W: number, H: number, mean: number[], std: number[], scale = 1 / 255) {
    const n = W * H, t = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) t[c * n + i] = (px[i * 4 + c] * scale - mean[c]) / std[c];
    return t;
  }
  async function runModnet(data: Uint8ClampedArray, w: number, h: number, size: number) {
    const k = size / Math.max(w, h), W = Math.max(32, Math.round((w * k) / 32) * 32), H = Math.max(32, Math.round((h * k) / 32) * 32);
    const s = sessions.portrait, px = resize(data, w, h, W, H);
    const input = new ort.Tensor("float32", toTensor(px, W, H, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [1, 3, H, W]);
    const out = await s.run({ [s.inputNames[0]]: input });
    const a = out[s.outputNames[0]].data as Float32Array;
    return { a: Float32Array.from(a, (v) => Math.min(1, Math.max(0, v))), W, H };
  }
  async function runU2(data: Uint8ClampedArray, w: number, h: number, size: number) {
    const s = sessions.object, px = resize(data, w, h, size, size);
    let max = 1; for (let i = 0; i < px.length; i++) if (i % 4 !== 3 && px[i] > max) max = px[i];
    const input = new ort.Tensor("float32", toTensor(px, size, size, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225], 1 / max), [1, 3, size, size]);
    const out = await s.run({ [s.inputNames[0]]: input });
    const a = out[s.outputNames[0]].data as Float32Array;
    let lo = Infinity, hi = -Infinity; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return { a: Float32Array.from(a, (v) => (v - lo) / (hi - lo || 1)), W: size, H: size };
  }
  /** mặt nạ MODNet có giống người không: tỉ lệ nền / người hợp lý + mặt nạ dứt khoát + 1 khối chính */
  function personLike(a: Float32Array, W: number, H: number) {
    let fg = 0, sure = 0;
    for (const v of a) { if (v > 0.5) fg++; if (v < 0.15 || v > 0.85) sure++; }
    const n = a.length, cover = fg / n;
    if (cover < 0.04 || cover > 0.92 || sure / n < 0.85) return false;
    // khối lớn nhất trên lưới 64 × 64
    const G = 64, gw = G, gh = G, g = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) g[y * gw + x] = a[Math.floor((y / gh) * H) * W + Math.floor((x / gw) * W)] > 0.5 ? 1 : 0;
    const seen = new Uint8Array(g.length); let best = 0, tot = 0;
    for (let i = 0; i < g.length; i++) {
      if (!g[i] || seen[i]) continue;
      let c = 0; const st = [i]; seen[i] = 1;
      while (st.length) { const p = st.pop()!; c++; const x = p % gw; for (const q of [p - 1, p + 1, p - gw, p + gw]) { if (q < 0 || q >= g.length || seen[q] || !g[q] || Math.abs((q % gw) - x) > 1) continue; seen[q] = 1; st.push(q); } }
      tot += c; if (c > best) best = c;
    }
    return tot > 0 && best / tot > 0.7;
  }
  // ---------- phóng mặt nạ về kích thước gốc + lọc có hướng (guided filter) ----------
  function boxMean(src: Float32Array, w: number, h: number, r: number) {
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += src[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        out[y * w + x] = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      }
    }
    return out;
  }
  function upsample(a: Float32Array, W: number, H: number, w: number, h: number) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = Math.min(H - 1, Math.max(0, ((y + 0.5) * H) / h - 0.5)), y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.min(W - 1, Math.max(0, ((x + 0.5) * W) / w - 0.5)), x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), tx = fx - x0;
        out[y * w + x] = (a[y0 * W + x0] * (1 - tx) + a[y0 * W + x1] * tx) * (1 - ty) + (a[y1 * W + x0] * (1 - tx) + a[y1 * W + x1] * tx) * ty;
      }
    }
    return out;
  }
  function guided(data: Uint8ClampedArray, w: number, h: number, p: Float32Array, r: number, eps: number) {
    const n = w * h, I = new Float32Array(n);
    for (let i = 0; i < n; i++) I[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
    const II = new Float32Array(n), Ip = new Float32Array(n);
    for (let i = 0; i < n; i++) { II[i] = I[i] * I[i]; Ip[i] = I[i] * p[i]; }
    const mI = boxMean(I, w, h, r), mp = boxMean(p, w, h, r), mII = boxMean(II, w, h, r), mIp = boxMean(Ip, w, h, r);
    const A = new Float32Array(n), B = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = mII[i] - mI[i] * mI[i], c = mIp[i] - mI[i] * mp[i]; A[i] = c / (v + eps); B[i] = mp[i] - A[i] * mI[i]; }
    const mA = boxMean(A, w, h, r), mB = boxMean(B, w, h, r), out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.round(Math.min(1, Math.max(0, mA[i] * I[i] + mB[i])) * 255);
    return out;
  }

  S.onmessage = async (e: MessageEvent) => {
    const m = e.data;
    try {
      if (m.t === "init") { await init(m.ortUrl, m.wasmBase); post({ t: "ok", id: m.id, ep }); return; }
      if (m.t === "fetch") { const bytes = sessions[m.key] ? 0 : await fetchModel(m.key, m.url, m.cacheName, m.guess); post({ t: "ok", id: m.id, bytes }); return; }
      if (m.t === "create") { await create(m.key, m.url, m.cacheName); post({ t: "ok", id: m.id, ep }); return; }
      if (m.t === "run") {
        const { data, w, h } = m as { data: Uint8ClampedArray; w: number; h: number };
        let used: "portrait" | "object" = m.mode === "object" ? "object" : "portrait";
        let r = used === "portrait" ? await runModnet(data, w, h, m.runSize) : await runU2(data, w, h, m.u2Size);
        if (m.mode === "auto" && !personLike(r.a, r.W, r.H)) { used = "object"; r = await runU2(data, w, h, m.u2Size); }
        const up = upsample(r.a, r.W, r.H, w, h);
        const alpha = guided(data, w, h, up, Math.max(2, Math.round(Math.max(w, h) / 400)), 1e-3);
        post({ t: "ok", id: m.id, alpha, used, ep }, [alpha.buffer]);
        return;
      }
    } catch (err: any) { post({ t: "err", id: m.id, error: String(err?.message ?? err) }); }
  };
}
