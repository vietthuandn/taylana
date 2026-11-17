// Sản phẩm → nhóm tuỳ chọn → lựa chọn (bảng products / option_groups / options)
import type { Addon, Package } from "./types";

export type Option = {
  id: string; group_id: string; name: string; price: number; description: string; image_url: string | null;
  front_pages: number | null; back_pages: number | null; has_disc: boolean | null; is_active: boolean; sort_order: number;
};
export type OptionGroup = {
  id: string; product_id: string; name: string; select_type: "single" | "multi"; required: boolean; sort_order: number; options: Option[];
};
export type Product = {
  id: string; slug: string; name: string; description: string; images: string[]; is_active: boolean; sort_order: number; groups: OptionGroup[];
};

// Nhóm "Loại": nhóm Chọn 1 (ưu tiên bắt buộc, thứ tự nhỏ nhất) — dùng cho preset thiết kế
export const typeGroup = (p?: Product | null) =>
  p?.groups.filter((g) => g.select_type === "single").sort((a, b) => Number(b.required) - Number(a.required) || a.sort_order - b.sort_order)[0] ?? null;

// Giá "Từ ...": giá thấp nhất trong các nhóm Chọn 1 bắt buộc
export function fromPrice(p: Product) {
  return p.groups.filter((g) => g.select_type === "single" && g.required).reduce((t, g) => {
    const prices = g.options.filter((o) => o.is_active).map((o) => o.price);
    return t + (prices.length ? Math.min(...prices) : 0);
  }, 0);
}

export const optionById = (p: Product | undefined | null, id: string) => {
  for (const g of p?.groups ?? []) { const o = g.options.find((x) => x.id === id); if (o) return { opt: o, group: g }; }
  return null;
};
export const productOfOption = (list: Product[], id: string) => list.find((p) => !!optionById(p, id));

// Ánh xạ sang kiểu cũ (Package / Addon) cho các trang dùng preset: Custom CD, Gửi file
export const optionToPackage = (o: Option, p?: Product): Package => ({
  id: o.id, name: o.name, price: o.price, description: o.description, features: [],
  image_url: o.image_url ?? p?.images[0] ?? null, images: o.image_url ? [o.image_url] : p?.images ?? [],
  is_active: o.is_active, sort_order: o.sort_order,
  has_disc: o.has_disc ?? undefined, front_pages: o.front_pages ?? undefined, back_pages: o.back_pages ?? undefined,
});
export const optionToAddon = (o: Option): Addon => ({
  id: o.id, name: o.name, price: o.price, description: o.description, image_url: o.image_url, is_active: o.is_active, sort_order: o.sort_order,
});

// Mô tả phân loại: "Loại: Combo + Booklet 8 trang · Mua kèm: Gói quà, Thiệp"
export function variationText(p: Product | undefined | null, ids: string[]) {
  if (!p) return "";
  return p.groups.map((g) => {
    const names = g.options.filter((o) => ids.includes(o.id)).map((o) => o.name);
    return names.length ? `${g.name}: ${names.join(", ")}` : "";
  }).filter(Boolean).join(" · ");
}
