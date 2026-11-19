/* Chia sẻ mockup (chỉ admin): link xem chỉ đọc /m/<token>, hết hạn sau 24 giờ rồi bị xoá hẳn (ảnh + dữ liệu).
   Ảnh lưu ở bucket RIÊNG TƯ "mockup-shares/<share_id>/", state lưu đường dẫn ảnh (không lưu dữ liệu ảnh). */
import type { MockupView } from "@/components/mockup-viewer/CdMockupTab";
import type { TrayStyle } from "@/lib/mockup/types";

export const SHARE_BUCKET = "mockup-shares";
export const SHARE_TTL_MS = 24 * 3600 * 1000;
export type ShareBg = { kind: "gradient"; id: string } | { kind: "shop"; url: string; name: string } | { kind: "file"; path: string };
export type ShareState = {
  v: 1;
  pkgName: string; layout: { front: number; back: number; disc: boolean }; box: boolean;
  slots: Record<string, string>; // ô ảnh (f1, f2…, b1, b2, d) → đường dẫn trong bucket
  bg: ShareBg; view: Partial<MockupView>; booklet: boolean; // đang xem Booklet?
  tray: TrayStyle; finish: "matte" | "gloss"; modelUrl: string | null; thumb?: string;
};
export type ShareRow = { id: string; token: string; state: ShareState; created_at: string; expires_at: string; view_count: number };
/** token ngẫu nhiên base62, 22 ký tự (~131 bit) */
export function newToken(): string {
  const A = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let out = "";
  for (const x of b) { if (x < 248) out += A[x % 62]; if (out.length === 22) break; } // bỏ giá trị ≥ 248 để không lệch phân bố
  return out.length === 22 ? out : newToken();
}
export const fmtExpire = (iso: string) => { const d = new Date(iso); return `Hết hạn lúc ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ngày ${d.getDate()}/${d.getMonth() + 1}`; };
export function fmtLeft(ms: number) {
  if (ms <= 0) return "đã hết hạn";
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h} giờ ${m % 60} phút` : `${m} phút`;
}
