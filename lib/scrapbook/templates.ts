/* 5 mẫu cho N ảnh: seed lấy từ cài đặt admin (nếu có), mẫu bị admin ẩn thì không hiện với khách. */
import { generate, resolveFrameSets } from "./generate";
import { autoDecorate } from "./decor";
import { STYLES, type Frame, type ScrapAsset, type Style, type Template, type TemplateSetting } from "./types";

export const defaultSeed = (n: number, style: Style) => n * 100 + STYLES.findIndex((s) => s.id === style) + 1;
export function settingOf(settings: TemplateSetting[], n: number, style: Style): TemplateSetting {
  return settings.find((s) => s.n === n && s.style === style && (s.surface_type ?? "disc") === "disc") ?? { n, style, seed: defaultSeed(n, style), is_active: true, surface_type: "disc" };
}
/** override: seed tạm do khách bấm "Xáo trộn" (theo phong cách) */
export function templatesFor(n: number, settings: TemplateSetting[], assets: ScrapAsset[], override: Partial<Record<Style, number>> = {}, all = false, frames: Frame[] = []): Template[] {
  return STYLES.map((s) => settingOf(settings, n, s.id))
    .filter((s) => all || s.is_active)
    // mẫu admin đã chỉnh tay → dùng luôn (trừ khi khách bấm "Xáo trộn" cho phong cách đó)
    // mẫu sửa tay: giữ nguyên sticker của mẫu, chỉ bổ sung sticker ngẫu nhiên vào chỗ trống nếu còn ít hơn mức tối thiểu
    .map((s) => (s.template && override[s.style] === undefined ? autoDecorate({ ...s.template, id: `${n}-${s.style}`, n, style: s.style, layers: resolveFrameSets(s.template.layers, frames, s.seed) }, s.seed, assets, { topUp: true }) : generate(n, s.style, override[s.style] ?? s.seed, assets, frames)));
}
