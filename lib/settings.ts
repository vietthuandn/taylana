import { publicClient } from "./supabase/public";

export type HomeSettings = {
  banner_title: string;
  banner_subtitle: string;
  banner_note: string;
};

export type ContactSettings = {
  zalo: string; // link Zalo, ví dụ https://zalo.me/09xxxxxxxx
  shopee: string;
  facebook: string;
  phone: string;
  hours: string;
  note: string;
};

export const defaultHome: HomeSettings = {
  banner_title: "Chào mừng đến Tiệm In Taylana!",
  banner_subtitle: "Thiết kế & thi công CD theo yêu cầu — từ bìa hộp, mặt đĩa đến booklet, làm thủ công thật xinh cho bạn.",
  banner_note: "Đang nhận đơn ✿ Giao toàn quốc",
};

export const defaultContact: ContactSettings = {
  zalo: "",
  shopee: "",
  facebook: "",
  phone: "",
  hours: "8:00 – 21:00 mỗi ngày",
  note: "Nhắn tiệm để được tư vấn mẫu và báo giá nhé!",
};

export async function getSettings() {
  const sb = publicClient();
  let home = defaultHome;
  let contact = defaultContact;
  if (sb) {
    const { data } = await sb.from("site_settings").select("key, value").in("key", ["home", "contact"]);
    for (const row of data ?? []) {
      if (row.key === "home") home = { ...defaultHome, ...row.value };
      if (row.key === "contact") contact = { ...defaultContact, ...row.value };
    }
  }
  return { home, contact };
}
