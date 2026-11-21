/* Danh sách mục dạng "ảnh + tên" (thêm / ẩn / xoá / sắp xếp được) — dùng cho:
   · Trang chủ Mẫu 1 (site_settings.home_items, mặc định lấy từ 6 ô cũ home_options)
   · Trang /thiet-ke (site_settings.design_page = { theme, items }, mặc định từ lib/designTools.ts) */
import { designTools } from "./designTools";
import type { ContactSettings, HomeOption } from "./settings";

export type TileItem = { id: string; title: string; href: string; image_url: string | null; desc?: string; hidden?: boolean };
export type DesignTheme = "1" | "2";
export type DesignPage = { theme: DesignTheme; items: TileItem[] };

export const newTileId = () => Math.random().toString(36).slice(2, 10);

export function normalizeItems(value: unknown, fallback: TileItem[], o: { emptyHref?: boolean } = {}): TileItem[] {
  if (!Array.isArray(value)) return fallback;
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  return (value as Record<string, unknown>[]).filter((v) => v && typeof v === "object").map((v, i) => ({
    id: str(v.id) || `i${i}`,
    title: str(v.title),
    href: str(v.href) || (o.emptyHref ? "" : "/"),
    image_url: str(v.image_url) || null,
    desc: str(v.desc) || undefined,
    hidden: v.hidden === true || undefined,
  }));
}

export const itemsFromOptions = (options: HomeOption[]): TileItem[] =>
  options.map((o, i) => ({ id: `h${i}`, title: o.title.replace(/[[\]]/g, ""), href: o.href, image_url: o.image_url }));

export const defaultDesignItems = (): TileItem[] =>
  designTools.filter((t) => !t.hidden).map((t) => ({ id: t.kind, title: t.title, href: t.href, image_url: t.image ?? null, desc: t.desc }));

export function normalizeDesignPage(value: unknown): DesignPage {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return { theme: v.theme === "1" ? "1" : "2", items: normalizeItems(v.items, defaultDesignItems()) };
}

/* Trang Liên hệ (site_settings.contact_items): ảnh + tên + link (link để trống = chỉ hiện thông tin, vd. Giờ làm việc; desc = dòng thông tin dưới tên) */
export const defaultContactItems = (c: ContactSettings): TileItem[] => [
  { id: "zalo", title: "Liên hệ Zalo", href: c.zalo, image_url: null },
  { id: "shopee", title: "Liên hệ Shopee", href: c.shopee, image_url: null },
  { id: "phone", title: "Số điện thoại", href: c.phone ? `tel:${c.phone.replace(/\s/g, "")}` : "", image_url: null, desc: c.phone || undefined },
  { id: "instagram", title: "Instagram", href: "", image_url: null },
  { id: "threads", title: "Threads", href: "", image_url: null },
  { id: "hours", title: "Giờ làm việc", href: "", image_url: null, desc: c.hours || undefined },
];
