import { TemplateAdmin } from "@/components/admin/TemplateAdmin";
import { TemplateTabs } from "../Tabs";

// Khung Photostrip (photostrip_frames)
export default function Page() {
  return <TemplateAdmin mode="strip" header={<TemplateTabs tab="photostrip" />} />;
}
