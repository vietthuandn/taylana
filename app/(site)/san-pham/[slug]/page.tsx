import { Suspense } from "react";
import { notFound } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import type { PublicDiscount } from "@/lib/discount";
import { getCatalog } from "@/lib/catalogLoad";
import { getPaymentSettings } from "@/lib/payment/load";
import { paymentReady } from "@/lib/payment/settings";
import { getShippingSettings } from "@/lib/shippingLoad";
import { OrderForm } from "../../dat-don/OrderForm";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = (await getCatalog()).find((x) => x.slug === slug);
  return { title: p?.name ?? "Sản phẩm" };
}

// Trang chi tiết sản phẩm: chọn Loại, Mua kèm, Số lượng → Thêm vào giỏ / Đặt đơn
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = publicClient();
  const [products, d, settings, shipping] = await Promise.all([
    getCatalog(sb),
    sb ? sb.rpc("get_public_discounts") : Promise.resolve({ data: [], error: null }),
    getPaymentSettings(),
    getShippingSettings(),
  ]);
  const product = products.find((p) => p.slug === slug && p.is_active);
  if (!product) notFound();
  const discounts = (d.error ? [] : d.data ?? []) as PublicDiscount[];
  return (
    <Suspense>
      <OrderForm products={[product]} discounts={discounts} shipping={shipping} payment={paymentReady(settings) ? settings : null} />
    </Suspense>
  );
}
