import { loadAdminSettings } from "@/lib/adminSettings";
import { ContactForm } from "./ContactForm";

export default async function ContactAdminPage() {
  const { contact } = await loadAdminSettings();
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1">Liên hệ</h1>
      <p className="mb-6 text-sm text-ink-500">Hiện ở trang /lien-he và cuối các trang. Để trống ô nào thì ẩn ô đó.</p>
      <ContactForm initial={contact} />
    </div>
  );
}
