/* 5 mẫu cho N ảnh: seed lấy từ cài đặt admin (nếu có), mẫu bị admin ẩn thì không hiện với khách. */
import { generate } from "./generate";
import { STYLES, type ScrapAsset, type Style, type Template, type TemplateSetting } from "./types";

export const defaultSeed = (n: number, style: Style) => n * 100 + STYLES.findIndex((s) => s.id === style) + 1;
export function settingOf(settings: TemplateSetting[], n: number, style: Style): TemplateSetting {
  return settings.find((s) => s.n === n && s.style === style) ?? { n, style, seed: defaultSeed(n, style), is_active: true };
}
/** override: seed tạm do khách bấm "Xáo trộn" (theo phong cách) */
export function templatesFor(n: number, settings: TemplateSetting[], assets: ScrapAsset[], override: Partial<Record<Style, number>> = {}, all = false): Template[] {
  return STYLES.map((s) => settingOf(settings, n, s.id))
    .filter((s) => all || s.is_active)
    .map((s) => generate(n, s.style, override[s.style] ?? s.seed, assets));
}
