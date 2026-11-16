import { requireAdmin } from "@/lib/admin";
import { defaultContact, defaultHome } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("key, value").in("key", ["home", "contact"]);
  const home = { ...defaultHome, ...(data?.find((r) => r.key === "home")?.value ?? {}) };
  const contact = { ...defaultContact, ...(data?.find((r) => r.key === "contact")?.value ?? {}) };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl">Trang chủ & liên hệ</h1>
      <p className="mb-6 mt-1 text-sm text-ink-600">Sửa nội dung banner và các nút liên hệ ở cuối trang chủ.</p>
      <SettingsForm initialHome={home} initialContact={contact} />
    </div>
  );
}
