import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { DesignTemplate } from "@/lib/templates";
import type { Package } from "@/lib/types";
import { CustomCdLoader } from "./CustomCdLoader";

export const metadata = { title: "Custom CD" };
export const revalidate = 60;

export default async function CustomCdPage() {
  const sb = publicClient();
  let templates: DesignTemplate[] = [];
  let packages: Package[] = [];
  if (sb) {
    const [t, p] = await Promise.all([
      sb.from("design_templates").select("*").eq("is_active", true).order("sort_order").order("created_at"),
      sb.from("packages").select("*").eq("is_active", true).order("sort_order"),
    ]);
    templates = t.data ?? [];
    packages = p.data ?? [];
  }
  return (
    <div data-fit-screen className="flex flex-1 flex-col md:min-h-0">
      <Suspense>
        <CustomCdLoader templates={templates} packages={packages} />
      </Suspense>
    </div>
  );
}
