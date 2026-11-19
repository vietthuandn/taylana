import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToolGrid } from "@/components/site/ToolGrid";
import { designTools } from "@/lib/designTools";
import { getCanvaData } from "@/lib/canvaLoad";
import { CanvaModal } from "./CanvaModal";

export const metadata = { title: "Thiết Kế" };
export const revalidate = 60;

// Trang chọn công cụ thiết kế (danh sách trong lib/designTools.ts). Thẻ "Thiết kế từ Canva Template" mở modal ngay trên trang (?canva=1).
export default async function DesignToolsPage() {
  const canva = await getCanvaData();
  return (
    <>
      <PageHeader title="Thiết Kế" />
      <div className="mx-auto w-full max-w-[1200px] px-4 lg:px-6"><ToolGrid tools={designTools.filter((t) => !t.hidden)} /></div>
      <Suspense><CanvaModal templates={canva.templates} button={canva.button} /></Suspense>
    </>
  );
}
