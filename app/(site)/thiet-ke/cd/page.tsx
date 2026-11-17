import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { DesignTemplate } from "@/lib/templates";
import { getTypePackages } from "@/lib/catalogLoad";
import { CustomCdLoader } from "../../custom-cd/CustomCdLoader";

export const metadata = { title: "Thiết kế CD" };
export const revalidate = 60;

// Trang Thiết Kế (Custom CD). "Loại" (số trang, có mặt đĩa) đọc từ nhóm Loại của sản phẩm "In CD theo yêu cầu".
export default async function CustomCdPage() {
  const sb = publicClient();
  const [t, packages] = await Promise.all([
    sb ? sb.from("design_templates").select("*").eq("is_active", true).order("sort_order").order("created_at") : Promise.resolve({ data: [] }),
    getTypePackages(),
  ]);
  const templates = (t.data ?? []) as DesignTemplate[];
  return (
    <div data-fit-screen className="flex flex-1 flex-col md:min-h-0">
      <Suspense>
        <CustomCdLoader templates={templates} packages={packages} />
      </Suspense>
    </div>
  );
}
