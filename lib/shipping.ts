// Phí vận chuyển (bảng site_settings, key "shipping"). Trình duyệt chỉ XEM TRƯỚC — server tính lại trong create_order.
export type ShippingSettings = { fee: number; free_enabled: boolean; free_threshold: number; note: string };
export const defaultShipping: ShippingSettings = { fee: 30000, free_enabled: false, free_threshold: 100000, note: "" };

export function mergeShipping(v: unknown): ShippingSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<ShippingSettings>;
  return {
    fee: Math.max(0, Math.round(Number(o.fee ?? defaultShipping.fee)) || 0),
    free_enabled: !!o.free_enabled,
    free_threshold: Math.max(0, Math.round(Number(o.free_threshold ?? defaultShipping.free_threshold)) || 0),
    note: typeof o.note === "string" ? o.note : "",
  };
}

// subtotal = tiền hàng TRƯỚC giảm giá
export function shippingFor(s: ShippingSettings, subtotal: number) {
  const free = s.free_enabled && subtotal >= s.free_threshold;
  return {
    base: s.fee, // phí gốc
    fee: free ? 0 : s.fee, // phí phải trả
    free,
    need: s.free_enabled && !free ? s.free_threshold - subtotal : 0, // còn thiếu để được freeship
    progress: s.free_enabled && s.free_threshold > 0 ? Math.min(1, subtotal / s.free_threshold) : 0,
  };
}
