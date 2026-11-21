import { PageHeader } from "@/components/admin/ui";
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { requireStaff } from "@/lib/admin";
import { DESIGNER_TEMPLATE_TABS } from "@/lib/roles";

// Admin → Thiết kế → Quản lý template: các tab (mỗi tab 1 đường dẫn riêng)
export const TEMPLATE_TABS = [
  ["cd-template", "CD Template"], ["booklet-template", "Booklet Template"],
  ["photostrip", "Khung Photostrip"], ["booklet-lyrics", "Booklet Lyrics"], ["canva", "Template Canva"], ["mockup", "Mockup"],
] as const;
export type TemplateTab = (typeof TEMPLATE_TABS)[number][0];

export async function TemplateTabs({ tab, title = true }: { tab: TemplateTab; title?: boolean }) {
  // nhà thiết kế: chỉ thấy CD Template, Booklet Template, Khung Photostrip
  const { role } = await requireStaff();
  const tabs = role === "admin" ? TEMPLATE_TABS : TEMPLATE_TABS.filter(([id]) => DESIGNER_TEMPLATE_TABS.includes(id));
  return (
    <>
      {title && <PageHeader title="Quản lý template" />}
      <ResponsiveTabs className="mb-6" value={tab} tabs={tabs.map(([id, label]) => ({ id, label, href: `/admin/thiet-ke/template/${id}` }))} />
    </>
  );
}
