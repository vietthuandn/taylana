import { AdminPage } from "@/components/admin/ui";
import { TemplateTabs } from "../Tabs";
import { CdTemplates } from "../CdTemplates";

export default function Page() {
  return (
    <AdminPage wide>
      <TemplateTabs tab="cd-template" />
      <CdTemplates />
    </AdminPage>
  );
}
