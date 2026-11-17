// Giảm giá — tính XEM TRƯỚC ở trình duyệt (giống hệt công thức SQL discount_amount_for).
// Số tiền thật luôn do server tính lại trong create_order.
export type PublicDiscount = {
  id: string; label: string; value_type: "amount" | "percent"; value: number; max_discount: number | null;
  scope: "order" | "items"; package_ids: string[]; addon_ids: string[]; min_order: number | null; ends_at: string | null;
};
export type CartItem = { type: "package" | "addon"; id: string; name: string; price: number; qty: number };

const applies = (d: Pick<PublicDiscount, "scope" | "package_ids" | "addon_ids">, it: Pick<CartItem, "type" | "id">) =>
  d.scope === "order" || (it.type === "package" ? d.package_ids.includes(it.id) : d.addon_ids.includes(it.id));

export const subtotalOf = (items: CartItem[]) => items.reduce((t, i) => t + i.price * i.qty, 0);

// Số tiền giảm (chưa xét giá trị tối thiểu)
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

// Chương trình toàn shop tốt nhất cho giỏ hàng (đã đủ điều kiện) + gợi ý nếu chưa đủ tối thiểu
export function bestPublic(list: PublicDiscount[], items: CartItem[]) {
  const sub = subtotalOf(items);
  let best: { d: PublicDiscount; amount: number } | null = null;
  let hint: { need: number; amount: number; label: string } | null = null;
  for (const d of list) {
    const amt = discountAmount(d, items);
    if (amt <= 0) continue;
    if (d.min_order && sub < d.min_order) {
      if (!hint || d.min_order - sub < hint.need) hint = { need: d.min_order - sub, amount: amt, label: d.label };
      continue;
    }
    if (!best || amt > best.amount) best = { d, amount: amt };
  }
  return { best, hint };
}

// Giá gạch cho 1 đơn vị: chỉ khi chương trình không có điều kiện tối thiểu và tính được theo từng sản phẩm
export function unitPrice(list: PublicDiscount[], it: Pick<CartItem, "type" | "id" | "price">) {
  let best = it.price;
  for (const d of list) {
    if (d.min_order || !applies(d, it)) continue;
    let p = it.price;
    if (d.value_type === "percent" && !d.max_discount) p = it.price - Math.floor((it.price * d.value) / 100);
    else if (d.value_type === "amount" && d.scope === "items") p = it.price - Math.min(d.value, it.price);
    if (p < best) best = p;
  }
  return best;
}

// Mã: VIẾT HOA, không dấu, không khoảng trắng
export const toCode = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "D").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
export const randomCode = (n = 8) => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => a[x % a.length]).join("");
};
