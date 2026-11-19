/* Bàn in (admin /admin/ban-in): kiểu dữ liệu dùng chung. Dữ liệu phiên lưu ở database (print_batches / print_orders /
   print_items / print_variation_rules / print_addons — chỉ admin), FILE ẢNH chỉ lưu trên máy (IndexedDB, lib/printShop/files). */
export type Batch = { id: string; name: string; status: "doing" | "done"; created_at: string; finished_at: string | null; progress: Progress | null };
/** tiến độ hàng đợi in đang chạy (lưu vào print_batches.progress) */
export type Progress = { run?: { orderIds: string[]; mode: "group" | "order"; merge: boolean; at: string }; done?: Record<string, boolean>; flipped?: Record<string, boolean> };
export type Order = {
  id: string; batch_id: string; seq: number; order_code: string; username: string; product: string; variation: string; qty: number;
  package_id: string | null; addons: string[]; music: boolean; unresolved: boolean; status: "new" | "printed"; created_at?: string;
};
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
export type Slot = { key: string; label: string; group: GroupKey; w: number; h: number; shape: "rect" | "disc" | "rounded"; piece: string; side: number };

/** các ô ảnh của 1 đơn theo gói + món lẻ. piece = 1 vật in (1 hoặc 2 mặt); side 0 = mặt trước / ngoài, 1 = mặt sau / trong */
export function slotsOf(o: Pick<Order, "addons">, pack: Pack | null | undefined, addons: Addon[]): Slot[] {
  const out: Slot[] = [];
  if (pack) {
    if (pack.front >= 4) for (let k = 1; k <= pack.front; k++) out.push({ key: `f${k}`, label: `Trang ${k}`, group: "booklet", w: 120, h: 120, shape: "rect", piece: "booklet", side: 0 });
    else if (pack.front === 2) { out.push({ key: "f1", label: "Bìa trước · ngoài", group: "front", w: 120, h: 120, shape: "rect", piece: "front", side: 0 }); out.push({ key: "f2", label: "Bìa trước · trong", group: "front", w: 120, h: 120, shape: "rect", piece: "front", side: 1 }); }
    else if (pack.front === 1) out.push({ key: "f1", label: "Bìa trước", group: "front", w: 120, h: 120, shape: "rect", piece: "front", side: 0 });
    if (pack.back >= 1) out.push({ key: "b1", label: "Bìa sau · ngoài", group: "back", w: 150, h: 117, shape: "rect", piece: "back", side: 0 });
    if (pack.back >= 2) out.push({ key: "b2", label: "Bìa sau · trong", group: "back", w: 150, h: 117, shape: "rect", piece: "back", side: 1 });
    if (pack.disc) out.push({ key: "d", label: "Mặt đĩa", group: "disc", w: 120, h: 120, shape: "disc", piece: "disc", side: 0 });
  }
  // món lẻ: mỗi lần chọn = 1 vật in riêng (a:<id>:<lần>:<mặt>)
  const seen: Record<string, number> = {};
  for (const id of o.addons) {
    const a = addons.find((x) => x.id === id);
    if (!a) continue;
    const n = (seen[id] = (seen[id] ?? 0) + 1);
    a.sides.forEach((s, i) => out.push({ key: `a:${id}:${n}:${i}`, label: `${a.name} · ${s}`, group: a.group_key, w: a.w_cm * 10, h: a.h_cm * 10, shape: a.rounded ? "rounded" : "rect", piece: `a:${id}:${n}`, side: i }));
  }
  return out;
}
/** bỏ dấu + viết thường */
export const fold = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
export const fmtDay = (d = new Date()) => `In ngày ${d.getDate()}/${d.getMonth() + 1}`;
