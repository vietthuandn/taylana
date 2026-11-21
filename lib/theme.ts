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
  section_text: string; // tiêu đề khối + tên các mục ở Trang chủ / trang Thiết kế
  tile_bg: string; // nền bo góc phía sau ảnh các mục (Trang chủ, Thiết kế, Đặt đơn)
  logo_url: string | null; // logo riêng (không có = chữ TAYLANA)
};
export const DEFAULT_THEME: Theme = {
  primary: "#ff5fa2", secondary: "#fff0f6", page_bg: "#f7f7f8", page_bg_image: null,
  header_bg: "#ffffff", header_text: "#18181b", header_active: "#ff5fa2", section_text: "#1a1a1a", tile_bg: "#fde4ec", logo_url: null,
};
/** nền header: mã màu #rrggbb HOẶC mã gradient CSS (linear-gradient(...) / radial-gradient(...)) */
export const isHeaderBg = (v: string) => /^#[0-9a-f]{6}$/i.test(v) || (/^(linear|radial)-gradient\([#%0-9a-z.,\s()-]+\)$/i.test(v) && v.length <= 300);
/** gradient đẹp gợi ý từ 1 màu: đậm → nhạt dần (sang trắng) */
export function suggestGradient(hex: string) {
  const mix = (k: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * k).toString(16).padStart(2, "0")).join("");
  return `linear-gradient(120deg, ${hex} 0%, ${mix(0.35)} 50%, ${mix(0.75)} 100%)`;
}
/** theme tự tạo đã lưu (Admin → Giao diện → Theme, tối đa 5) */
export type SavedTheme = { id: string; name: string; theme: Theme };
export const MAX_THEMES = 5;

const HEX = /^#[0-9a-f]{6}$/i;
export function normalizeTheme(v: unknown): Theme {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const c = (k: keyof Theme) => (typeof o[k] === "string" && HEX.test(o[k] as string) ? (o[k] as string) : (DEFAULT_THEME[k] as string));
  const url = (k: string) => (typeof o[k] === "string" && /^https?:\/\//.test(o[k] as string) ? (o[k] as string) : null);
  const hb = typeof o.header_bg === "string" && isHeaderBg(o.header_bg.trim()) ? o.header_bg.trim() : DEFAULT_THEME.header_bg;
  return { primary: c("primary"), secondary: c("secondary"), page_bg: c("page_bg"), page_bg_image: url("page_bg_image"), header_bg: hb, header_text: c("header_text"), header_active: c("header_active"), section_text: c("section_text"), tile_bg: c("tile_bg"), logo_url: url("logo_url") };
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
  if (t.section_text !== d.section_text) v.push(`--c-section-text:${t.section_text}`);
  if (t.tile_bg !== d.tile_bg) v.push(`--c-tile-bg:${t.tile_bg}`);
  return v.length ? `:root{${v.join(";")}}` : "";
}
/** nền trang: ảnh (phủ kín) đè lên màu */
export const pageBgStyle = (t: Theme): React.CSSProperties =>
  t.page_bg_image ? { backgroundColor: "var(--c-page-bg)", backgroundImage: `url("${t.page_bg_image.replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "scroll" } : { backgroundColor: "var(--c-page-bg)" };
