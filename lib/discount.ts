// Giảm giá — tính XEM TRƯỚC ở trình duyệt (giống công thức SQL discount_amount_for / discount_value).
// Số tiền thật luôn do server tính lại trong create_order.
export type DiscountTarget = "goods" | "shipping";
export type PublicDiscount = {
  id: string; label: string; target: DiscountTarget; value_type: "amount" | "percent"; value: number; max_discount: number | null;
  scope: "order" | "items"; option_ids: string[]; package_ids?: string[]; addon_ids?: string[];
  min_order: number | null; starts_at?: string | null; ends_at: string | null;
};
export type CartItem = { type: "package" | "addon"; id: string; name: string; price: number; qty: number };

const idsOf = (d: Pick<PublicDiscount, "option_ids" | "package_ids" | "addon_ids">) =>
  d.option_ids?.length ? d.option_ids : [...(d.package_ids ?? []), ...(d.addon_ids ?? [])];
const applies = (d: PublicDiscount, it: Pick<CartItem, "id">) => d.scope === "order" || idsOf(d).includes(it.id);

export const subtotalOf = (items: CartItem[]) => items.reduce((t, i) => t + i.price * i.qty, 0);

// Giảm tiền hàng (chưa xét giá trị tối thiểu)
export function discountAmount(d: PublicDiscount, items: CartItem[]) {
  const sub = subtotalOf(items);
  const hit = items.filter((i) => applies(d, i));
  const base = hit.reduce((t, i) => t + i.price * i.qty, 0);
  if (!base) return 0;
  let amt: number;
  if (d.value_type === "percent") {
    amt = Math.floor((base * d.value) / 100);
    if (d.max_discount) amt = Math.min(amt, d.max_discount);
  } else if (d.scope === "order") amt = Math.min(d.value, sub);
  else amt = hit.reduce((t, i) => t + Math.min(d.value, i.price) * i.qty, 0);
  return Math.min(amt, sub);
}

// Giảm phí ship (trên phí còn lại sau ưu đãi theo bậc)
export function shipDiscountAmount(d: Pick<PublicDiscount, "value_type" | "value" | "max_discount">, shipAfter: number) {
  if (shipAfter <= 0) return 0;
  let v = d.value_type === "percent" ? Math.floor((shipAfter * d.value) / 100) : Math.min(d.value, shipAfter);
  if (d.value_type === "percent" && d.max_discount) v = Math.min(v, d.max_discount);
  return Math.min(v, shipAfter);
}

export const discountValue = (d: PublicDiscount, items: CartItem[], shipAfter: number) =>
  d.target === "shipping" ? shipDiscountAmount(d, shipAfter) : discountAmount(d, items);

// "Giảm 20.000đ" / "Giảm 10% (tối đa 30.000đ)"
export function valueLabel(d: Pick<PublicDiscount, "value_type" | "value" | "max_discount">, fmt: (n: number) => string) {
  return d.value_type === "percent" ? `Giảm ${d.value}%${d.max_discount ? ` (tối đa ${fmt(d.max_discount)})` : ""}` : `Giảm ${fmt(d.value)}`;
}

// Mã: VIẾT HOA, không dấu, không khoảng trắng
export const toCode = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "D").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
export const randomCode = (n = 8) => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => a[x % a.length]).join("");
};
