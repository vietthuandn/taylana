/* CD Scrapbook — kiểu dữ liệu dùng chung (trang khách + admin).
   Đơn vị toạ độ: mm trên mặt đĩa 120 × 120 mm, tâm (60, 60). */

export const DISC_MM = 120;
export const C = DISC_MM / 2; // tâm
export const R_OUT = 60; // đường cắt
export const R_SAFE = 57; // vùng an toàn: ảnh + chữ quan trọng nằm trong
export const R_HUB = 23; // không đặt ảnh / chữ quan trọng trong bán kính này (vùng hub)
export const R_HOLE = 7.5; // lỗ giữa 15 mm (xem trước)
export const R_PRINT_HOLE = 11.5; // file in: không in trong đường kính 23 mm
export const MIN_PHOTOS = 5, MAX_PHOTOS = 10;
export const PRINT_PX = 1417; // 12 cm @ 300 DPI

export type Style = "polaroid" | "torn" | "ring" | "magazine" | "floral";
export const STYLES: { id: Style; name: string }[] = [
  { id: "polaroid", name: "Lưới polaroid" },
  { id: "torn", name: "Xé dán tự do" },
  { id: "ring", name: "Vòng tròn" },
  { id: "magazine", name: "Tạp chí" },
  { id: "floral", name: "Hoa lá" },
];

// ---------- chất liệu (admin) ----------
export type AssetGroup = "tape" | "sticker" | "frame" | "doodle" | "texture" | "paper";
export const ASSET_GROUPS: { id: AssetGroup; name: string }[] = [
  { id: "tape", name: "Băng dính (washi tape)" },
  { id: "sticker", name: "Sticker" },
  { id: "frame", name: "Khung ảnh" },
  { id: "doodle", name: "Doodle" },
  { id: "texture", name: "Texture nền giấy" },
  { id: "paper", name: "Mảnh giấy" },
];
export const TONES: { id: string; name: string; hex: string }[] = [
  { id: "any", name: "Mọi tông", hex: "#d4d4d8" },
  { id: "pink", name: "Hồng", hex: "#f9a8d4" },
  { id: "red", name: "Đỏ", hex: "#f87171" },
  { id: "orange", name: "Cam", hex: "#fdba74" },
  { id: "yellow", name: "Vàng", hex: "#fde68a" },
  { id: "green", name: "Xanh lá", hex: "#86efac" },
  { id: "blue", name: "Xanh dương", hex: "#93c5fd" },
  { id: "purple", name: "Tím", hex: "#c4b5fd" },
  { id: "cream", name: "Kem", hex: "#f5ecd7" },
  { id: "mono", name: "Đen trắng", hex: "#a1a1aa" },
];
export type Rect01 = { x0: number; y0: number; x1: number; y1: number };
export type ScrapAsset = {
  id: string; name: string; grp: AssetGroup; url: string; tone: string; region: Rect01 | null; is_active: boolean; sort_order: number;
};
export type TemplateSetting = { n: number; style: Style; seed: number; is_active: boolean; template?: Template | null }; // template: mẫu admin chỉnh tay (đè lên mẫu tạo bằng code)

// ---------- cấu hình 1 mẫu (danh sách lớp) ----------
export type PhotoShape = "rect" | "polaroid" | "torn" | "circle" | "heart" | "frame";
export type StickerShape = "star" | "heart" | "flower" | "bow" | "sparkle";
export type Layer = LayerBase & LayerFlags;
export type LayerBase =
  | { k: "paper"; x: number; y: number; w: number; h: number; rot: number; paper: "grid" | "note" | "ticket" | "kraft"; color: string; torn: boolean; seed: number; asset?: string }
  | { k: "photo"; slot: number; x: number; y: number; w: number; h: number; rot: number; shape: PhotoShape; seed: number; asset?: string; border?: string }
  | { k: "tape"; x: number; y: number; w: number; h: number; rot: number; color: string; pattern: "stripe" | "dots" | "plain"; seed: number; asset?: string }
  | { k: "sticker"; x: number; y: number; s: number; rot: number; shape: StickerShape; color: string; asset?: string }
  | { k: "doodle"; x: number; y: number; s: number; rot: number; shape: "arrow" | "swirl" | "dash"; color: string; asset?: string }
  | { k: "text"; role: "main" | "sub" | "custom"; x: number; y: number; w: number; size: number; rot: number; font: "hand" | "marker" | "label"; color: string; arc?: { r: number; mid: number };
      value?: string; // nội dung riêng (lớp chữ khách thêm); main / sub lấy từ "Chữ trên đĩa"
      family?: string; bold?: boolean; italic?: boolean; stroke?: boolean; // font thường (đè lên font mẫu)
      cutout?: { font: string; curve: number; chaos: number; spacing: number; seed: number } }; // chữ cắt dán
/** cờ chung của mọi lớp: user = khách tự thêm (giữ lại khi đổi mẫu) · locked = admin khoá (khách không chọn được) */
export type LayerFlags = { user?: boolean; locked?: boolean };
export type Template = {
  id: string; n: number; style: Style; seed: number;
  bg: { color: string; pattern: "dots" | "grid" | "plain" | "lines"; ink: string; asset?: string };
  layers: Layer[];
};

// chỉnh ô của khách: dịch (mm) + phóng to (≥ 1), theo ảnh (id ảnh)
export type Adjust = { dx: number; dy: number; zoom: number };
export type DiscText = { main: string; sub: string };
