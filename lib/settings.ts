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
  banner_bg: "#c8e03c",
};

// ---------- 6 lựa chọn trên trang chủ (key "home_options") ----------
export type OptionColor = "lime" | "violet" | "hot";
export type HomeOption = { title: string; href: string; icon_url: string | null; color: OptionColor };

// icon mặc định theo thứ tự (vector có sẵn)
export const optionIcons = ["bag", "book", "brush", "upload", "gallery", "chat"] as const;

export const defaultOptions: HomeOption[] = [
  { title: "Đặt đơn", href: "/dat-don", icon_url: null, color: "lime" },
  { title: "Hướng dẫn làm file", href: "/huong-dan", icon_url: null, color: "violet" },
  { title: "Tự Tay Thiết Kế", href: "/tu-thiet-ke", icon_url: null, color: "hot" },
  { title: "Nộp file", href: "/nop-file", icon_url: null, color: "lime" },
  { title: "Sản phẩm & Đánh giá", href: "/san-pham", icon_url: null, color: "violet" },
  { title: "Liên Hệ", href: "/lien-he", icon_url: null, color: "hot" },
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
