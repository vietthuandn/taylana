// Kiểu dữ liệu tóm tắt đơn (từ RPC my_orders / orders_by_codes / lookup_order / order_upload_info)
export type OrderSummaryItem = {
  id: string; package_id: string | null; package_name: string; quantity: number;
  addons: { id: string; name: string; price: number; qty: number }[]; unit_price: number; line_total: number; copies_mode: "same" | "different";
};
export type OrderSummary = {
  id: string; code: string; payment_code: string | null; created_at: string; total: number; amount_due: number | null;
  status: "new" | "in_progress" | "delivered"; payment_status: string | null; items: OrderSummaryItem[]; file_count: number;
};
