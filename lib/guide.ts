import "server-only";
/* Trang Hướng dẫn làm file (/huong-dan + bản chia sẻ không có thanh điều hướng /xem/huong-dan): các mục (guide_sections),
   cài đặt trang (site_settings "guide": khối tiện ích thiết kế, nút Đặt đơn), link Zalo (site_settings "contact"),
   gói CD (để chọn gói → danh sách file cần chuẩn bị), icon nút Canva. */
import { isShopPaused } from "./statusPagesLoad";
import { publicClient } from "./supabase/public";
import { getSettings } from "./settings";
import { getTypePackages } from "./catalogLoad";
import { getCanvaData } from "./canvaLoad";
import type { GuideSection } from "./types";

export type GuideTool = { label: string; href: string };
export type GuideSettings = { show_tools: boolean; tools_title: string; tools: GuideTool[]; order_enabled: boolean; order_href: string };
export const defaultGuide: GuideSettings = {
  show_tools: false, // chưa sẵn sàng → admin tắt trước
  tools_title: "App cũng có xây dựng nhiều tiện ích thiết kế cho CD, khám phá ngay nhé:",
  tools: [{ label: "Thiết kế CD và Booklet", href: "/thiet-ke" }, { label: "Booklet Lyrics", href: "/thiet-ke/booklet-lyrics" }, { label: "Xem Mockup", href: "/thiet-ke/mockup" }],
  order_enabled: false, // nút "Đặt đơn" tạm khoá
  order_href: "/dat-don",
};
export const mergeGuide = (v: Partial<GuideSettings> | null | undefined): GuideSettings => ({ ...defaultGuide, ...(v ?? {}), tools: v?.tools?.length ? v.tools : defaultGuide.tools });

export async function getGuidePage() {
  const sb = publicClient();
  const [sec, st, set, packs, canva] = await Promise.all([
    sb ? sb.from("guide_sections").select("*").eq("is_active", true).order("sort_order").order("created_at") : Promise.resolve({ data: [] }),
    sb ? sb.from("site_settings").select("value").eq("key", "guide").maybeSingle() : Promise.resolve({ data: null }),
    getSettings(), getTypePackages(), getCanvaData().catch(() => null),
  ]);
  // nút "Đặt đơn" cuối trang: mở khi KHÔNG "Tạm nghỉ bán" (Sản phẩm của tôi) — cùng 1 công tắc với trang Đặt đơn
  const paused = await isShopPaused();
  return {
    sections: (sec.data ?? []) as GuideSection[], guide: { ...mergeGuide((st.data?.value as Partial<GuideSettings>) ?? null), order_enabled: !paused }, zalo: set.contact.zalo,
    packs: packs.map((p) => ({ id: p.id, name: p.name, front: p.front_pages ?? 0, back: p.back_pages ?? 0, disc: !!p.has_disc })),
    canvaIcon: canva?.button.icon_url ?? null,
  };
}
