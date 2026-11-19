import { AdminPage } from "@/components/admin/ui";
import { TemplateTabs } from "../Tabs";
import { LyricsAdmin } from "../../../booklet-lyrics/LyricsAdmin";

export default function Page() {
  return (
    <AdminPage wide>
      <TemplateTabs tab="booklet-lyrics" />
      <LyricsAdmin />
    </AdminPage>
  );
}
