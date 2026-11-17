// Kiểu dữ liệu + nhãn cho chương trình giảm giá (admin)
import { formatVND } from "./format";

export type Discount = {
  id?: string;
  name: string;
  label: string;
  kind: "private" | "public";
  target: "goods" | "shipping"; // Giảm tiền hàng / Giảm phí vận chuyển
  code: string | null;
  value_type: "amount" | "percent";
  value: number;
  max_discount: number | null;
  scope: "order" | "items";
  package_ids: string[];
  addon_ids: string[];
  option_ids: string[]; // "chỉ áp dụng cho" — id lựa chọn (Loại, Mua kèm...)
  min_order: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_phone_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at?: string;
};

export const blankDiscount: Discount = {
  name: "", label: "", kind: "private", target: "goods", option_ids: [], code: "", value_type: "amount", value: 20000, max_discount: null,
  scope: "order", package_ids: [], addon_ids: [], min_order: null, starts_at: null, ends_at: null,
  usage_limit: null, per_phone_limit: null, used_count: 0, is_active: true,
};

export const valueText = (d: Pick<Discount, "value_type" | "value" | "max_discount">) =>
  d.value_type === "percent" ? `${d.value}%${d.max_discount ? ` (tối đa ${formatVND(d.max_discount)})` : ""}` : formatVND(d.value);

// Trạng thái hiện tại
export function discountState(d: Discount): { label: string; tone: "green" | "gray" | "amber" | "red" | "blue" } {
  const now = Date.now();
  if (!d.is_active) return { label: "Đang tắt", tone: "gray" };
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return { label: "Sắp diễn ra", tone: "blue" };
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return { label: "Hết hạn", tone: "amber" };
  if (d.usage_limit && d.used_count >= d.usage_limit) return { label: "Hết lượt", tone: "red" };
  return { label: "Đang chạy", tone: "green" };
}
