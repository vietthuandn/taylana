/* Bàn in — hàng đợi in: đơn → VẬT IN (piece: 1 hoặc 2 mặt) → xếp lên TỜ GIẤY theo nhóm → các BƯỚC (Mặt trước · Lật giấy · Mặt sau).
   Booklet dàn trang theo lib/imposition (tờ 24 × 12 cm, 1 tờ / A4 ngang). Gộp nhiều đơn trên 1 tờ: bìa trước 12 × 12 và bìa sau
   15 × 11.7 → 2 hình / A4 dọc (tắt gộp: 1 hình / A5) · card → 8 / A4 ngang (tắt gộp: 2 / A6) · mặt đĩa: 1 trang 12 × 12 cm.
   Mặt sau đặt đối xứng với mặt trước theo kiểu lật giấy + độ lệch của hồ sơ in. Đơn vị: mm. */
import { impose } from "@/lib/imposition";
import { GROUPS, type GroupKey, type Order, type Slot } from "./types";

export type Profile = {
  bleed: number; // lề tràn (mm) — mặc định 0: file khách gửi đúng khổ in, in đúng kích thước
  innerGrow: number; // phóng to mỗi cạnh (mm) cho mặt trong của bìa trước 2 mặt + bìa sau (bù lệch khi in 2 mặt)
  marks: boolean; backDx: number; backDy: number;
  flip: "long" | "short"; // lật xấp giấy theo cạnh dài / cạnh ngắn
  backRotate: boolean; // xoay mặt sau 180°
  reverseBack: boolean; // in mặt sau theo thứ tự ngược (máy ra giấy úp mặt)
  feedFaceUp: boolean; // khay giấy: mặt sẽ in hướng lên
};
export const DEFAULT_PROFILE: Profile = { bleed: 0, innerGrow: 1, marks: true, backDx: 0, backDy: 0, flip: "long", backRotate: false, reverseBack: false, feedFaceUp: true };
const PKEY = "ban-in-profile-v2"; // v2: bỏ lề tràn mặc định
export function loadProfile(): Profile { try { return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(PKEY) ?? "{}") }; } catch { return DEFAULT_PROFILE; } }
export function saveProfile(p: Profile) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch { /* bỏ qua */ } }

/** nội dung 1 mặt: các ảnh (ô) đặt trong khung vật in, x / w theo mm (booklet: 2 trang trái phải) */
export type Content = { slot: string; x: number; w: number };
export type Piece = { id: string; order: Order; label: string; group: GroupKey; w: number; h: number; shape: Slot["shape"]; sides: Content[][] };
export type Place = { piece: Piece; side: number; x: number; y: number; rot180: boolean };
export type Sheet = { pw: number; ph: number; paper: string; places: Place[] };
export type Step = { key: string; group: GroupKey; kind: "front" | "flip" | "back"; title: string; sheets: Sheet[]; orderIds: string[]; note?: string };

/** vật in của 1 đơn (đã nhân số lượng). has: ô có ảnh — ô không bắt buộc (mặt đĩa) chưa có ảnh thì bỏ khỏi hàng đợi */
export function piecesOf(o: Order, slots: Slot[], has: (slot: string) => boolean = () => true): Piece[] {
  const out: Piece[] = [], by = new Map<string, Slot[]>();
  for (const s of slots) { if (s.optional && !has(s.key)) continue; by.set(s.piece, [...(by.get(s.piece) ?? []), s]); }
  for (const [piece, ss] of by) {
    if (piece === "booklet") {
      const n = ss.length;
      if (n >= 4 && n % 4 === 0) {
        const sides = impose(n);
        for (let k = 0; k < sides.length; k += 2) {
          const f = sides[k], b = sides[k + 1];
          out.push({ id: `${o.id}:bk${f.sheet}`, order: o, label: `Booklet tờ ${f.sheet}/${n / 4}`, group: "booklet", w: 240, h: 120, shape: "rect",
            sides: [[{ slot: `f${f.left}`, x: 0, w: 120 }, { slot: `f${f.right}`, x: 120, w: 120 }], ...(b ? [[{ slot: `f${b.left}`, x: 0, w: 120 }, { slot: `f${b.right}`, x: 120, w: 120 }]] : [])] });
        }
      }
      continue;
    }
    const s0 = ss[0], name = s0.label.split(" · ")[0].replace(" (tuỳ chọn)", "");
    out.push({ id: `${o.id}:${piece}`, order: o, label: name, group: s0.group, w: s0.w, h: s0.h, shape: s0.shape, sides: ss.sort((a, b) => a.side - b.side).map((s) => [{ slot: s.key, x: 0, w: s.w }]) });
  }
  const copies: Piece[] = [];
  for (let c = 0; c < Math.max(1, o.qty); c++) for (const p of out) copies.push(c ? { ...p, id: `${p.id}#${c + 1}`, label: `${p.label} (bản ${c + 1})` } : p);
  return copies;
}

type Paper = { name: string; pw: number; ph: number; cols: number; rows: number };
function paperOf(g: GroupKey, merge: boolean): Paper {
  if (g === "booklet") return { name: "A4 ngang", pw: 297, ph: 210, cols: 1, rows: 1 };
  if (g === "front") return merge ? { name: "A4 dọc", pw: 210, ph: 297, cols: 1, rows: 2 } : { name: "A5 dọc", pw: 148, ph: 210, cols: 1, rows: 1 };
  if (g === "back") return merge ? { name: "A4 dọc", pw: 210, ph: 297, cols: 1, rows: 2 } : { name: "A5 ngang", pw: 210, ph: 148, cols: 1, rows: 1 };
  if (g === "card") return merge ? { name: "A4 ngang", pw: 297, ph: 210, cols: 4, rows: 2 } : { name: "A6 ngang", pw: 148, ph: 105, cols: 2, rows: 1 };
  return { name: "12 × 12 cm", pw: 120, ph: 120, cols: 1, rows: 1 };
}
/** vị trí (góc trên trái khung cắt) các ô trên tờ, căn giữa, khoảng cách đủ chỗ cho lề tràn + vạch cắt + chữ ghi chú */
function slotsOn(p: Paper, w: number, h: number, bleed: number) {
  if (p.pw === w && p.ph === h) return [{ x: 0, y: 0 }];
  const gap = bleed * 2 + 14, tw = p.cols * w + (p.cols - 1) * gap, th = p.rows * h + (p.rows - 1) * gap;
  const x0 = (p.pw - tw) / 2, y0 = (p.ph - th) / 2, out: { x: number; y: number }[] = [];
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) out.push({ x: x0 + c * (w + gap), y: y0 + r * (h + gap) });
  return out;
}
/** mặt sau: đối xứng theo kiểu lật giấy (lật cạnh dài của tờ dọc = đối xứng trái phải…) + độ lệch */
function mirror(s: Sheet, pr: Profile): Sheet {
  const portrait = s.pw < s.ph, mx = (pr.flip === "long") === portrait;
  return { ...s, places: s.places.map((pl) => ({ ...pl, side: 1, rot180: pr.backRotate,
    x: (mx ? s.pw - pl.x - pl.piece.w : pl.x) + pr.backDx, y: (mx ? pl.y : s.ph - pl.y - pl.piece.h) + pr.backDy })) };
}
/** các bước của 1 nhóm. Nhóm 2 hình / A4 bị LẺ 1 cái → cái lẻ in riêng trên A5 (hàng riêng "· lẻ (A5)") */
function stepsFor(key: string, g: GroupKey, pieces: Piece[], merge: boolean, pr: Profile): { title: string; steps: Step[] }[] {
  if (!pieces.length) return [];
  const name = GROUPS.find((x) => x.key === g)!.name, out: { title: string; steps: Step[] }[] = [];
  const bySize = new Map<string, Piece[]>();
  for (const p of pieces) bySize.set(`${p.w}x${p.h}`, [...(bySize.get(`${p.w}x${p.h}`) ?? []), p]);
  const main: Piece[] = [], odd: Piece[] = [];
  for (const list of bySize.values()) {
    const cap = slotsOn(paperOf(g, merge), list[0].w, list[0].h, pr.bleed).length;
    if (merge && cap === 2 && list.length % 2 === 1) { main.push(...list.slice(0, -1)); odd.push(list[list.length - 1]); } else main.push(...list);
  }
  const make = (k: string, title: string, ps: Piece[], m: boolean) => {
    if (!ps.length) return;
    const paper = paperOf(g, m), fronts: Sheet[] = [], sizes = new Map<string, Piece[]>();
    for (const p of ps) sizes.set(`${p.w}x${p.h}`, [...(sizes.get(`${p.w}x${p.h}`) ?? []), p]);
    for (const list of sizes.values()) {
      const pos = slotsOn(paper, list[0].w, list[0].h, g === "disc" ? 0 : pr.bleed), cap = Math.max(1, pos.length);
      for (let i = 0; i < list.length; i += cap) fronts.push({ pw: paper.pw, ph: paper.ph, paper: paper.name, places: list.slice(i, i + cap).map((piece, j) => ({ piece, side: 0, x: pos[j].x, y: pos[j].y, rot180: false })) });
    }
    const ids = [...new Set(ps.map((p) => p.order.id))], two = ps.some((p) => p.sides.length > 1);
    const steps: Step[] = [{ key: `${k}|front`, group: g, kind: "front", title: two ? `${title} · Mặt trước` : title, sheets: fronts, orderIds: ids,
      note: g === "disc" ? "In bằng khay CD của máy in: mỗi đĩa 1 trang PDF 12 × 12 cm (không khoét lỗ)." : undefined }];
    if (two) {
      const backs = fronts.map((sh) => mirror({ ...sh, places: sh.places.filter((p) => p.piece.sides.length > 1) }, pr)).filter((sh) => sh.places.length);
      steps.push({ key: `${k}|flip`, group: g, kind: "flip", title: `${title} · Lật giấy`, sheets: [], orderIds: ids });
      steps.push({ key: `${k}|back`, group: g, kind: "back", title: `${title} · Mặt sau`, sheets: pr.reverseBack ? backs.reverse() : backs, orderIds: ids });
    }
    out.push({ title, steps });
  };
  make(key, name, main, merge);
  make(`${key}|a5`, `${name} · lẻ (A5)`, odd, false);
  return out;
}
/** các nhóm + bước in. mode "group": theo nhóm (đỡ thay giấy nhất) · "order": in xong trọn 1 đơn rồi sang đơn kế */
export function plan(orders: Order[], slotsFor: (o: Order) => Slot[], mode: "group" | "order", merge: boolean, pr: Profile, has: (o: Order, slot: string) => boolean = () => true) {
  const all = orders.flatMap((o) => piecesOf(o, slotsFor(o), (s) => has(o, s)));
  const sections: { title: string; steps: Step[] }[] = [];
  if (mode === "group") {
    for (const g of GROUPS) sections.push(...stepsFor(`g|${g.key}`, g.key, all.filter((p) => p.group === g.key), merge, pr));
  } else {
    for (const o of orders) {
      const ps = all.filter((p) => p.order.id === o.id), steps = GROUPS.flatMap((g) => stepsFor(`o|${o.id}|${g.key}`, g.key, ps.filter((p) => p.group === g.key), merge, pr).flatMap((x) => x.steps));
      if (steps.length) sections.push({ title: `#${o.seq} ${o.username || o.order_code}`, steps });
    }
  }
  return sections;
}
