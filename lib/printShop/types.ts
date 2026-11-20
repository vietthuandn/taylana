/* Bàn in (admin /admin/ban-in): kiểu dữ liệu dùng chung. Dữ liệu phiên lưu ở database (print_batches / print_orders /
   print_items / print_variation_rules / print_addons — chỉ admin), FILE ẢNH chỉ lưu trên máy (IndexedDB, lib/printShop/files). */
export type Batch = { id: string; name: string; status: "doing" | "done"; created_at: string; finished_at: string | null; progress: Progress | null };
/** tiến độ hàng đợi in đang chạy (lưu vào print_batches.progress) */
export type Progress = { run?: { orderIds: string[]; mode: "group" | "order"; merge: boolean; at: string }; done?: Record<string, boolean>; flipped?: Record<string, boolean> };
export type Order = {
  id: string; batch_id: string; seq: number; order_code: string; username: string; product: string; variation: string; qty: number;
  lines: { product: string; variation: string; qty: number }[]; // các dòng sản phẩm của đơn (gộp theo mã đơn)
  package_id: string | null; addons: string[]; music: boolean; unresolved: boolean; status: "new" | "printed"; created_at?: string;
  packs?: PackQty[] | null; // NHIỀU gói / đơn, mỗi gói có số lượng (bản cũ: package_id + qty)
};
export type PackQty = { id: string; qty: number };
/** các gói của đơn (đọc cả dữ liệu cũ package_id + qty) */
export const packsOf = (o: Pick<Order, "packs" | "package_id" | "qty">): PackQty[] =>
  o.packs?.length ? o.packs : o.package_id ? [{ id: o.package_id, qty: Math.max(1, o.qty || 1) }] : [];
export type Item = { id: string; order_id: string; slot: string; file_name: string; w: number; h: number; rot: number };
export type Addon = { id: string; code: string; name: string; w_cm: number; h_cm: number; sides: string[]; rounded: boolean; group_key: "front" | "back" | "card"; sort_order: number; is_active: boolean };
export type Rule = { id: string; pattern: string; result: "package" | "addon" | "skip" | "music"; package_id: string | null; package_front: number | null; package_label: string | null; addon_id: string | null; addon_code: string | null; sort_order: number };
/** gói CD (tuỳ chọn Loại của sản phẩm CD): số trang bìa trước / booklet, số mặt bìa sau, có mặt đĩa */
export type Pack = { id: string; name: string; front: number; back: number; disc: boolean };

export type GroupKey = "booklet" | "front" | "back" | "card" | "disc";
export const GROUPS: { key: GroupKey; name: string }[] = [
  { key: "booklet", name: "Booklet" }, { key: "front", name: "Bìa trước" }, { key: "back", name: "Bìa sau" }, { key: "card", name: "Card bo góc" }, { key: "disc", name: "Mặt đĩa" },
];
/** 1 ô ảnh của đơn */
export type Slot = { key: string; label: string; group: GroupKey; w: number; h: number; shape: "rect" | "disc" | "rounded"; piece: string; side: number; optional?: boolean; inst?: number; instLabel?: string }; // inst: bản thứ mấy (chia hàng trên thẻ)

/** các ô ảnh của 1 đơn theo các gói (mỗi bản của mỗi gói = 1 bộ ô riêng: "Combo 12tr 1", "Combo 12tr 2"…) + món lẻ.
   piece = 1 vật in (1 hoặc 2 mặt); side 0 = mặt trước / ngoài, 1 = mặt sau / trong. Mặt đĩa KHÔNG in ở Bàn in.
   Khoá ô: bản 1 = "f1", "b1"… (giữ dữ liệu cũ) · bản thứ k = "p<k>:f1"… · món lẻ = "a:<id>:<lần>:<mặt>" */
export function slotsOf(o: Pick<Order, "addons" | "packs" | "package_id" | "qty">, packs: Pack[], addons: Addon[]): Slot[] {
  const out: Slot[] = [];
  const list = packsOf(o).flatMap((pq) => { const p = packs.find((x) => x.id === pq.id); return p ? Array.from({ length: Math.max(1, pq.qty) }, () => p) : []; });
  const many = list.length > 1, seenName: Record<string, number> = {};
  list.forEach((pack, i) => {
    const pre = i ? `p${i + 1}:` : "", n = (seenName[pack.id] = (seenName[pack.id] ?? 0) + 1);
    const tag = many ? `${pack.name} ${n} · ` : "";
    const add = (key: string, label: string, group: GroupKey, w: number, h: number, piece: string, side: number) => out.push({ key: pre + key, label: tag + label, group, w, h, shape: "rect", piece: pre + piece, side, inst: i + 1, instLabel: many ? `${pack.name} ${n}` : pack.name });
    if (pack.front >= 4) for (let k = 1; k <= pack.front; k++) add(`f${k}`, `Trang ${k}`, "booklet", 120, 120, "booklet", 0);
    else if (pack.front === 2) { add("f1", "Bìa trước · ngoài", "front", 120, 120, "front", 0); add("f2", "Bìa trước · trong", "front", 120, 120, "front", 1); }
    else if (pack.front === 1) add("f1", "Bìa trước", "front", 120, 120, "front", 0);
    if (pack.back >= 1) add("b1", "Bìa sau · ngoài", "back", 150, 117, "back", 0);
    if (pack.back >= 2) add("b2", "Bìa sau · trong", "back", 150, 117, "back", 1);
  });
  // món lẻ: mỗi lần chọn = 1 vật in riêng (a:<id>:<lần>:<mặt>)
  const seen: Record<string, number> = {};
  for (const id of o.addons) {
    const a = addons.find((x) => x.id === id);
    if (!a) continue;
    const n = (seen[id] = (seen[id] ?? 0) + 1), cnt = o.addons.filter((x) => x === id).length;
    a.sides.forEach((sd, i) => out.push({ key: `a:${id}:${n}:${i}`, label: `${a.name}${cnt > 1 ? ` ${n}` : ""} · ${sd}`, group: a.group_key, w: a.w_cm * 10, h: a.h_cm * 10, shape: a.rounded ? "rounded" : "rect", piece: `a:${id}:${n}`, side: i, inst: 100 + n, instLabel: `${a.name}${cnt > 1 ? ` ${n}` : ""}` }));
  }
  return out;
}
/** bỏ chữ "Ghi nhạc" khỏi phân loại / tên (tiệm không ghi nhạc) */
export const noMusic = (s: string) => (s ?? "").replace(/\s*[,|+/-]?\s*ghi\s*nh[aạ]c\b/gi, "").replace(/^\s*[,|+]\s*/, "").trim();
/** bỏ dấu + viết thường */
export const fold = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
export const fmtDay = (d = new Date()) => `In ngày ${d.getDate()}/${d.getMonth() + 1}`;
