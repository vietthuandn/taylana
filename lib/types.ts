// Kiểu dữ liệu khớp với các bảng trong supabase/schema.sql
export type Package = {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  // preset thiết kế trang Custom CD (có sau migration_package_presets.sql)
  has_disc?: boolean;
  front_pages?: number;
  back_pages?: number;
  // nhiều ảnh (có sau migration_package_images.sql) — ảnh đầu tiên là ảnh chính
  images?: string[];
};

export type Addon = {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export type OrderStatus = "new" | "in_progress" | "delivered";
export type OrderType = "cd" | "custom_cd" | "photostrip";

export type OrderItem = { type: "package" | "addon"; id: string; name: string; price: number; qty: number };

export type Order = {
  id: string;
  code: string;
  order_type: OrderType;
  customer_name: string;
  phone: string;
  address: string;
  note: string;
  quantity: number;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  music_link: string;
  admin_note: string;
  delivered_at: string | null;
  files_cleaned_at: string | null;
  created_at: string;
  // thanh toán (có sau migration_payment.sql)
  order_no?: number;
  payment_code?: string | null;
  amount_due?: number;
  paid_amount?: number;
  payment_status?: "unpaid" | "pending" | "deposited" | "paid" | "expired" | "cancelled";
  payment_deadline?: string | null;
  payment_claimed_at?: string | null;
  payment_confirmed_at?: string | null;
  payment_confirmed_by?: string | null;
  payment_note?: string;
  // giảm giá + địa chỉ chi tiết (có sau migration_discounts.sql)
  subtotal?: number | null;
  discount_code?: string | null;
  discount_label?: string | null;
  discount_amount?: number;
  shipping_fee?: number;
  shipping_base?: number;
  shipping_tier_percent?: number;
  shipping_after_tier?: number;
  ship_discount_code?: string | null;
  ship_discount_label?: string | null;
  ship_discount_amount?: number;
  shipping_free?: boolean;
  province?: string;
  ward?: string;
  street?: string;
  payment_log?: { at: string; by: string; action: string; amount?: number; note?: string }[];
};

export type OrderFile = {
  id: string;
  order_id: string;
  kind: string;
  page: number | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width_px: number | null;
  height_px: number | null;
  created_at: string;
};

export type ShowcaseItem = {
  id: string;
  title: string;
  category: string;
  image_url: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

export type Review = {
  id: string;
  customer_name: string;
  rating: number;
  content: string;
  image_url: string | null;
  is_approved: boolean;
  created_at: string;
};

export type GuideImage = { url: string; caption: string };
export type GuideLink = { label: string; url: string };
export type GuideSection = {
  id: string;
  title: string;
  body: string;
  images: GuideImage[];
  links: GuideLink[];
  is_active: boolean;
  sort_order: number;
};
