// Thông số khổ in (đơn vị mm). Dùng chung cho Gửi file in, Custom CD, Photostrip.
export type PrintKind = "front" | "back" | "disc" | "booklet" | "photostrip";

export type PrintSpec = {
  kind: PrintKind;
  label: string;
  w: number; // mm
  h: number; // mm
  shape: "rect" | "disc";
  cut: number; // mm — mép có thể bị lệch/cắt khi xén
  safe: number; // mm — nên để chữ & chi tiết quan trọng cách mép bao nhiêu
  spine?: number; // mm — gáy gập 2 bên (bìa sau)
  hole?: number; // mm — đường kính lỗ giữa đĩa
  hub?: number; // mm — đường kính vùng giữa đĩa không in được
};

import { BACK_SPINE_CM } from "./cdSpecs";

// Độ rộng mỗi dải gáy ở 2 mép bìa sau (mm) — đổi trong lib/cdSpecs.ts
export const BACK_SPINE_MM = BACK_SPINE_CM * 10;

export const SPECS: Record<PrintKind, PrintSpec> = {
  front: { kind: "front", label: "Bìa trước", w: 120, h: 120, shape: "rect", cut: 2, safe: 4 },
  back: { kind: "back", label: "Bìa sau", w: 150, h: 117, shape: "rect", cut: 2, safe: 4, spine: BACK_SPINE_MM },
  disc: { kind: "disc", label: "Mặt CD", w: 120, h: 120, shape: "disc", cut: 1.5, safe: 4, hole: 15, hub: 22 },
  booklet: { kind: "booklet", label: "Trang booklet", w: 120, h: 120, shape: "rect", cut: 2, safe: 4 },
  photostrip: { kind: "photostrip", label: "Photostrip 2x6 inch", w: 50.8, h: 152.4, shape: "rect", cut: 1.5, safe: 3 },
};

export const DPI = 300;
export const mmToPx = (mm: number, dpi = DPI) => Math.round((mm / 25.4) * dpi);
export const sizeText = (s: PrintSpec) => `${s.w / 10} x ${s.h / 10} cm`;
