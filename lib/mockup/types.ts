// Kiểu dữ liệu mẫu mockup (bảng mockup_frames / mockup_backgrounds). Toạ độ vùng theo tỉ lệ 0..1 so với ảnh khung.
export type RegionType = "front_out" | "front_in" | "back_out" | "back_in" | "disc";
export const REGION_LABELS: Record<RegionType, string> = {
  front_out: "Bìa Trước - Mặt Ngoài", front_in: "Bìa Trước - Mặt Trong",
  back_out: "Bìa Sau - Mặt Ngoài", back_in: "Bìa Sau - Mặt Trong", disc: "Mặt Đĩa",
};
export type Pt = [number, number];
export type Region = {
  id: string;
  type: RegionType;
  pts: [Pt, Pt, Pt, Pt]; // 4 góc: trên-trái, trên-phải, dưới-phải, dưới-trái (0..1)
  order: number; // thứ tự lớp (nhỏ vẽ trước)
  glass: boolean; // có lớp kính phản chiếu
  blend: "normal" | "multiply";
  mask_url?: string | null; // mặt nạ PNG (không bắt buộc)
  spine?: "show" | "trim"; // bìa sau: hiện cả gáy / bỏ 2 dải gáy
  hole?: number; // mặt đĩa: tỉ lệ đường kính lỗ / đường kính đĩa
};
export type GlassSettings = { strength: number; angle: number }; // strength 0..100, angle độ
export type MockupFrame = {
  id: string; name: string; image_url: string; source: "url" | "storage";
  regions: Region[]; glass: GlassSettings; is_active: boolean; sort_order: number;
};
export type MockupBackground = { id: string; name: string; url: string; is_active: boolean; sort_order: number };
export type MockupSettings = { watermark: boolean };

// Lỗ giữa đĩa mặc định: đường kính 2,3 cm trên đĩa 12 cm
export const DISC_HOLE_CM = 2.3;
export const DISC_CM = 12;
export const DEFAULT_DISC_HOLE = DISC_HOLE_CM / DISC_CM;

export const defaultGlass: GlassSettings = { strength: 50, angle: -35 };
export const newRegion = (type: RegionType = "front_out", order = 1): Region => ({
  id: Math.random().toString(36).slice(2, 9), type, order,
  pts: [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]],
  glass: type !== "disc", blend: "normal", spine: "show", hole: DEFAULT_DISC_HOLE,
});
