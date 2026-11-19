import { AdminPage } from "@/components/admin/ui";
import { TemplateTabs } from "../Tabs";
import { BookletTemplates } from "../BookletTemplates";

export default async function Page({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const sub = (await searchParams).sub ?? "single";
  return (
    <AdminPage wide>
      <TemplateTabs tab="booklet-template" />
      <BookletTemplates sub={sub} />
    </AdminPage>
  );
}
