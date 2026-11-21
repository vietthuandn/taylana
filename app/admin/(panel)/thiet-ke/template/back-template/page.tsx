import { AdminPage } from "@/components/admin/ui";
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { TemplateTabs } from "../Tabs";
import { LibraryAdmin } from "../LibraryAdmin";
import { BundleAdmin } from "../BundleAdmin";

// Quản lý template → Back cover Template (bìa sau 15 × 11,7 cm): Mẫu bìa · Bộ mẫu 2 mặt (Mặt ngoài + Mặt trong, thiết kế đồng bộ)
export default async function Page({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const sub = (await searchParams).sub === "bundle" ? "bundle" : "single";
  return (
    <AdminPage wide>
      <TemplateTabs tab="back-template" />
      <div className="space-y-4">
        <ResponsiveTabs size="sm" value={sub} tabs={[{ id: "single", label: "Mẫu bìa", href: "/admin/thiet-ke/template/back-template" }, { id: "bundle", label: "Bộ mẫu 2 mặt", href: "/admin/thiet-ke/template/back-template?sub=bundle" }]} />
        {sub === "bundle" ? <BundleAdmin kind="back" /> : <LibraryAdmin kind="back" />}
      </div>
    </AdminPage>
  );
}
