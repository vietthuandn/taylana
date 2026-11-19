/* Template Canva (trang Thiết Kế → thẻ "Thiết kế từ Canva Template"): admin quản lý ở Admin → Template Canva.
   Bảng canva_templates + cài đặt nút ở site_settings "canva_button". */
export type CanvaKind = "front" | "back" | "cd" | "other";
export const CANVA_KINDS: { id: CanvaKind; name: string; aspect: number }[] = [
  { id: "front", name: "Bìa trước", aspect: 1 },
  { id: "back", name: "Bìa sau", aspect: 15 / 11.7 },
  { id: "cd", name: "CD", aspect: 1 },
  { id: "other", name: "Khác", aspect: 1 },
];
export type CanvaTemplate = { id: string; name: string; size_label: string; kind: CanvaKind; image_url: string | null; canva_url: string; is_active: boolean; sort_order: number };
export type CanvaButton = { icon_url: string | null; label: string };
export const DEFAULT_CANVA_BUTTON: CanvaButton = { icon_url: null, label: "Dùng template" };
export const mergeCanvaButton = (v?: Partial<CanvaButton> | null): CanvaButton => ({ icon_url: v?.icon_url || null, label: v?.label?.trim() || DEFAULT_CANVA_BUTTON.label });
/** link Canva hợp lệ: https + tên miền canva.com hoặc canva.link */
export function isCanvaUrl(u: string) {
  try { const x = new URL(u.trim()); return x.protocol === "https:" && /(^|\.)canva\.(com|link)$/i.test(x.hostname); } catch { return false; }
}
