/* Theme trang khách (site_settings.theme — Admin → Giao diện → Theme). Mặc định = bộ màu gốc của web; "Đặt lại mặc định" = xoá về đây.
   Áp dụng bằng biến CSS (--c-primary …) trong layout trang khách — trang admin không đổi. */
export type Theme = {
  primary: string; // màu chính: nút, chữ nhấn, viền đang chọn
  secondary: string; // nền nút / chip khi đang chọn
  page_bg: string; // màu nền trang
  page_bg_image: string | null; // ảnh nền trang (phủ kín, đè lên màu nền)
  header_bg: string; // nền header
  header_text: string; // chữ trên header (logo, menu)
  header_active: string; // menu đang chọn trên header
};
export const DEFAULT_THEME: Theme = {
  primary: "#ff5fa2", secondary: "#fff0f6", page_bg: "#f7f7f8", page_bg_image: null,
  header_bg: "#ffffff", header_text: "#18181b", header_active: "#ff5fa2",
};
const HEX = /^#[0-9a-f]{6}$/i;
export function normalizeTheme(v: unknown): Theme {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const c = (k: keyof Theme) => (typeof o[k] === "string" && HEX.test(o[k] as string) ? (o[k] as string) : (DEFAULT_THEME[k] as string));
  const img = typeof o.page_bg_image === "string" && /^https?:\/\//.test(o.page_bg_image) ? o.page_bg_image : null;
  return { primary: c("primary"), secondary: c("secondary"), page_bg: c("page_bg"), page_bg_image: img, header_bg: c("header_bg"), header_text: c("header_text"), header_active: c("header_active") };
}
/** CSS ghi đè biến màu (chỉ các giá trị khác mặc định) */
export function themeCss(t: Theme) {
  const d = DEFAULT_THEME, v: string[] = [];
  if (t.primary !== d.primary) v.push(`--c-primary:${t.primary}`, `--c-primary-hover:color-mix(in oklab,${t.primary},black 8%)`);
  if (t.secondary !== d.secondary) v.push(`--c-secondary:${t.secondary}`);
  if (t.page_bg !== d.page_bg) v.push(`--c-page-bg:${t.page_bg}`);
  if (t.header_bg !== d.header_bg) v.push(`--c-header-bg:${t.header_bg}`);
  if (t.header_text !== d.header_text) v.push(`--c-header-text:${t.header_text}`);
  if (t.header_active !== d.header_active) v.push(`--c-header-active:${t.header_active}`);
  return v.length ? `:root{${v.join(";")}}` : "";
}
/** nền trang: ảnh (phủ kín) đè lên màu */
export const pageBgStyle = (t: Theme): React.CSSProperties =>
  t.page_bg_image ? { backgroundColor: "var(--c-page-bg)", backgroundImage: `url("${t.page_bg_image.replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "scroll" } : { backgroundColor: "var(--c-page-bg)" };
