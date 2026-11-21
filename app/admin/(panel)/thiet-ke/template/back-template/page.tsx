import { AdminPage } from "@/components/admin/ui";
import { TemplateTabs } from "../Tabs";
import { LibraryAdmin } from "../LibraryAdmin";

// Quản lý template → Back cover Template: mẫu bìa sau 15 × 11,7 cm (giống CD Template)
export default function Page() {
  return (
    <AdminPage wide>
      <TemplateTabs tab="back-template" />
      <LibraryAdmin kind="back" />
    </AdminPage>
  );
}
