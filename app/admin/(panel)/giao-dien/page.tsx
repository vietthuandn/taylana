import { requireAdmin } from "@/lib/admin";
import { DEFAULT_HOME_VARIANT } from "@/lib/homeData";
import { findHomeVariant, homeVariantMeta } from "@/lib/homeVariants";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { VariantGrid } from "./VariantGrid";

export default async function HomeVariantsAdmin() {
  const { supabase } = await requireAdmin();
  const [a, n] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "active_home_variant").maybeSingle(),
    supabase.from("home_variant_notes").select("variant_id, note"),
  ]);
  const raw = typeof a.data?.value === "string" ? a.data.value : DEFAULT_HOME_VARIANT;
  const active = findHomeVariant(raw) ? raw : DEFAULT_HOME_VARIANT;
  const notes = Object.fromEntries(((n.data ?? []) as { variant_id: string; note: string }[]).map((x) => [x.variant_id, x.note]));
  return (
    <AdminPage>
      <PageHeader title="Giao diện trang chủ" description="Chọn mẫu trang chủ cho khách. Mọi mẫu dùng chung nội dung ở Admin → Trang chủ." />
      <VariantGrid variants={homeVariantMeta()} active={active} notes={notes} notesReady={!n.error} />
    </AdminPage>
  );
}
