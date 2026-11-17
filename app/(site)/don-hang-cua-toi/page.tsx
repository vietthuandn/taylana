import { PageHeader } from "@/components/ui/PageHeader";
import { MyOrders } from "./MyOrders";

export const metadata = { title: "Đơn hàng của tôi", robots: { index: false } };

export default function MyOrdersPage() {
  return (
    <>
      <PageHeader title="Đơn hàng của tôi" subtitle="Theo dõi thanh toán, tình trạng sản xuất và gửi file in cho từng đơn." />
      <MyOrders />
    </>
  );
}
