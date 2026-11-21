import { ArrowLeft } from "lucide-react";
import { loadAdminSettings } from "@/lib/adminSettings";
import { requireAdmin } from "@/lib/admin";
import { itemsFromOptions, normalizeItems } from "@/lib/tileItems";
import { HomeForm } from "./HomeForm";
import { AdminPage, Button, PageHeader } from "@/components/admin/ui";

// Giao diện → Trang chủ → Mẫu 1 → Chỉnh sửa (mục trang chủ: thêm / ẩn / xoá)
export default async function HomeAdminPage() {
  const [{ options }, { supabase }] = await Promise.all([loadAdminSettings(), requireAdmin()]);
  const { data } = await supabase.from("site_settings").select("value").eq("key", "home_items").maybeSingle();
  return (
    <AdminPage wide>
      <PageHeader title="Chỉnh sửa Mẫu 1" actions={<Button variant="secondary" size="sm" href="/admin/giao-dien" icon={<ArrowLeft size={16} />}>Giao diện</Button>} />
      <HomeForm initialItems={normalizeItems(data?.value, itemsFromOptions(options))} keepImages={options.map((o) => o.image_url).filter((u): u is string => !!u)} />
    </AdminPage>
  );
}
