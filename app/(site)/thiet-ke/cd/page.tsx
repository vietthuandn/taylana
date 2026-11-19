import { Suspense } from "react";
import type { DesignTemplate } from "@/lib/templates";
import type { TemplateDoc } from "@/lib/cdDoc";
import { getTypePackages } from "@/lib/catalogLoad";
import { getLibrary } from "@/lib/scrapbook/load";
import { CustomCdLoader } from "../../custom-cd/CustomCdLoader";

export const metadata = { title: "Thiết kế CD" };
export const revalidate = 60;

// Trang Thiết Kế (Custom CD). "Loại" (số trang, có mặt đĩa) đọc từ nhóm Loại của sản phẩm "In CD theo yêu cầu".
// Mẫu lấy từ thư viện mẫu cố định: mặt đĩa = CD Template · bìa trước + trang booklet = Trang đơn · bìa sau = Tự do.
export default async function CustomCdPage() {
  const [lib, packages] = await Promise.all([getLibrary(["cd", "booklet_single"]), getTypePackages()]);
  const catOrder = new Map(lib.categories.map((c) => [c.id, c]));
  const templates: (DesignTemplate & { doc: TemplateDoc; category?: string })[] = lib.templates
    .filter((t) => t.config?.cdDoc)
    .sort((a, b) => (catOrder.get(a.category_id ?? "")?.sort_order ?? 1e6) - (catOrder.get(b.category_id ?? "")?.sort_order ?? 1e6) || a.sort_order - b.sort_order)
    .map((t) => ({
      id: t.id, name: t.name, target: t.kind === "cd" ? "disc" : "front", overlay_url: null, background_url: null, thumbnail_url: t.thumbnail_url,
      slots: [], is_active: true, sort_order: t.sort_order, doc: t.config.cdDoc!, category: catOrder.get(t.category_id ?? "")?.name ?? "Khác",
    }));
  return (
    <div data-fit-screen className="flex flex-1 flex-col md:min-h-0">
      <Suspense>
        <CustomCdLoader templates={templates} packages={packages} />
      </Suspense>
    </div>
  );
}
