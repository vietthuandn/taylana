import { publicClient } from "./supabase/public";

// ---------- Banner trang chủ (key "home" trong bảng site_settings) ----------
export type HomeSettings = {
  banner_title: string;
  banner_subtitle: string;
  banner_note: string;
  btn1_label: string;
  btn1_href: string;
  btn2_enabled: boolean;
  btn2_label: string;
  btn2_href: string;
  banner_image: string | null; // null = dùng ảnh mặc định
  banner_image_enabled: boolean; // bật/tắt ảnh bên phải
  banner_image_petal: boolean; // true = khung cánh hoa, false = hình vuông
  banner_bg: string; // màu nền banner
};

export const defaultHome: HomeSettings = {
  banner_title: "CD của bạn, theo cách của bạn",
  banner_subtitle: "Thiết kế & thi công CD theo yêu cầu — bìa hộp, mặt đĩa, booklet. Tiệm in sắc nét 300 DPI.",
  banner_note: "",
  btn1_label: "Đặt đơn ngay",
  btn1_href: "/dat-don",
  btn2_enabled: false,
  btn2_label: "Tự tay thiết kế",
  btn2_href: "/tu-thiet-ke",
  banner_image: null,
  banner_image_enabled: true,
  banner_image_petal: false,
  banner_bg: "#c8e03c",
};

// ---------- 6 lựa chọn trên trang chủ (key "home_options") ----------
export type OptionColor = "lime" | "violet" | "hot" | "custom";
// color = màu nền có sẵn hoặc "custom" (dùng bg_custom); icon_color rỗng = tự động đen/trắng
export type HomeOption = { title: string; href: string; icon_url: string | null; color: OptionColor; bg_custom: string; icon_color: string };

// icon mặc định theo thứ tự (vector có sẵn)
export const optionIcons = ["bag", "book", "brush", "upload", "gallery", "chat"] as const;

export const defaultOptions: HomeOption[] = [
  { title: "Đặt đơn", href: "/dat-don", icon_url: null, color: "lime", bg_custom: "#ffcf5c", icon_color: "" },
  { title: "Hướng dẫn làm file", href: "/huong-dan", icon_url: null, color: "violet", bg_custom: "#ffcf5c", icon_color: "" },
  { title: "Tự Tay Thiết Kế", href: "/tu-thiet-ke", icon_url: null, color: "hot", bg_custom: "#ffcf5c", icon_color: "" },
  { title: "Nộp file", href: "/nop-file", icon_url: null, color: "lime", bg_custom: "#ffcf5c", icon_color: "" },
  { title: "Sản phẩm & Đánh giá", href: "/san-pham", icon_url: null, color: "violet", bg_custom: "#ffcf5c", icon_color: "" },
  { title: "Liên Hệ", href: "/lien-he", icon_url: null, color: "hot", bg_custom: "#ffcf5c", icon_color: "" },
];

// ---------- Liên hệ (key "contact") ----------
export type ContactSettings = {
  zalo: string; // link Zalo, ví dụ https://zalo.me/09xxxxxxxx
  shopee: string;
  facebook: string;
  phone: string;
  address: string;
  hours: string;
  note: string; // lời nhắn / giới thiệu trên trang Liên Hệ
};

export const defaultContact: ContactSettings = {
  zalo: "",
  shopee: "",
  facebook: "",
  phone: "",
  address: "",
  hours: "8:00 – 21:00 mỗi ngày",
  note: "Nhắn tiệm để được tư vấn mẫu và báo giá nhé!",
};

export function mergeOptions(value: unknown): HomeOption[] {
  const saved = Array.isArray(value) ? (value as Partial<HomeOption>[]) : [];
  return defaultOptions.map((d, i) => ({ ...d, ...(saved[i] ?? {}) }));
}

export async function getSettings() {
  const sb = publicClient();
  let home = defaultHome;
  let contact = defaultContact;
  let options = defaultOptions;
  if (sb) {
    const { data } = await sb.from("site_settings").select("key, value").in("key", ["home", "contact", "home_options"]);
    for (const row of data ?? []) {
      if (row.key === "home") home = { ...defaultHome, ...row.value };
      if (row.key === "contact") contact = { ...defaultContact, ...row.value };
      if (row.key === "home_options") options = mergeOptions(row.value);
    }
  }
  return { home, contact, options };
}

// Nền tối → chữ/icon trắng
export function isDark(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}
