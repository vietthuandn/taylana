// Mẫu Custom CD & khung Photostrip. Toạ độ ô (slot) theo tỉ lệ 0–1 của khổ in.
export type Slot = { id: string; shape: "rect" | "circle"; x: number; y: number; w: number; h: number; rotation?: number };

export type DesignTemplate = {
  id: string;
  name: string;
  target: "front" | "back" | "disc";
  overlay_url: string | null;
  background_url: string | null;
  thumbnail_url: string | null;
  slots: Slot[];
  is_active: boolean;
  sort_order: number;
};

export type PhotostripFrame = {
  id: string;
  name: string;
  slot_count: 3 | 4;
  overlay_url: string | null;
  background_url: string | null; // ảnh nền phía sau (tuỳ chọn)
  background_color: string;
  thumbnail_url: string | null;
  slots: Slot[];
  is_active: boolean;
  sort_order: number;
};

// Dữ liệu tối thiểu trình thiết kế cần
export type DesignBase = {
  overlay_url?: string | null;
  background_url?: string | null;
  background_color?: string | null;
  slots: Slot[];
};

export const newSlotId = () => Math.random().toString(36).slice(2, 8);

// Chia đều các ô ảnh theo chiều dọc cho photostrip (khổ 2x6 inch)
export function stripSlots(count: number): Slot[] {
  const mx = 0.07; // lề trái/phải
  const top = 0.035;
  const bottom = 0.14; // chừa chỗ ghi chữ/ngày ở dưới
  const gap = 0.018;
  const h = (1 - top - bottom - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({
    id: newSlotId(), shape: "rect" as const, x: mx, y: top + i * (h + gap), w: 1 - mx * 2, h,
  }));
}

// Khung mặc định khi admin chưa tạo khung nào
export const defaultFrames: PhotostripFrame[] = [3, 4].map((n, i) => ({
  id: `default-${n}`, name: `Khung ${n} ảnh (trắng)`, slot_count: n as 3 | 4, overlay_url: null, background_url: null,
  background_color: i ? "#fff8ec" : "#ffffff", thumbnail_url: null, slots: stripSlots(n), is_active: true, sort_order: 0,
}));

export const targetLabels = { front: "Bìa trước", back: "Bìa sau", disc: "Mặt đĩa" } as const;
