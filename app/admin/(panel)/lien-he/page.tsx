import { loadAdminSettings } from "@/lib/adminSettings";
import { ContactForm } from "./ContactForm";
import { AdminPage, PageHeader } from "@/components/admin/ui";

export default async function ContactAdminPage() {
  const { contact } = await loadAdminSettings();
  return (
    <AdminPage>
      <PageHeader title="Liên hệ" description="Hiện ở trang Liên hệ và cuối các trang. Để trống ô nào thì ẩn ô đó." />
      <ContactForm initial={contact} />
    </AdminPage>
  );
}
