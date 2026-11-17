import { FEATURE_PHOTOSTRIP } from "./features";
import { publicClient } from "./supabase/public";

// ---------- Banner trang chủ (key "home" trong bảng site_settings) ----------
export type HomeSettings = {
  banner_enabled: boolean; // tắt = không hiện banner, 6 lựa chọn ra giữa màn hình (3 mỗi hàng)
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
  banner_enabled: true,
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

// ---------- 6 ô trên trang chủ (key "home_options") ----------
export type TextV = "top" | "middle" | "bottom";
export type TextH = "left" | "center" | "right";
export type TextColor = "ink" | "brown" | "white" | "lilac";
export type HomeOption = {
  title: string; // viết [chữ] trong ngoặc vuông để tô màu tím nhạt
  href: string;
  image_url: string | null; // ảnh phủ kín ô (không có thì dùng màu nền)
  bg: string; // màu nền
  text_v: TextV;
  text_h: TextH;
  text_color: TextColor;
};

// Bảng màu theo mẫu
export const TILE_COLORS = [
  { label: "Hồng nhạt", value: "#fff0f6" },
  { label: "Xám nhạt", value: "#f4f4f5" },
  { label: "Trắng", value: "#ffffff" },
  { label: "Hồng", value: "#ff5fa2" },
  { label: "Đen", value: "#18181b" },
  { label: "Xanh chanh", value: "#d4dd3f" },
  { label: "Xanh trời", value: "#a9c6e8" },
  { label: "Kem", value: "#fbf3e7" },
  { label: "Tím nhạt", value: "#c3b5f7" },
  { label: "Nâu", value: "#3b1510" },
];
export const TEXT_COLORS: Record<TextColor, string> = { ink: "#18181b", brown: "#3b1510", white: "#ffffff", lilac: "#a593f0" };

// icon mặc định khi ô chưa có ảnh (vector có sẵn)
export const optionIcons = ["bag", "book", "brush", "upload", "gallery", "chat"] as const;

export const defaultOptions: HomeOption[] = [
  { title: "Đặt đơn ngay", href: "/dat-don", image_url: null, bg: "#fff0f6", text_v: "middle", text_h: "left", text_color: "ink" },
  { title: "Hướng dẫn làm file", href: "/huong-dan", image_url: null, bg: "#f4f4f5", text_v: "top", text_h: "center", text_color: "ink" },
  { title: "Tự tay thiết kế", href: "/custom-cd", image_url: null, bg: "#ffffff", text_v: "top", text_h: "left", text_color: "ink" },
  { title: "Gửi file in", href: "/gui-file-in", image_url: null, bg: "#ffffff", text_v: "middle", text_h: "center", text_color: "ink" },
  { title: "Sản phẩm & [đánh giá]", href: "/san-pham", image_url: null, bg: "#f4f4f5", text_v: "top", text_h: "center", text_color: "ink" },
  { title: "Liên hệ", href: "/lien-he", image_url: null, bg: "#fff0f6", text_v: "bottom", text_h: "right", text_color: "ink" },
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
  const saved = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  return defaultOptions.map((d, i) => {
    const v = saved[i] ?? {};
    const pick = <K extends keyof HomeOption>(k: K, ok: (x: unknown) => boolean) => (ok(v[k]) ? (v[k] as HomeOption[K]) : d[k]);
    const str = (x: unknown) => typeof x === "string" && x !== "";
    // ô cũ "Nộp file" (đã lưu trong database) → đổi thành "Gửi file in"
    const old = v.href === "/nop-file";
    // "Tự tay thiết kế" giờ trỏ thẳng /custom-cd; link photostrip (đang tắt) cũng về /custom-cd
    const toCd = v.href === "/tu-thiet-ke" || (!FEATURE_PHOTOSTRIP && v.href === "/photostrip");
    return {
      title: old && (!v.title || v.title === "Nộp file") ? "Gửi file in" : pick("title", str),
      href: old ? "/gui-file-in" : toCd ? "/custom-cd" : pick("href", str),
      image_url: typeof v.image_url === "string" && v.image_url ? v.image_url : null,
      bg: pick("bg", (x) => typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x)),
      text_v: pick("text_v", (x) => x === "top" || x === "middle" || x === "bottom"),
      text_h: pick("text_h", (x) => x === "left" || x === "center" || x === "right"),
      text_color: pick("text_color", (x) => x === "ink" || x === "brown" || x === "white" || x === "lilac"),
    };
  });
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
