import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { DEFAULT_HOME_VARIANT, getActiveHomeVariant, getHomeData } from "@/lib/homeData";
import { findHomeVariant, homeVariantMeta } from "@/lib/homeVariants";
import { HomeVariantSwitcher } from "@/components/home/HomeVariantSwitcher";

// Trang chủ: hiện mẫu chính thức (Admin → Giao diện trang chủ).
// /?preview=<id> chỉ có tác dụng khi người xem đang đăng nhập admin.
export const dynamic = "force-dynamic";

async function viewerIsAdmin() {
  if (!hasSupabase) return false;
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data } = await sb.rpc("is_admin");
    return !!data;
  } catch { return false; }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const [active, isAdmin] = await Promise.all([getActiveHomeVariant(), viewerIsAdmin()]);
  const official = findHomeVariant(active) ?? findHomeVariant(DEFAULT_HOME_VARIANT)!;
  const wanted = isAdmin && preview ? findHomeVariant(preview) : undefined;
  let variant = wanted ?? official;

  // Mẫu bị lỗi khi dựng → tự dùng "v1-hien-tai"
  let content: React.ReactNode;
  try {
    const props = await getHomeData(variant.id);
    content = variant.component(props);
  } catch {
    variant = findHomeVariant(DEFAULT_HOME_VARIANT)!;
    const props = await getHomeData(variant.id);
    content = variant.component(props);
  }

  return (
    <>
      {isAdmin && <HomeVariantSwitcher variants={homeVariantMeta()} current={variant.id} active={official.id} />}
      {content}
    </>
  );
}
