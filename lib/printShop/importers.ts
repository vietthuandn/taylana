"use client";
/* Bàn in — nhập đơn: (a) file Excel / CSV xuất từ Shopee (SheetJS, trên trình duyệt), (b) ảnh chụp màn hình danh sách đơn
   (tesseract.js vie + eng, trên trình duyệt), (c) nhập tay. Kết quả chung: ImportRow (1 đơn, nhiều dòng sản phẩm). */
import { fold } from "./types";

export type Line = { product: string; variation: string; qty: number };
export type ImportRow = { key: string; order_code: string; username: string; lines: Line[]; low?: string[] }; // low: ô nhận diện kém ("username" | "l0.product"…)
export type Col = "code" | "user" | "product" | "variation" | "qty";
export const COLS: { id: Col; name: string; hints: string[] }[] = [
  { id: "code", name: "Mã đơn hàng", hints: ["ma don hang", "ma don", "order id", "order sn"] },
  { id: "user", name: "Tên người mua (username)", hints: ["nguoi mua", "username", "ten dang nhap", "buyer"] },
  { id: "product", name: "Tên sản phẩm", hints: ["ten san pham", "product name", "san pham"] },
  { id: "variation", name: "Tên phân loại hàng", hints: ["ten phan loai", "phan loai", "variation"] },
  { id: "qty", name: "Số lượng", hints: ["so luong", "quantity", "sl"] },
];
let seq = 0;
export const rowKey = () => `r${Date.now().toString(36)}${seq++}`;

// ---------- (a) Excel / CSV ----------
export type Sheet = { headers: string[]; rows: string[][] };
export async function readSheet(file: File): Promise<Sheet> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][]).map((r) => r.map((c) => String(c ?? "").trim()));
  // hàng tiêu đề = hàng đầu tiên có ≥ 2 cột nhận ra được
  const hi = Math.max(0, all.findIndex((r) => r.filter((c) => COLS.some((k) => k.hints.some((h) => fold(c).includes(h)))).length >= 2));
  return { headers: all[hi] ?? [], rows: all.slice(hi + 1).filter((r) => r.some(Boolean)) };
}
/** tự nhận cột (không phân biệt hoa thường + dấu); -1 = không nhận được */
export function guessCols(headers: string[]): Record<Col, number> {
  const out = {} as Record<Col, number>;
  for (const c of COLS) {
    // khớp gợi ý dài trước ("ten phan loai" trước "phan loai")
    let idx = -1;
    for (const h of c.hints) { idx = headers.findIndex((x) => fold(x).includes(h)); if (idx >= 0) break; }
    out[c.id] = idx;
  }
  if (out.user >= 0 && out.user === out.code) out.user = -1;
  return out;
}
/** gộp các dòng cùng mã đơn thành 1 đơn */
export function rowsFromSheet(s: Sheet, m: Record<Col, number>): ImportRow[] {
  const by = new Map<string, ImportRow>();
  for (const r of s.rows) {
    const code = m.code >= 0 ? r[m.code] : "";
    const user = m.user >= 0 ? r[m.user] : "";
    if (!code && !user) continue;
    const k = code || `${user}#${by.size}`;
    const row = by.get(k) ?? { key: rowKey(), order_code: code, username: user, lines: [] };
    row.lines.push({ product: m.product >= 0 ? r[m.product] : "", variation: m.variation >= 0 ? r[m.variation] : "", qty: Math.max(1, Number(String(m.qty >= 0 ? r[m.qty] : "1").replace(/[^\d]/g, "")) || 1) });
    by.set(k, row);
  }
  return [...by.values()];
}

// ---------- (b) ảnh chụp màn hình (OCR) ----------
type OLine = { text: string; conf: number };
export async function ocrImage(file: File, onProgress?: (p: number) => void): Promise<OLine[]> {
  const { createWorker } = await import("tesseract.js");
  const w = await createWorker(["vie", "eng"], 1, { logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.(m.progress); } });
  try {
    // phóng ảnh nhỏ lên ×2 cho chữ rõ hơn
    const bmp = await createImageBitmap(file);
    const k = bmp.width < 1400 ? 2 : 1;
    const c = document.createElement("canvas"); c.width = bmp.width * k; c.height = bmp.height * k;
    const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    const r = await (w as unknown as { recognize: (i: HTMLCanvasElement, o: object, out: object) => Promise<{ data: { text: string; confidence: number; blocks?: { paragraphs: { lines: { text: string; confidence: number }[] }[] }[] | null } }> }).recognize(c, {}, { blocks: true, text: true });
    const lines = r.data.blocks?.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({ text: l.text.trim(), conf: l.confidence })))) ?? [];
    return (lines.length ? lines : r.data.text.split("\n").map((t) => ({ text: t.trim(), conf: r.data.confidence }))).filter((l) => l.text);
  } finally { await w.terminate(); }
}
const USER = /^[a-z0-9][a-z0-9._]{2,29}$/i;
const QTY = /^[x×]\s*(\d{1,3})$/i;
const VAR = /^(variation|phan loai|phân loại)\s*[:：]?\s*/i;
const NOISE = /(₫|đ\s*$|^\d[\d.,]*\s*(₫|đ)?$|^(san pham|sản phẩm|tong|tổng|chi tiet|chọn|xem|trạng thái|da giao|chờ)\b)/i;
/** tách khối theo username: mỗi khối gồm các dòng sản phẩm (tên · "Variation: …" · "xN") */
export function rowsFromOcr(lines: OLine[]): ImportRow[] {
  const out: ImportRow[] = [];
  let cur: ImportRow | null = null, line: Line | null = null;
  const LOW = 70;
  const flush = () => { if (cur && line && (line.product || line.variation)) cur.lines.push(line); line = null; };
  for (const l of lines) {
    const t = l.text.replace(/\s+/g, " ").trim();
    if (!t || NOISE.test(fold(t)) && !QTY.test(t)) continue;
    const q = QTY.exec(t);
    if (q) { if (!line) line = { product: "", variation: "", qty: 1 }; line.qty = Number(q[1]) || 1; flush(); continue; }
    if (VAR.test(fold(t)) || VAR.test(t)) { if (!line) line = { product: "", variation: "", qty: 1 }; line.variation = t.replace(VAR, "").trim(); if (l.conf < LOW && cur) cur.low = [...(cur.low ?? []), `l${cur.lines.length}.variation`]; continue; }
    if (USER.test(t) && !/\s/.test(t) && !/^\d+$/.test(t)) {
      flush();
      cur = { key: rowKey(), order_code: "", username: t, lines: [], low: l.conf < LOW ? ["username"] : [] };
      out.push(cur); continue;
    }
    if (!cur) { cur = { key: rowKey(), order_code: "", username: "", lines: [], low: ["username"] }; out.push(cur); }
    if (line && (line.variation || line.qty > 1)) flush();
    if (!line) line = { product: "", variation: "", qty: 1 };
    line.product = line.product ? `${line.product} ${t}` : t;
    if (l.conf < LOW) cur.low = [...(cur.low ?? []), `l${cur.lines.length}.product`];
  }
  flush();
  return out.filter((r) => r.lines.length || r.username);
}
