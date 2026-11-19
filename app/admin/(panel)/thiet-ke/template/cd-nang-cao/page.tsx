import { TemplateAdmin } from "@/components/admin/TemplateAdmin";
import { TemplateTabs } from "../Tabs";

// Mẫu Custom CD (design_templates)
export default function Page() {
  return <TemplateAdmin mode="cd" header={<TemplateTabs tab="cd-nang-cao" />} />;
}
