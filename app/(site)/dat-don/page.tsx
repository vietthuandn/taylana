import { publicClient } from "@/lib/supabase/public";
import type { Addon, Package } from "@/lib/types";
import { PageTitle } from "@/components/site/PageTitle";
import { OrderForm } from "./OrderForm";

export const metadata = { title: "Đặt đơn" };
export const revalidate = 60;

export default async function OrderPage() {
  const sb = publicClient();
  let packages: Package[] = [];
  let addons: Addon[] = [];
  if (sb) {
    const [p, a] = await Promise.all([
      sb.from("packages").select("*").eq("is_active", true).order("sort_order").order("created_at"),
      sb.from("addons").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    ]);
    packages = p.data ?? [];
    addons = a.data ?? [];
  }

  return (
    <>
      <PageTitle title="Đặt đơn" subtitle="Chọn gói CD bạn thích, thêm phụ kiện xinh xắn rồi gửi đơn cho tiệm nhé ♡" />
      <OrderForm packages={packages} addons={addons} />
    </>
  );
}
