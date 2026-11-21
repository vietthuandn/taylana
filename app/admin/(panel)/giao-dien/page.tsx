import { requireAdmin } from "@/lib/admin";
import { DEFAULT_HOME_VARIANT } from "@/lib/homeData";
import { findHomeVariant, homeVariantMeta } from "@/lib/homeVariants";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { VariantGrid } from "./VariantGrid";
import { DesignPageForm } from "./DesignPageForm";
import { ThemeForm } from "./ThemeForm";
import { DEFAULT_THEME, MAX_THEMES, type SavedTheme, type Theme } from "@/lib/theme";

/** danh sách theme đã lưu; chưa có mà theme đang dùng khác mặc định → tự tạo "Theme 1" từ theme đó (đang dùng) */
function themesOf(v: unknown, applied: Theme): { initialList: SavedTheme[]; initialActive: string | null } {
  const o = (v && typeof v === "object" ? v : null) as { list?: unknown; active?: unknown } | null;
  if (!o) return JSON.stringify(applied) === JSON.stringify(DEFAULT_THEME) ? { initialList: [], initialActive: null } : { initialList: [{ id: "t1", name: "Theme 1", theme: applied }], initialActive: "t1" };
  const list = (Array.isArray(o.list) ? o.list : []).slice(0, MAX_THEMES).map((x, i) => {
    const r = (x ?? {}) as Record<string, unknown>;
    return { id: typeof r.id === "string" ? r.id : `t${i + 1}`, name: typeof r.name === "string" && r.name ? r.name : `Theme ${i + 1}`, theme: normalizeTheme(r.theme) };
  });
  const active = typeof o.active === "string" && list.some((x) => x.id === o.active) ? o.active : null;
  return { initialList: list, initialActive: active };
}
import { normalizeTheme } from "@/lib/theme";
import { defaultContactItems, normalizeDesignPage, normalizeItems } from "@/lib/tileItems";
import { defaultContact, type ContactSettings } from "@/lib/settings";
import { ContactItemsForm } from "./ContactItemsForm";

const mergeContact = (v: unknown): ContactSettings => ({ ...defaultContact, ...((v && typeof v === "object" ? v : {}) as Partial<ContactSettings>) });

// Admin → Giao diện: tab "Trang chủ" (các mẫu trang chủ) · tab "Theme" (sắp có)
export default async function HomeVariantsAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const q = (await searchParams).tab;
  const tab = q === "theme" || q === "thiet-ke" || q === "lien-he" ? q : "trang-chu";
  const { supabase } = await requireAdmin();
  const [a, n, d, dp, th, tl, ci, ct] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "active_home_variant").maybeSingle(),
    supabase.from("home_variant_notes").select("variant_id, note"),
    supabase.from("site_settings").select("value").eq("key", "deleted_home_variants").maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "design_page").maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "theme").maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "themes").maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "contact_items").maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "contact").maybeSingle(),
  ]);
  const raw = typeof a.data?.value === "string" ? a.data.value : DEFAULT_HOME_VARIANT;
  const active = findHomeVariant(raw) ? raw : DEFAULT_HOME_VARIANT;
  const deleted = Array.isArray(d.data?.value) ? (d.data.value as string[]) : [];
  const notes = Object.fromEntries(((n.data ?? []) as { variant_id: string; note: string }[]).map((x) => [x.variant_id, x.note]));
  return (
    <AdminPage>
      <PageHeader title="Giao diện" />
      <div className="mb-6"><ResponsiveTabs value={tab} tabs={[{ id: "trang-chu", label: "Trang chủ", href: "/admin/giao-dien" }, { id: "thiet-ke", label: "Thiết kế", href: "/admin/giao-dien?tab=thiet-ke" }, { id: "lien-he", label: "Liên hệ", href: "/admin/giao-dien?tab=lien-he" }, { id: "theme", label: "Theme", href: "/admin/giao-dien?tab=theme" }]} /></div>
      {tab === "lien-he" ? <ContactItemsForm initial={normalizeItems(ci.data?.value, defaultContactItems(mergeContact(ct.data?.value)), { emptyHref: true })} /> : tab === "thiet-ke" ? <DesignPageForm initial={normalizeDesignPage(dp.data?.value)} /> : tab === "theme"
        ? <ThemeForm {...themesOf(tl.data?.value, normalizeTheme(th.data?.value))} />
        : <VariantGrid variants={homeVariantMeta().filter((v) => !deleted.includes(v.id))} active={active} notes={notes} notesReady={!n.error} />}
    </AdminPage>
  );
}
