"use client";
/* Tách nền AI trên trình duyệt (dùng chung: modal "Tải sticker của bạn", lib/stickerSlicer…).
   Thư viện + mô hình chỉ tải khi cần (lần đầu), lưu Cache Storage sau khi khởi tạo thành công.
   Mọi bước có thời hạn: tải 60 giây · khởi động 30 giây · chạy 30 giây. Quá hạn / lỗi → huỷ Worker, lần sau làm lại từ đầu.
   Ảnh của khách xử lý hoàn toàn trên máy, không gửi đi đâu. */
import { BG_CONFIG, type BgModel } from "./config";
import { bgWorkerMain } from "./worker";

export type BgMode = "auto" | "portrait" | "object";
export type BgStep = { k: "load"; loaded: number; total: number; cached: boolean } | { k: "init" } | { k: "run" };
export type LoadProgress = { loaded: number; total: number; cached: boolean };
type Pending = { res: (v: unknown) => void; rej: (e: Error) => void };
const LIMIT = { fetch: 60000, init: 30000, run: 30000 };

let worker: Worker | null = null;
let seq = 0;
const waits = new Map<number, Pending>();
const progress: Record<string, { loaded: number; total: number; cached?: boolean }> = {};
let onStep: ((s: BgStep) => void) | null = null;
const done = new Map<string, Promise<unknown>>();

/** huỷ Worker + quên mọi bước đã làm (dùng khi lỗi / quá hạn / xoá bộ nhớ đệm) */
export function resetBg(reason = "Đã huỷ") {
  worker?.terminate(); worker = null;
  for (const w of waits.values()) w.rej(new Error(reason));
  waits.clear(); done.clear();
  for (const k of Object.keys(progress)) delete progress[k];
}
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
      onStep?.({ k: "load", loaded: vals.reduce((a, v) => a + v.loaded, 0), total: vals.reduce((a, v) => a + v.total, 0), cached: vals.every((v) => v.cached) });
      return;
    }
    if (m.t === "fatal") { resetBg(m.error); return; } // lỗi trong Worker ngoài các lệnh đang chờ → không để treo
    const w = waits.get(m.id);
    if (!w) return;
    waits.delete(m.id);
    if (m.t === "err") w.rej(new Error(m.error)); else w.res(m);
  };
  worker.onerror = (e) => { e.preventDefault?.(); resetBg(e.message || "Lỗi bộ tách nền"); };
  worker.onmessageerror = () => resetBg("Lỗi trao đổi dữ liệu với bộ tách nền");
  return worker;
}
function call<T>(msg: Record<string, unknown>, ms: number, tr: Transferable[] = []): Promise<T> {
  const id = ++seq;
  return new Promise<T>((res, rej) => {
    const timer = setTimeout(() => { waits.delete(id); resetBg("Quá thời gian"); rej(new Error("Quá thời gian")); }, ms);
    waits.set(id, { res: (v) => { clearTimeout(timer); res(v as T); }, rej: (e) => { clearTimeout(timer); rej(e); } });
    getWorker().postMessage({ ...msg, id }, tr);
  });
}
const once = (key: string, f: () => Promise<unknown>) => {
  if (!done.has(key)) done.set(key, f().catch((e) => { done.delete(key); throw e; }));
  return done.get(key)!;
};
/** Nạp thư viện + mô hình cần cho chế độ (auto = cả 2): tải (báo tiến độ) → khởi động. */
export async function prepareBg(mode: BgMode, step?: (s: BgStep) => void) {
  onStep = step ?? null;
  const keys: BgModel[] = mode === "auto" ? ["portrait", "object"] : [mode];
  for (const k of keys) if (!progress[k]) progress[k] = { loaded: 0, total: BG_CONFIG.models[k].sizeMB * 1024 * 1024 };
  step?.({ k: "load", loaded: 0, total: Object.values(progress).reduce((a, v) => a + v.total, 0), cached: false });
  await once("ort", () => call({ t: "init", ortUrl: BG_CONFIG.ortUrl, wasmBase: BG_CONFIG.ortWasmBase }, LIMIT.fetch));
  await Promise.all(keys.map((k) => once(`fetch:${k}`, () => call({ t: "fetch", key: k, url: BG_CONFIG.models[k].url, cacheName: BG_CONFIG.cacheName, guess: BG_CONFIG.models[k].sizeMB * 1024 * 1024 }, LIMIT.fetch))));
  step?.({ k: "init" });
  for (const k of keys) await once(`create:${k}`, () => call({ t: "create", key: k, url: BG_CONFIG.models[k].url, cacheName: BG_CONFIG.cacheName }, LIMIT.init));
}
/** Mặt nạ alpha (0..255) đúng kích thước ảnh vào. used: mô hình đã dùng. */
export async function removeBackground(img: { w: number; h: number; data: Uint8ClampedArray }, mode: BgMode, step?: (s: BgStep) => void) {
  await prepareBg(mode, step);
  step?.({ k: "run" });
  const data = new Uint8ClampedArray(img.data);
  const r = await call<{ alpha: Uint8Array; used: BgModel; ep: string }>({ t: "run", mode, data, w: img.w, h: img.h, runSize: BG_CONFIG.runSize, u2Size: BG_CONFIG.models.object.input }, LIMIT.run, [data.buffer]);
  return { alpha: r.alpha, used: r.used, ep: r.ep };
}
/** "Xoá bộ nhớ đệm và thử lại": xoá mô hình đã lưu + huỷ Worker */
export async function clearBgCache() {
  resetBg("Đã xoá bộ nhớ đệm");
  try { await caches.delete(BG_CONFIG.cacheName); } catch { /* bỏ */ }
}
export { BG_CONFIG };
