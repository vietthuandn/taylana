/* Chất liệu: Loại (cố định, hệ thống dùng để rải sticker / băng dính) · Nhóm (chủ đề admin tự đặt) · Tags · tên tự động.
   Tên tự động = Nhóm + (" - " + tag đầu tiên) + " " + số thứ tự 2 chữ số, nối tiếp số lớn nhất đang có của cùng tiền tố. */
import type { AssetGroup, AssetGroupRow, ScrapAsset } from "./types";

/** các Loại admin chọn được (khung ảnh quản lý ở tab riêng) — tên ngắn = nhóm mặc định khi để trống */
export const ASSET_TYPES: { id: AssetGroup; name: string }[] = [
  { id: "sticker", name: "Sticker" }, { id: "tape", name: "Băng dính" }, { id: "doodle", name: "Doodle" },
  { id: "paper", name: "Mảnh giấy" }, { id: "texture", name: "Texture nền giấy" },
];
export const typeName = (t: string) => ASSET_TYPES.find((x) => x.id === t)?.name ?? (t === "frame" ? "Khung" : "Sticker");
/** bỏ dấu + viết thường (so khớp không phân biệt hoa thường và dấu) */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
export const slugify = (s: string) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "nhom";
/** tag: viết thường, gộp khoảng trắng thừa */
export const normTag = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim().replace(/^#/, "");
/** chuẩn hoá bản ghi từ database: Loại = asset_type (mới) hoặc grp (cũ) */
export const normAsset = (a: ScrapAsset): ScrapAsset => ({ ...a, grp: (a.asset_type ?? a.grp) as AssetGroup, tags: a.tags ?? [] });

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const namePrefix = (group: string, tags?: string[] | null) => `${group.trim()}${tags?.[0] ? ` - ${tags[0]}` : ""}`;
/** số lớn nhất đang dùng của 1 tiền tố ("Sticker - meme 07" → 7) */
export function maxNo(prefix: string, names: string[]) {
  const re = new RegExp(`^${esc(prefix)} (\\d+)$`, "i");
  let m = 0;
  for (const n of names) { const r = re.exec(n.trim()); if (r) m = Math.max(m, Number(r[1])); }
  return m;
}
export const fmtNo = (n: number) => String(n).padStart(2, "0");
/** đặt tên lần lượt cho nhiều món (mỗi món: tiền tố riêng), nối tiếp tên đã có */
export function autoNames(items: { prefix: string }[], existing: string[]) {
  const next = new Map<string, number>();
  return items.map(({ prefix }) => {
    const k = prefix.toLowerCase();
    const n = (next.get(k) ?? maxNo(prefix, existing)) + 1;
    next.set(k, n);
    return `${prefix} ${fmtNo(n)}`;
  });
}
/** nhóm sắp theo số chất liệu (nhiều → ít), kèm số lượng */
export function groupCounts(groups: AssetGroupRow[], assets: ScrapAsset[]) {
  const c = new Map<string, number>();
  for (const a of assets) if (a.group_id) c.set(a.group_id, (c.get(a.group_id) ?? 0) + 1);
  return groups.map((g) => ({ ...g, count: c.get(g.id) ?? 0 })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
}
/** tag đang dùng, sắp theo số lần dùng */
export function tagCounts(assets: ScrapAsset[]) {
  const c = new Map<string, number>();
  for (const a of assets) for (const t of a.tags ?? []) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}
