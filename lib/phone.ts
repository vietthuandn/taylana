// Chuẩn hoá số điện thoại Việt Nam — dùng ở MỌI nơi (đăng ký, đăng nhập, đặt hàng, tra cứu đơn, mã giảm giá).
// Giống hệt hàm SQL public.normalize_phone() trong supabase/migration_cart_orders.sql.
//   "+84905546694", "84 905 546 694", "0905.546.694", "905546694" → "0905546694"
export const PHONE_ERROR = "Số điện thoại không hợp lệ";

export function normalizePhone(input: string): string | null {
  let v = (input ?? "").replace(/[\s.\-()]/g, "");
  if (v.startsWith("+84")) v = "0" + v.slice(3);
  else if (/^84\d{9}$/.test(v)) v = "0" + v.slice(2);
  else if (/^[1-9]\d{8}$/.test(v)) v = "0" + v;
  return /^0\d{9}$/.test(v) ? v : null;
}
