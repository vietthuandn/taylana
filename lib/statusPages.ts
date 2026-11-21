/* Trang trạng thái (Admin → Giao diện → Khác): "Tạm ngưng nhận đơn qua web" · 404 · 403.
   Mỗi trang: màu nền, ảnh minh hoạ (giữa trang, cỡ vừa như các mục trang chủ), 1 dòng thông báo, tối đa 3 nút điều hướng.
   Lưu site_settings.status_pages. "Tạm nghỉ bán" (Sản phẩm của tôi): site_settings.shop_paused = true. */
export type StatusKind = "paused" | "notfound" | "forbidden";
export type StatusBtn = { label: string; href: string };
export type StatusPage = { bg: string; image: string | null; message: string; buttons: StatusBtn[] };
export const STATUS_KINDS: [StatusKind, string][] = [["paused", "Tạm ngưng nhận đơn qua web"], ["notfound", "404 · Không tìm thấy trang"], ["forbidden", "403 · Không có quyền"]];
export const DEFAULT_STATUS: Record<StatusKind, StatusPage> = {
  paused: { bg: "#fff0f6", image: null, message: "Hiện đang tạm ngưng nhận đơn qua web, liên hệ Zalo để biết thêm chi tiết nhé.", buttons: [{ label: "Liên hệ", href: "/lien-he" }, { label: "Về trang chủ", href: "/" }] },
  notfound: { bg: "#f7f7f8", image: null, message: "Không tìm thấy trang bạn cần — có thể đường dẫn đã thay đổi.", buttons: [{ label: "Về trang chủ", href: "/" }] },
  forbidden: { bg: "#f7f7f8", image: null, message: "Bạn không có quyền xem trang này.", buttons: [{ label: "Về trang chủ", href: "/" }] },
};
export function normalizeStatus(v: unknown): Record<StatusKind, StatusPage> {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Partial<StatusPage>>;
  const one = (k: StatusKind): StatusPage => {
    const x = o[k] ?? {}, d = DEFAULT_STATUS[k];
    return {
      bg: typeof x.bg === "string" && /^#[0-9a-f]{6}$/i.test(x.bg) ? x.bg : d.bg,
      image: typeof x.image === "string" && /^https?:\/\//.test(x.image) ? x.image : null,
      message: typeof x.message === "string" ? x.message : d.message,
      buttons: Array.isArray(x.buttons) ? x.buttons.filter((b) => b && typeof b.label === "string" && b.label.trim() && typeof b.href === "string").slice(0, 3) : d.buttons,
    };
  };
  return { paused: one("paused"), notfound: one("notfound"), forbidden: one("forbidden") };
}
