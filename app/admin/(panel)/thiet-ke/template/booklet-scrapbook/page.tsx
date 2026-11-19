import { AdminPage } from "@/components/admin/ui";
import { TemplateTabs } from "../Tabs";
import { ScrapTemplates } from "../ScrapTemplates";

export default function Page() {
  return (
    <AdminPage wide>
      <TemplateTabs tab="booklet-scrapbook" />
      <ScrapTemplates surface="booklet" />
    </AdminPage>
  );
}
