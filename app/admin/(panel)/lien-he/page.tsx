import { loadAdminSettings } from "@/lib/adminSettings";
import { ContactForm } from "./ContactForm";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default async function ContactAdminPage() {
  const { contact } = await loadAdminSettings();
  return (
    <AdminPage>
      <PageHeader title="Liên hệ" />
      <ContactForm initial={contact} />
    </AdminPage>
  );
}
