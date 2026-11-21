import { getStatusPage, isDesignGated } from "@/lib/statusPagesLoad";
import { DesignGate } from "@/components/site/DesignGate";

// Trang Thiết kế + mọi trang con: khi bật "Yêu cầu số điện thoại / mã đơn hàng" (Giao diện → Thiết kế) → cần nhập SĐT / mã đơn Shopee
export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  const [on, page] = await Promise.all([isDesignGated(), getStatusPage("gate")]);
  return <DesignGate enabled={on} page={page}>{children}</DesignGate>;
}
