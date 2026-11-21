import type { HomeVariantProps } from "@/lib/homeData";
import { TileGrid } from "@/components/site/TileGrid";

// Mẫu 1 · Hiện tại — lưới "ảnh + tên" (Admin → Giao diện → Trang chủ → Mẫu 1 → Chỉnh sửa: thêm / ẩn / xoá mục).
export default function HomeV1({ items, settings }: HomeVariantProps) {
  // màu nền trang: chỉ dùng màu admin đã đặt (không có thì giữ nền mặc định của trang)
  const pageBg = typeof settings.page_bg === "string" && settings.page_bg ? settings.page_bg : undefined;
  return (
    <div className="flex w-full flex-1 flex-col" style={pageBg ? { background: pageBg } : undefined}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 md:py-6">
        <section className="flex justify-center pt-2 md:pt-4"><TileGrid items={items} /></section>
      </div>
    </div>
  );
}
