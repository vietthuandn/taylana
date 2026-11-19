/* Scrapbook — kiểu dữ liệu dùng chung (CD Template + Booklet Template, trang khách + admin).
   Đơn vị toạ độ: mm trên "bề mặt" (surface): đĩa 120 × 120 mm tâm (60, 60) · trang 120 × 120 mm · cặp trang 240 × 120 mm. */

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
/** surface_type: "disc" (CD Template) · "spread" (Booklet Template: n = kiểu dàn trang cặp) */
export type TemplateSetting = { n: number; style: Style; seed: number; is_active: boolean; template?: Template | null; surface_type?: string; name?: string | null; sort_order?: number | null };
/** mẫu CD / Booklet Template admin tạo mới / nhân bản (bảng scrapbook_templates). CD: n = số ảnh · Booklet: n = số trang */
export type CustomTemplate = { id: string; name: string; surface: "disc" | "booklet"; n: number; style: Style | null; config: { surfaces: Template[] }; is_active: boolean; sort_order: number; created_at?: string };

// ---------- thư viện Khung ảnh (admin) ----------
export type FrameSet = { id: string; name: string; is_active: boolean; sort_order: number };
/** region: vùng ảnh nằm dưới khung (0..1) · mask_url: ảnh mặt nạ đen trắng (trắng = vùng ảnh) · ratio = cao / rộng của ảnh khung */
export type Frame = { id: string; set_id: string; name: string; url: string; region: Rect01 | null; mask_url: string | null; ratio: number; is_active: boolean; sort_order: number; allow_stretch?: boolean };
// ---------- thư viện Lời chúc (admin) ----------
export type WishTopic = { id: string; name: string; is_active: boolean; sort_order: number };
export type Wish = { id: string; topic_id: string; content: string; lang: "vi" | "en"; is_active: boolean; sort_order: number };
export type WishCard = "card" | "note" | "lined" | "label";
export type SurfaceKind = "disc" | "page" | "spread"; // template: mẫu admin chỉnh tay (đè lên mẫu tạo bằng code)

// ---------- cấu hình 1 mẫu (danh sách lớp) ----------
export type PhotoShape = "rect" | "polaroid" | "torn" | "circle" | "heart" | "frame";
export type StickerShape = "star" | "heart" | "flower" | "bow" | "sparkle";
export type Layer = LayerBase & LayerFlags;
export type LayerBase =
  | { k: "paper"; x: number; y: number; w: number; h: number; rot: number; paper: "grid" | "note" | "ticket" | "kraft"; color: string; torn: boolean; seed: number; asset?: string }
  | { k: "photo"; slot: number; x: number; y: number; w: number; h: number; rot: number; shape: PhotoShape; seed: number; asset?: string; border?: string;
      photo?: string; // id ảnh của khách gán vào ô ("" = ô trống) — không có thì lấy ảnh theo thứ tự slot (mẫu / admin)
      frame?: string; // khung PNG từ thư viện Khung ảnh (ảnh nằm dưới khung)
      frameSets?: string[] } // mẫu admin: "Ngẫu nhiên từ bộ…" — khi khách áp mẫu, lấy 1 khung ngẫu nhiên trong các bộ này (theo seed)
  | { k: "tape"; x: number; y: number; w: number; h: number; rot: number; color: string; pattern: "stripe" | "dots" | "plain"; seed: number; asset?: string }
  | { k: "sticker"; x: number; y: number; s: number; rot: number; shape: StickerShape; color: string; asset?: string }
  | { k: "doodle"; x: number; y: number; s: number; rot: number; shape: "arrow" | "swirl" | "dash"; color: string; asset?: string }
  | { k: "text"; role: "main" | "sub" | "custom"; x: number; y: number; w: number; size: number; rot: number; font: "hand" | "marker" | "label"; color: string; arc?: { r: number; mid: number };
      value?: string; // nội dung riêng (lớp chữ khách thêm); main / sub lấy từ "Chữ trên đĩa"
      family?: string; bold?: boolean; italic?: boolean; stroke?: boolean; // font thường (đè lên font mẫu)
      align?: "left" | "center" | "right"; lh?: number; ls?: number; // căn lề · khoảng cách dòng (× cỡ chữ) · khoảng cách chữ (mm). w = độ rộng khung (mm): chữ tự xuống dòng theo từ
      cutout?: { font: string; curve: number; chaos: number; spacing: number; seed: number } } // chữ cắt dán
  | { k: "wish"; x: number; y: number; w: number; h: number; rot: number; card: WishCard; color: string; ink: string; value: string; seed: number;
      family?: string; cutout?: { font: string; curve: number; chaos: number; spacing: number; seed: number } }; // khung lời chúc: chữ tự xuống dòng + tự co
/** cờ chung của mọi lớp: user = khách tự thêm (giữ lại khi đổi mẫu) · locked = admin khoá (khách không chọn được) */
export type LayerFlags = { user?: boolean; locked?: boolean; auto?: boolean; hidden?: boolean }; // hidden = admin ẩn lớp (không vẽ)
/** nền bề mặt: màu + hoạ tiết + texture giấy (chất liệu) + ảnh nền (phủ kín, có độ mờ) */
export type Bg = { color: string; pattern: "dots" | "grid" | "plain" | "lines"; ink: string; asset?: string; image?: string; imageOpacity?: number }; // auto = sticker / băng dính tự rải (nút "Xáo trộn" rải lại)
export type Template = {
  id: string; n: number; style: Style; seed: number;
  surface?: SurfaceKind; // mặc định "disc"
  gutter?: "left" | "right"; // trang đơn của booklet: gáy bên trái (trang 1) / bên phải (trang cuối)
  kind?: number; // cặp trang booklet: kiểu dàn trang (SPREAD_KINDS)
  accents?: string[]; tone?: string; // bảng màu của mẫu (rải lại sticker)
  fixed?: boolean; // mẫu admin sửa tay: giữ nguyên sticker của mẫu, chỉ bổ sung khi thiếu
  bg: Bg;
  bg2?: Bg; // cặp trang: nền riêng của trang phải (không có = cả cặp dùng chung bg)
  layers: Layer[];
};

// chỉnh ô của khách: dịch (mm) + phóng to (≥ 1), theo ảnh (id ảnh)
export type Adjust = { dx: number; dy: number; zoom: number };
export type DiscText = { main: string; sub: string };
