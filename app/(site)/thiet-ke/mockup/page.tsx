import { getTypePackages } from "@/lib/catalogLoad";
import { getMockupData } from "@/lib/mockup/load";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { MockupLoader } from "./MockupLoader";

export const metadata = { title: "Xem Mockup CD" };

// admin đang đăng nhập? (kiểm tra ở server) → hiện nút "Chia sẻ" (link xem chỉ đọc 24 giờ)
async function isAdmin() {
  if (!hasSupabase) return false;
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data } = await sb.rpc("is_admin");
    return Boolean(data);
  } catch { return false; }
}

// Xem Mockup CD: gói CD lấy từ nhóm "Loại" của sản phẩm kind = 'cd'
export default async function MockupPage() {
  const [packages, data, admin] = await Promise.all([getTypePackages(), getMockupData(), isAdmin()]);
  return <MockupLoader packages={packages} {...data} canShare={admin} />;
}
