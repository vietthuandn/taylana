"use client";
/* Nhận diện ký tự font cut-out (admin) — chạy trên trình duyệt, KHÔNG gọi dịch vụ AI trả phí. 3 nguồn rồi gộp điểm:
   a) Tesseract (tesseract.js, tự chạy trong Web Worker): ảnh đã tiền xử lý (thường / đảo màu), PSM 10, tắt từ điển, whitelist ký tự.
   b) So khớp font mẫu: ~8 font vẽ sẵn mọi ký tự bắt buộc, tiền xử lý giống mảnh thật, so NCC + HOG trên 32 × 32.
   c) Học từ dữ liệu admin đã gán (bảng cutout_training, k láng giềng gần nhất, cosine), lưu tạm trong IndexedDB.
   Tiền xử lý + so khớp chạy trong 1 Web Worker (lib/cutoutOcr/engine.ts). */
import { getBlob, putBlob } from "@/lib/blobStore";
import { createClient } from "@/lib/supabase/client";
import { DIACRITICS, REQUIRED, SYMBOLS, TONES } from "@/lib/scrapbook/cutout";
import { engineMain } from "./engine";
import { CASE_PAIRS, OCR_CONFIG, TEMPLATE_FONTS } from "./config";

type Raw = { w: number; h: number; data: Uint8ClampedArray };
export type Prep = { vec: number[]; h: number; angle: number; variants: Raw[]; preview: Raw | null };
export type Cand = { ch: string; score: number };
export type Recog = { cands: Cand[]; unsure: boolean; prep: Prep; previewUrl: string };

// ---------- worker ----------
let wk: Worker | null = null, seq = 0;
const waiting = new Map<number, (v: unknown) => void>();
function engine() {
  if (wk) return wk;
  const url = URL.createObjectURL(new Blob([`(${engineMain.toString()})();`], { type: "text/javascript" }));
  wk = new Worker(url);
  URL.revokeObjectURL(url);
  wk.onmessage = (e) => { const r = waiting.get(e.data.id); if (r) { waiting.delete(e.data.id); r(e.data); } };
  return wk;
}
function call<T>(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
  const id = ++seq;
  return new Promise((res, rej) => {
    waiting.set(id, (v) => { const d = v as { ok: boolean; error?: string }; if (d.ok) res(v as T); else rej(new Error(d.error)); });
    engine().postMessage({ ...msg, id }, transfer);
  });
}
const dataOf = (c: HTMLCanvasElement) => { const x = c.getContext("2d", { willReadFrequently: true })!; return x.getImageData(0, 0, c.width, c.height).data; };
export async function prepCanvas(c: HTMLCanvasElement, lite = false): Promise<Prep> {
  const data = new Uint8ClampedArray(dataOf(c));
  return call<Prep>({ t: "prep", w: c.width, h: c.height, data, lite }, [data.buffer]);
}
export function rawToUrl(r: Raw) {
  const c = document.createElement("canvas"); c.width = r.w; c.height = r.h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
  return c.toDataURL("image/png");
}
const rawToCanvas = (r: Raw) => { const c = document.createElement("canvas"); c.width = r.w; c.height = r.h; c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0); return c; };

// ---------- font mẫu ----------
// dấu thanh / dấu phụ vẽ bằng ký tự đứng riêng tương ứng
const MARK_GLYPH: Record<string, string> = { "́": "´", "̀": "`", "̃": "~", "̂": "^", "̆": "˘", "̣": ".", "̉": "ˀ", "̛": "ʼ" };
const TEMPLATE_CHARS = [...new Set([...REQUIRED, ...SYMBOLS])];
let templatesReady: Promise<void> | null = null;
const TPL_CACHE = "cutout-ocr-templates-v1";
async function buildTemplates() {
  // vector font mẫu không đổi → lưu tạm IndexedDB, lần sau mở tab không phải vẽ lại
  try { const b = await getBlob(TPL_CACHE); if (b) return JSON.parse(await b.text()) as { ch: string; vec: number[] }[]; } catch { /* vẽ lại */ }
  await Promise.all(TEMPLATE_FONTS.map((f) => document.fonts.load(f, "AaĐđ0").catch(() => null)));
  const out: { ch: string; vec: number[] }[] = [];
  for (const font of TEMPLATE_FONTS) for (const ch of TEMPLATE_CHARS) {
    const c = document.createElement("canvas"); c.width = c.height = 160;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.fillStyle = "#fff"; x.fillRect(0, 0, 160, 160); x.fillStyle = "#111"; x.font = font; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(MARK_GLYPH[ch] ?? ch, 80, 84);
    out.push({ ch, vec: (await prepCanvas(c, true)).vec });
  }
  await putBlob(TPL_CACHE, new Blob([JSON.stringify(out)], { type: "application/json" })).catch(() => {});
  return out;
}

// ---------- dữ liệu học (bảng cutout_training, lưu tạm IndexedDB) ----------
const CACHE = "cutout-training-cache";
export async function loadTraining(): Promise<{ ch: string; vec: number[] }[]> {
  try {
    const sb = createClient(), all: { ch: string; vec: number[] }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("cutout_training").select("ch, vec").range(from, from + 999);
      if (error) throw error;
      all.push(...((data ?? []) as { ch: string; vec: number[] }[]));
      if (!data || data.length < 1000) break;
    }
    await putBlob(CACHE, new Blob([JSON.stringify(all)], { type: "application/json" })).catch(() => {});
    return all;
  } catch {
    const b = await getBlob(CACHE).catch(() => null);
    return b ? JSON.parse(await b.text()) : [];
  }
}
/** Nạp font mẫu + dữ liệu học vào worker (1 lần khi mở tab) */
export function initRefs() {
  templatesReady ??= (async () => { const [templates, training] = await Promise.all([buildTemplates(), loadTraining()]); await call({ t: "refs", templates, training }); })();
  return templatesReady;
}
/** Thêm mẫu học mới (sau khi admin lưu) */
export async function addTraining(rows: { glyph_id: string; ch: string; vec: number[]; font_id: string }[]) {
  if (!rows.length) return;
  await createClient().from("cutout_training").insert(rows);
  templatesReady = null; // lần nhận diện sau tải lại dữ liệu học
}

// ---------- Tesseract ----------
type TessWorker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>; setParameters: (p: Record<string, string>) => Promise<unknown>; terminate: () => Promise<unknown> };
let tess: Promise<TessWorker> | null = null;
const WHITELIST = [...new Set(TEMPLATE_CHARS.filter((c) => !(c in MARK_GLYPH)))].join("");
function tesseract() {
  tess ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const w = (await createWorker(["eng", "vie"], 1, {}, { load_system_dawg: "0", load_freq_dawg: "0" })) as unknown as TessWorker;
    await w.setParameters({ tessedit_pageseg_mode: "10", tessedit_char_whitelist: WHITELIST });
    return w;
  })();
  return tess;
}
export async function closeTesseract() { if (tess) { const w = await tess; await w.terminate(); tess = null; } }

/** Nhận diện 1 mảnh: tiền xử lý → Tesseract (2 biến thể) + font mẫu + học → gộp điểm → top 3 ứng viên */
export async function recognize(piece: HTMLCanvasElement): Promise<Recog> {
  await initRefs();
  const prep = await prepCanvas(piece);
  const tw = await tesseract();
  const tessScore: Record<string, number> = {};
  for (const v of prep.variants) {
    const r = await tw.recognize(rawToCanvas(v));
    const ch = [...r.data.text.replace(/\s/g, "")][0];
    if (ch) tessScore[ch] = Math.max(tessScore[ch] ?? 0, r.data.confidence / 100);
  }
  const m = await call<{ tmpl: Record<string, number>; knn: Record<string, number>; counts: Record<string, number> }>({ t: "match", vec: prep.vec });
  // font mẫu: chuẩn hoá về [0, 1] theo ứng viên tốt nhất (khoảng cách tương đối giữa các ký tự mới có ý nghĩa)
  const tv = Object.values(m.tmpl), tmax = Math.max(0.001, ...tv), tmin = Math.min(...tv, tmax * 0.5);
  const W = OCR_CONFIG.weights;
  const chars = new Set([...Object.keys(tessScore), ...Object.keys(m.knn), ...Object.entries(m.tmpl).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c)]);
  const cands: Cand[] = [...chars].map((ch) => {
    const t = tessScore[ch] ?? 0, f = m.tmpl[ch] !== undefined ? Math.max(0, (m.tmpl[ch] - tmin) / (tmax - tmin || 1)) * tmax : 0, l = m.knn[ch] ?? 0;
    const w3 = W.learned * Math.min(1, (m.counts[ch] ?? 0) / OCR_CONFIG.minSamples);
    return { ch, score: (W.tesseract * t + W.template * f + w3 * l) / (W.tesseract + W.template + w3) };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
  return { cands, unsure: false, prep, previewUrl: prep.preview ? rawToUrl(prep.preview) : "" };
}

/** Phân biệt hoa / thường cho các cặp dễ nhầm (c C, o O, s S…): so chiều cao chữ với các mảnh khác cùng tờ */
export function fixCase<T extends { sheet: number; recog?: Recog | null }>(items: T[]): T[] {
  const ref: Record<number, number> = {};
  for (const s of new Set(items.map((i) => i.sheet))) {
    // chiều cao tham chiếu = trung vị chiều cao các chữ HOA / số chắc chắn trên tờ (không có thì trung vị cả tờ)
    const solid = items.filter((i) => i.sheet === s && i.recog && /^[A-ZĐ0-9]$/.test(i.recog.cands[0]?.ch ?? "") && !CASE_PAIRS.includes(i.recog.cands[0].ch.toLowerCase())).map((i) => i.recog!.prep.h);
    const all = items.filter((i) => i.sheet === s && i.recog).map((i) => i.recog!.prep.h);
    const L = (solid.length >= 3 ? solid : all).sort((a, b) => a - b);
    ref[s] = L[Math.floor(L.length / 2)] ?? 0;
  }
  return items.map((it) => {
    const r = it.recog;
    if (!r?.cands[0]) return it;
    const top = r.cands[0].ch, low = top.toLowerCase();
    if (!CASE_PAIRS.includes(low) || !ref[it.sheet]) return it;
    const ratio = r.prep.h / ref[it.sheet], up = low.toUpperCase();
    const learnedUp = r.cands.find((c) => c.ch === up)?.score ?? 0, learnedLow = r.cands.find((c) => c.ch === low)?.score ?? 0;
    let pick = top, unsure = false;
    if (ratio < 0.78) pick = low;
    else if (ratio > 0.9) pick = up;
    else if (Math.abs(learnedUp - learnedLow) > 0.25) pick = learnedUp > learnedLow ? up : low;
    else unsure = true;
    const score = Math.max(learnedUp, learnedLow, r.cands[0].score);
    const other = pick === up ? low : up;
    const cands = [{ ch: pick, score }, { ch: other, score: Math.min(score, r.cands.find((c) => c.ch === other)?.score ?? score * 0.8) }, ...r.cands.filter((c) => c.ch !== up && c.ch !== low)].slice(0, 3);
    return { ...it, recog: { ...r, cands, unsure } };
  });
}
export const MARK_CHARS = [...TONES, ...DIACRITICS].map((m) => m.ch);
