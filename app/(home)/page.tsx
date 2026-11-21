import { DEFAULT_HOME_VARIANT, getActiveHomeVariant, getHomeData } from "@/lib/homeData";
import { findHomeVariant } from "@/lib/homeVariants";

// Trang chủ: mẫu chính thức (Admin → Giao diện). Trang tĩnh, làm mới tối đa mỗi 60 giây (admin lưu thì cập nhật ngay)
// — không kiểm tra đăng nhập, không đọc tham số → mở rất nhanh. Xem trước mẫu khác: /xem-truoc/<id> (chỉ admin).
export const revalidate = 60;
export const metadata = { title: { absolute: "Taylana Printing Service" } };

export default async function HomePage() {
  let variant = findHomeVariant(await getActiveHomeVariant()) ?? findHomeVariant(DEFAULT_HOME_VARIANT)!;
  // Mẫu bị lỗi khi dựng → tự dùng "v1-hien-tai"
  try {
    return variant.component(await getHomeData(variant.id));
  } catch {
    variant = findHomeVariant(DEFAULT_HOME_VARIANT)!;
    return variant.component(await getHomeData(variant.id));
  }
}
