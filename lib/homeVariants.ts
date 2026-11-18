// Danh sách các mẫu trang chủ. Thêm mẫu mới: xem docs/HOME_VARIANTS.md
import type { ReactNode } from "react";
import type { HomeVariantProps } from "./homeData";
import HomeV1 from "@/components/home/variants/v1-hien-tai";
import HomeV2 from "@/components/home/variants/v2-co-ban";
import HomeV3 from "@/components/home/variants/v3-ketnoi";

export type HomeVariantMeta = { id: string; name: string; description: string; createdAt: string };
// component: hàm dựng giao diện (server component đồng bộ, không dùng hook)
export type HomeVariant = HomeVariantMeta & { component: (props: HomeVariantProps) => ReactNode };

export const homeVariants: HomeVariant[] = [
  { id: "v1-hien-tai", name: "Mẫu 1 · Hiện tại", description: "Banner + 6 ô vuông màu (trang chủ gốc).", createdAt: "2026-11-01", component: HomeV1 },
  { id: "v2-co-ban", name: "Mẫu 2 · Cơ bản", description: "Dòng chào căn giữa + 6 lựa chọn dạng thẻ ngang.", createdAt: "2026-11-18", component: HomeV2 },
  { id: "v3-ketnoi", name: "Mẫu 3 · Kết Nối", description: "6 mục nối thành 1 hành trình vẽ tay: Hướng dẫn → Thiết kế → Đặt đơn → Gửi file → Đánh giá → Liên hệ.", createdAt: "2026-11-18", component: HomeV3 },
];

export const findHomeVariant = (id?: string | null) => homeVariants.find((v) => v.id === id);
// Chỉ phần thông tin (không có component) — truyền được sang client component
export const homeVariantMeta = (): HomeVariantMeta[] => homeVariants.map(({ id, name, description, createdAt }) => ({ id, name, description, createdAt }));
