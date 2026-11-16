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
