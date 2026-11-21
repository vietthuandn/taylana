import { FONT_CATALOG } from "@/lib/fonts/catalog";
/* Booklet Lyrics — kiểu dữ liệu + cài đặt mặc định (admin sửa ở Admin → Booklet Lyrics, lưu site_settings "lyrics_booklet").
   Đơn vị dàn trang: mm. 1 trang booklet 120 × 120 mm. */

export const PAGE_MM = 120;
export const SAFE_MM = 5; // lề an toàn
export const GUTTER_MM = 7; // lề phía gáy
export const PT = 0.3528; // 1 pt = 0.3528 mm
export const PACKS = [4, 8, 12, 16] as const;
export const MAX_SONGS = 20;

export type Song = {
  id: string; title: string; duration: string; lyrics: string; note: string; titleOnly: boolean;
  artist?: string; // ca sĩ (tìm lời gợi ý) — trống thì dùng Tên nghệ sĩ của album
  alt?: string; // dòng "A - B" nhập từ danh sách: phía còn lại (tìm lời thử cả 2 chiều)
  pending?: boolean; // (cũ — không dùng nữa; bản nháp cũ có cờ này được đổi thành src "lrclib" khi mở)
  src?: "lrclib"; // lời lấy từ LRCLIB (hiện ghi chú "có thể chưa chính xác" trong modal lyrics)
  style?: LyricStyle; // kiểu lời riêng của bài (trống = theo cài đặt chung)
  labels?: Record<string, string>; // tên nhãn cho từng đoạn lặp (khoá đoạn → tên)
  noMerge?: string[]; // các đoạn lặp KHÔNG gộp
};
export type LyricStyle = "original" | "collapse" | "inline";
export type FontSizeId = "normal" | "small" | "xsmall";
/** Cách trình bày lời cho cả booklet */
export type FlowMode = "block" | "chain"; // Xếp bài: mỗi bài 1 khối · nối đuôi (chảy liên tục qua các cột)
export type LyricsFormat = { size: FontSizeId; style: LyricStyle; lang: "en" | "vi"; paraBreak: "slashes" | "newline"; titleInline: boolean; flow?: FlowMode };
export const DEFAULT_FORMAT: LyricsFormat = { size: "normal", style: "original", lang: "en", paraBreak: "slashes", titleInline: false, flow: "block" };
export const FONT_SIZES: { id: FontSizeId; name: string; pt: number; min: number }[] = [
  { id: "normal", name: "Bình thường", pt: 7.5, min: 6.5 },
  { id: "small", name: "Nhỏ", pt: 6.5, min: 5.5 },
  { id: "xsmall", name: "Rất nhỏ", pt: 5.5, min: 5 },
];
/** coverText: chèn tên album + nghệ sĩ lên bìa (mặc định bật; tắt → bìa chỉ có ảnh tràn trang) */
export type Album = { title: string; artist: string; coverText?: boolean };
export type Palette = { id: string; name: string; bg: string; ink: string; accent: string };
export type LayoutId = "minimal" | "alternate" | "magazine" | "cinema" | "polaroid";
export type BackId = "classic" | "twocol" | "photo" | "corner";

export const LAYOUTS: { id: LayoutId; name: string }[] = [
  { id: "minimal", name: "Tối giản" },
  { id: "alternate", name: "Ảnh xen kẽ" },
  { id: "magazine", name: "Tạp chí" },
  { id: "cinema", name: "Điện ảnh" },
  { id: "polaroid", name: "Polaroid" },
];
export const BACKS: { id: BackId; name: string }[] = [
  { id: "classic", name: "Danh sách cổ điển" },
  { id: "twocol", name: "Hai cột" },
  { id: "photo", name: "Ảnh nền + tracklist" },
  { id: "corner", name: "Tối giản chữ nhỏ" },
];
// font tiêu đề / lời: font gốc + toàn bộ font Google có tiếng Việt (lib/fonts/catalog.ts — tải khi cần)
export const TITLE_FONTS = [...new Set(["Bricolage Grotesque", "Oswald", "Be Vietnam Pro", "Dancing Script", "Anton", ...FONT_CATALOG.map((f) => f.family)])];
export const BODY_FONTS = [...new Set(["Be Vietnam Pro", "Inter", ...FONT_CATALOG.filter((f) => f.group !== "display").map((f) => f.family)])];

export type LyricsSettings = {
  longLines: number; // bài dài hơn số dòng này chiếm nguyên 1 trang
  maxLines: number; // tối đa số dòng 1 bài
  minFontPt: number; // cỡ chữ lời tối thiểu
  titleFont: string; bodyFont: string;
  palettes: Palette[];
  layouts: Record<LayoutId, boolean>; // bật / tắt mẫu dàn trang
  backs: Record<BackId, boolean>; // bật / tắt mẫu bìa sau
};
export const DEFAULT_PALETTES: Palette[] = [
  { id: "cream", name: "Kem", bg: "#f6efe2", ink: "#3b3127", accent: "#a8763e" },
  { id: "white", name: "Trắng", bg: "#ffffff", ink: "#1f1f23", accent: "#ff5fa2" },
  { id: "black", name: "Đen", bg: "#141416", ink: "#f4f4f5", accent: "#f5c77e" },
  { id: "pink", name: "Pastel hồng", bg: "#fde8ee", ink: "#4a2731", accent: "#e0607e" },
  { id: "sage", name: "Xanh sage", bg: "#e8efe6", ink: "#27352a", accent: "#5f8b63" },
  { id: "navy", name: "Xanh đêm", bg: "#1d2a44", ink: "#eef2fb", accent: "#9fb8e8" },
];
export const DEFAULT_SETTINGS: LyricsSettings = {
  longLines: 45, maxLines: 90, minFontPt: 6.5, titleFont: "Bricolage Grotesque", bodyFont: "Be Vietnam Pro",
  palettes: DEFAULT_PALETTES,
  layouts: { minimal: true, alternate: true, magazine: true, cinema: true, polaroid: true },
  backs: { classic: true, twocol: true, photo: true, corner: true },
};
export const MAX_LINE_CHARS = 140;
export function mergeSettings(v: Partial<LyricsSettings> | null | undefined): LyricsSettings {
  const s = { ...DEFAULT_SETTINGS, ...(v ?? {}) };
  return { ...s, palettes: v?.palettes?.length ? v.palettes : DEFAULT_PALETTES, layouts: { ...DEFAULT_SETTINGS.layouts, ...(v?.layouts ?? {}) }, backs: { ...DEFAULT_SETTINGS.backs, ...(v?.backs ?? {}) } };
}

// ---------- kết quả dàn trang ----------
export type Block =
  | { k: "photo"; slot: number; x: number; y: number; w: number; h: number; rot?: number; polaroid?: boolean } // có thể tràn ra ngoài trang (ảnh tràn 2 trang)
  | { k: "lyrics"; songs: number[]; x: number; y: number; w: number; h: number }
  | { k: "flow"; from: number; to: number; x: number; y: number; w: number; h: number } // "Nối đuôi": các cột [from, to) của luồng chữ
  | { k: "cover"; x: number; y: number; w: number; h: number }; // bìa: ảnh bìa riêng (+ tên album nếu bật)
export type Page = { no: number; blocks: Block[] };
export type Adjust = { dx: number; dy: number; zoom: number };
