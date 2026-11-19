/* Bàn in — quy đổi phân loại thành việc cần in (bảng print_variation_rules): cụm chữ (không phân biệt hoa thường + dấu) khớp
   trong phân loại (ưu tiên) hoặc tên sản phẩm → 1 gói CD · 1 món in lẻ · "Không cần in" · cờ "Ghi nhạc". Dòng không khớp quy tắc
   nào → đơn "Chưa xác định". Số lượng của dòng món lẻ = số lần thêm món; của dòng gói = số bản (qty của đơn). */
import { fold, type Addon, type Order, type Pack, type Rule } from "./types";

type Line = Order["lines"][number];
/** gói theo quy tắc: id cụ thể → theo số trang bìa trước / booklet (0 = CD lẻ chỉ mặt đĩa) → theo tên */
export function packOfRule(r: Rule, packs: Pack[]): Pack | null {
  if (r.package_id) { const p = packs.find((x) => x.id === r.package_id); if (p) return p; }
  if (r.package_front != null) {
    const n = r.package_front;
    const c = packs.filter((p) => p.front === n && (n > 0 || (p.disc && p.back === 0)));
    if (c.length) return c.find((p) => p.disc) ?? c[0];
  }
  if (r.package_label) { const f = fold(r.package_label); return packs.find((p) => fold(p.name).includes(f)) ?? null; }
  return null;
}
export const addonOfRule = (r: Rule, addons: Addon[]) => addons.find((a) => a.id === r.addon_id) ?? addons.find((a) => a.code === r.addon_code) ?? null;
/** quy tắc khớp 1 dòng: phân loại trước, không có mới xét tên sản phẩm; cụm dài ưu tiên */
export function rulesFor(l: Line, rules: Rule[]) {
  const sorted = rules.slice().sort((a, b) => a.sort_order - b.sort_order || fold(b.pattern).length - fold(a.pattern).length);
  const hit = (txt: string) => { const t = fold(txt); return t ? sorted.filter((r) => fold(r.pattern) && t.includes(fold(r.pattern))) : []; };
  const v = hit(l.variation);
  return v.length ? v : hit(l.product);
}
export function resolve(lines: Line[], rules: Rule[], packs: Pack[], addons: Addon[]) {
  let pack: Pack | null = null, qty = 1, music = false, unresolved = false;
  const ads: string[] = [];
  for (const l of lines) {
    const rs = rulesFor(l, rules);
    let ok = false;
    for (const r of rs) {
      if (r.result === "package") { const p = packOfRule(r, packs); if (p) { if (!pack) { pack = p; qty = Math.max(1, l.qty); } ok = true; } }
      else if (r.result === "addon") { const a = addonOfRule(r, addons); if (a) { for (let i = 0; i < Math.max(1, l.qty); i++) ads.push(a.id); ok = true; } }
      else if (r.result === "music") { music = true; ok = true; }
      else ok = true; // không cần in
    }
    if (!ok) unresolved = true;
  }
  if (!pack && !ads.length && !lines.length) unresolved = true;
  return { package_id: (pack as Pack | null)?.id ?? null, addons: ads, music, unresolved, qty };
}
