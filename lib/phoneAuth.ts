// Đăng nhập khách bằng SỐ ĐIỆN THOẠI + MẬT KHẨU (Supabase Auth với email ảo, không gửi SMS/email)
export const FAKE_DOMAIN = "khach.taylana.vn";

// Chuẩn hoá số Việt Nam: bỏ khoảng trắng/dấu, +84/84 → 0. Trả về null nếu không đúng 10 số.
export function normalizePhone(input: string): string | null {
  let p = input.replace(/[^\d+]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length === 11) p = "0" + p.slice(2);
  return /^0\d{9}$/.test(p) ? p : null;
}
export const phoneToEmail = (phone: string) => `${phone}@${FAKE_DOMAIN}`;
export const isCustomerEmail = (email?: string | null) => !!email && email.endsWith(`@${FAKE_DOMAIN}`);
