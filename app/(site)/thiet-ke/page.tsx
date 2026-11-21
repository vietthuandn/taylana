import { Suspense } from "react";
import { ToolGrid } from "@/components/site/ToolGrid";
import { TileGrid } from "@/components/site/TileGrid";
import { getDesignPage } from "@/lib/homeData";
import { getCanvaData } from "@/lib/canvaLoad";
import { CanvaModal } from "./CanvaModal";

export const metadata = { title: "Thiết Kế" };
export const revalidate = 60;

// Trang chọn công cụ thiết kế — mục & mẫu giao diện chỉnh ở Admin → Giao diện → Thiết kế
// (Mẫu 1: lưới "ảnh + tên" giống trang chủ Mẫu 1 · Mẫu 2: thẻ có mô tả). Thẻ Canva mở modal ngay trên trang (?canva=1).
export default async function DesignToolsPage() {
  const [canva, page] = await Promise.all([getCanvaData(), getDesignPage()]);
  return (
    <>
      {page.theme === "1"
        ? <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-4 md:py-6"><section className="flex justify-center pt-2 md:pt-4"><TileGrid items={page.items} /></section></div>
        : <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-6"><ToolGrid tools={page.items.filter((t) => !t.hidden).map((t) => ({ href: t.href, title: t.title, label: "", desc: t.desc ?? "", kind: t.id, image: t.image_url ?? undefined }))} /></div>}
      <Suspense><CanvaModal templates={canva.templates} button={canva.button} /></Suspense>
    </>
  );
}
