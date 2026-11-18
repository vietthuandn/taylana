import { PageHeader } from "@/components/ui/PageHeader";
import { ToolGrid } from "@/components/site/ToolGrid";
import { designTools } from "@/lib/designTools";

export const metadata = { title: "Thiết Kế" };

// Trang chọn công cụ thiết kế (danh sách trong lib/designTools.ts)
export default function DesignToolsPage() {
  return (
    <>
      <PageHeader title="Thiết Kế" />
      <div className="mx-auto w-full max-w-[1200px] px-4 lg:px-6"><ToolGrid tools={designTools} /></div>
    </>
  );
}
