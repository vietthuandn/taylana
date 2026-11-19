"use client";
/* Tách nền AI trên trình duyệt (dùng chung: modal "Tải sticker của bạn", lib/stickerSlicer…).
   Thư viện + mô hình chỉ tải khi cần (lần đầu), lưu Cache Storage. Ảnh của khách xử lý hoàn toàn trên máy, không gửi đi đâu. */
import { BG_CONFIG, type BgModel } from "./config";
import { bgWorkerMain } from "./worker";

export type BgMode = "auto" | "portrait" | "object";
export type LoadProgress = { loaded: number; total: number; cached: boolean };
type Pending = { res: (v: unknown) => void; rej: (e: Error) => void };

let worker: Worker | null = null;
let seq = 0;
const waits = new Map<number, Pending>();
const progress: Record<string, { loaded: number; total: number; cached?: boolean }> = {};
let onProgress: ((p: LoadProgress) => void) | null = null;
const loaded = new Map<string, Promise<unknown>>();

function getWorker() {
  if (worker) return worker;
  const url = URL.createObjectURL(new Blob([`(${bgWorkerMain.toString()})();`], { type: "text/javascript" }));
  worker = new Worker(url, { type: "module" });
  URL.revokeObjectURL(url);
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.t === "progress") {
      progress[m.key] = { loaded: m.loaded, total: m.total, cached: m.cached };
      const vals = Object.values(progress);
      onProgress?.({ loaded: vals.reduce((a, v) => a + v.loaded, 0), total: vals.reduce((a, v) => a + v.total, 0), cached: vals.every((v) => v.cached) });
      return;
    }
    const w = waits.get(m.id);
    if (!w) return;
    waits.delete(m.id);
    if (m.t === "err") w.rej(new Error(m.error)); else w.res(m);
  };
  worker.onerror = (e) => { for (const w of waits.values()) w.rej(new Error(e.message || "Lỗi bộ tách nền")); waits.clear(); };
  return worker;
}
function call<T>(msg: Record<string, unknown>, tr: Transferable[] = []): Promise<T> {
  const id = ++seq;
  return new Promise<T>((res, rej) => { waits.set(id, { res: res as (v: unknown) => void, rej }); getWorker().postMessage({ ...msg, id }, tr); });
}
/** Nạp thư viện + các mô hình cần cho chế độ (auto = cả 2). onProg: tiến độ tải (byte). */
export async function prepareBg(mode: BgMode, onProg?: (p: LoadProgress) => void) {
  onProgress = onProg ?? null;
  const keys: BgModel[] = mode === "auto" ? ["portrait", "object"] : [mode];
  for (const k of keys) if (!progress[k]) progress[k] = { loaded: 0, total: BG_CONFIG.models[k].sizeMB * 1024 * 1024 };
  if (!loaded.has("ort")) loaded.set("ort", call({ t: "init", ortUrl: BG_CONFIG.ortUrl, wasmBase: BG_CONFIG.ortWasmBase }).catch((e) => { loaded.delete("ort"); throw e; }));
  await loaded.get("ort");
  await Promise.all(keys.map((k) => {
    if (!loaded.has(k)) loaded.set(k, call({ t: "load", key: k, url: BG_CONFIG.models[k].url, cacheName: BG_CONFIG.cacheName, guess: BG_CONFIG.models[k].sizeMB * 1024 * 1024 }).catch((e) => { loaded.delete(k); throw e; }));
    return loaded.get(k);
  }));
}
/** Mặt nạ alpha (0..255) đúng kích thước ảnh vào. used: mô hình đã dùng. */
export async function removeBackground(img: { w: number; h: number; data: Uint8ClampedArray }, mode: BgMode, onProg?: (p: LoadProgress) => void) {
  await prepareBg(mode, onProg);
  const data = new Uint8ClampedArray(img.data);
  const r = await call<{ alpha: Uint8Array; used: BgModel; ep: string }>({ t: "run", mode, data, w: img.w, h: img.h, runSize: BG_CONFIG.runSize, u2Size: BG_CONFIG.models.object.input }, [data.buffer]);
  return { alpha: r.alpha, used: r.used, ep: r.ep };
}
export { BG_CONFIG };
