import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { DEFAULT_HOME_VARIANT, getActiveHomeVariant, getHomeData } from "@/lib/homeData";
import { findHomeVariant } from "@/lib/homeVariants";

// Xem trước 1 mẫu trang chủ: /xem-truoc/<id> — chỉ có tác dụng khi người xem đang đăng nhập admin (khách thấy mẫu chính thức).
export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Taylana Printing Service" }, robots: { index: false } };

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

export default async function HomePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const preview = decodeURIComponent((await params).id);
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
      {content}
    </>
  );
}
