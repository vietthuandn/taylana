// Thông số xuất file in (công cụ Admin: Dàn trang booklet, Cắt đúng khổ). Xử lý 100% trên trình duyệt.
export const DPI = 300;
export const JPG_QUALITY = 0.95;
export const COLOR_SPACE = "srgb" as const; // RGB (sRGB)

// px = round(cm / 2.54 × 300) — ví dụ 24 × 12 cm = 2835 × 1417 px, 12 × 12 cm = 1417 × 1417 px
export const cmToPx = (cm: number) => Math.round((cm / 2.54) * DPI);

export type PrintFormat = { id: string; label: string; w: number; h: number; round?: boolean }; // w, h: cm
export const PRINT_FORMATS: PrintFormat[] = [
  { id: "front", label: "Bìa trước", w: 12, h: 12 },
  { id: "back", label: "Bìa sau", w: 15, h: 11.7 },
  { id: "disc", label: "Mặt đĩa", w: 12, h: 12, round: true },
  { id: "page", label: "Trang booklet", w: 12, h: 12 },
  { id: "sheet", label: "Tờ booklet", w: 24, h: 12 },
];
export const BOOKLET_PAGE_CM = 12; // 1 trang booklet 12 × 12 cm
export const BOOKLET_SHEET = { w: 24, h: 12 }; // 1 tờ in = 2 trang

// "12x12cm", "15x11.7cm"
export const sizeTag = (w: number, h: number) => `${+w.toFixed(2)}x${+h.toFixed(2)}cm`;
