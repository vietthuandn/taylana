// Đăng nhập khách bằng SỐ ĐIỆN THOẠI + MẬT KHẨU (Supabase Auth với email ảo, không gửi SMS/email)
// Email ảo luôn tạo từ SĐT ĐÃ CHUẨN HOÁ → nhập SĐT dạng nào cũng vào đúng 1 tài khoản.
import { normalizePhone } from "./phone";

export { normalizePhone, PHONE_ERROR } from "./phone";
export const FAKE_DOMAIN = "khach.taylana.vn";
export const phoneToEmail = (phone: string) => `${normalizePhone(phone) ?? phone}@${FAKE_DOMAIN}`;
export const isCustomerEmail = (email?: string | null) => !!email && email.endsWith(`@${FAKE_DOMAIN}`);
