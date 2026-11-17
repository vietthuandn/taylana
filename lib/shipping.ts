// Phí vận chuyển theo bậc. Trình duyệt chỉ XEM TRƯỚC — server tính lại (shipping_quote) trong create_order.
//   site_settings "shipping": { fee, note } · bảng shipping_tiers: { min_amount, percent }
export type ShippingTier = { id?: string; min_amount: number; percent: number };
export type ShippingSettings = { fee: number; note: string; tiers: ShippingTier[] };
export const defaultShipping: ShippingSettings = { fee: 30000, note: "", tiers: [] };

export function mergeShipping(v: unknown, tiers: ShippingTier[] = []): ShippingSettings {
  const o = (v && typeof v === "object" ? v : {}) as { fee?: number; note?: string };
  return {
    fee: Math.max(0, Math.round(Number(o.fee ?? defaultShipping.fee)) || 0),
    note: typeof o.note === "string" ? o.note : "",
    tiers: [...tiers].map((t) => ({ ...t, min_amount: Math.max(0, Math.round(t.min_amount)), percent: Math.max(0, Math.min(100, Math.round(t.percent))) }))
      .sort((a, b) => a.min_amount - b.min_amount),
  };
}

// subtotal = tiền hàng TRƯỚC giảm giá. Áp dụng bậc CAO NHẤT đạt được.
export function shippingFor(s: ShippingSettings, subtotal: number) {
  const hit = s.tiers.filter((t) => t.min_amount <= subtotal).sort((a, b) => b.min_amount - a.min_amount)[0];
  const pct = hit?.percent ?? 0;
  const after = s.fee - Math.floor((s.fee * pct) / 100);
  const next = s.tiers.filter((t) => t.min_amount > subtotal && t.percent > pct).sort((a, b) => a.min_amount - b.min_amount)[0];
  return {
    base: s.fee, pct, after,
    next: next ? { need: next.min_amount - subtotal, percent: next.percent, progress: Math.min(1, subtotal / Math.max(1, next.min_amount)) } : null,
  };
}
