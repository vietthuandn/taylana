/* Từ gói (số bìa trước / sau, có đĩa) + ảnh theo ô → dữ liệu cho các bộ dựng mockup (khung 2D, 3D, Mẫu hệ thống, Booklet).
   Dùng chung: trang Xem Mockup và trang xem link chia sẻ /m/[token]. */
import type { RegionType } from "@/lib/mockup/types";
import type { SystemInput } from "@/lib/mockup/system/compose";
import type { Cd3DImages } from "./Cd3D";

export type MockLayout = { front: number; back: number; disc: boolean };
type Imgs = Record<string, HTMLImageElement | undefined>;

export function deriveMockup(layout: MockLayout | null, imgs: Imgs, box: boolean) {
  // chỉ vùng thuộc gói mới có khoá (null = chưa có ảnh); vùng ngoài gói bỏ trống → vẽ trắng trơn
  const regionImages: Partial<Record<RegionType, HTMLImageElement | null>> = {};
  if (layout) {
    if (layout.front >= 1) regionImages.front_out = imgs.f1 ?? null;
    if (layout.front >= 2) regionImages.front_in = imgs.f2 ?? null;
    if (layout.back >= 1) regionImages.back_out = imgs.b1 ?? null;
    if (layout.back >= 2) regionImages.back_in = imgs.b2 ?? null;
    if (layout.disc) regionImages.disc = imgs.d ?? null;
  }
  const bookletPages = layout && layout.front >= 4 ? Array.from({ length: layout.front }, (_, i) => imgs[`f${i + 1}`] ?? null) : null;
  // ảnh cho hộp 3D: undefined = không có giấy · null = giấy trắng (thuộc gói nhưng chưa có ảnh / mặt trong của gói 1 mặt)
  let images3d: Cd3DImages;
  if (!layout || box) images3d = { disc: imgs.d ?? null };
  else {
    const booklet = layout.front >= 4;
    images3d = {
      frontOut: layout.front ? imgs.f1 ?? null : undefined,
      frontIn: layout.front ? (booklet ? imgs[`f${layout.front}`] : imgs.f2) ?? null : undefined,
      backOut: layout.back ? imgs.b1 ?? null : undefined,
      backIn: layout.back ? imgs.b2 ?? null : undefined,
      disc: imgs.d ?? null,
    };
  }
  // Mẫu hệ thống: ảnh theo gói (undefined = không có giấy · null = giấy trắng)
  const l = layout ?? { front: 0, back: 0, disc: true };
  const booklet = l.front >= 4;
  const pack: SystemInput["pack"] = box || (!l.front && !l.back) ? "box" : booklet ? "booklet" : l.front >= 2 || l.back >= 2 ? "combo2" : "combo1";
  const system: SystemInput = pack === "box" ? { pack, disc: imgs.d ?? null, pages: [] } : {
    pack,
    frontOut: l.front ? imgs.f1 ?? null : undefined,
    frontIn: booklet ? imgs[`f${l.front}`] ?? null : l.front >= 2 ? imgs.f2 ?? null : l.front ? null : undefined,
    backOut: l.back ? imgs.b1 ?? null : undefined,
    backIn: l.back >= 2 ? imgs.b2 ?? null : l.back ? null : undefined,
    disc: imgs.d ?? null,
    pages: booklet ? Array.from({ length: l.front }, (_, i) => imgs[`f${i + 1}`] ?? null) : [],
  };
  return { regionImages, bookletPages, images3d, system, back: layout && layout.back >= 1 ? imgs.b1 ?? null : null };
}
