import { requireAdmin } from "@/lib/admin";
import { DEFAULT_HOME_VARIANT } from "@/lib/homeData";
import { findHomeVariant, homeVariantMeta } from "@/lib/homeVariants";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { VariantGrid } from "./VariantGrid";

// Admin → Giao diện: tab "Trang chủ" (các mẫu trang chủ) · tab "Theme" (sắp có)
export default async function HomeVariantsAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "theme" ? "theme" : "trang-chu";
  const { supabase } = await requireAdmin();
  const [a, n, d] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "active_home_variant").maybeSingle(),
    supabase.from("home_variant_notes").select("variant_id, note"),
    supabase.from("site_settings").select("value").eq("key", "deleted_home_variants").maybeSingle(),
  ]);
  const raw = typeof a.data?.value === "string" ? a.data.value : DEFAULT_HOME_VARIANT;
  const active = findHomeVariant(raw) ? raw : DEFAULT_HOME_VARIANT;
  const deleted = Array.isArray(d.data?.value) ? (d.data.value as string[]) : [];
  const notes = Object.fromEntries(((n.data ?? []) as { variant_id: string; note: string }[]).map((x) => [x.variant_id, x.note]));
  return (
    <AdminPage>
      <PageHeader title="Giao diện" />
      <div className="mb-6"><ResponsiveTabs value={tab} tabs={[{ id: "trang-chu", label: "Trang chủ", href: "/admin/giao-dien" }, { id: "theme", label: "Theme", href: "/admin/giao-dien?tab=theme" }]} /></div>
      {tab === "theme"
        ? <div className="rounded-[12px] border border-dashed border-[#d4d4d8] bg-white p-10 text-center text-[14px] text-[#71717a]">Theme — sắp có.</div>
        : <VariantGrid variants={homeVariantMeta().filter((v) => !deleted.includes(v.id))} active={active} notes={notes} notesReady={!n.error} />}
    </AdminPage>
  );
}
