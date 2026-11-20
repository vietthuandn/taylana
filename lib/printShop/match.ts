/* Bàn in — xếp file vào ô theo tên file: ô của gói dùng lib/matchFileName (f1..fN, b1, b2, d); ô món lẻ: tên file có tên món
   (+ "sau" / "trong" / "back" → mặt thứ 2). */
import { matchFileName, normalizeName } from "@/lib/matchFileName";
import { fold, type Pack, type Slot } from "./types";

export function matchSlot(fileName: string, slots: Slot[], pack: Pack | null | undefined): string | null {
  const n = normalizeName(fileName);
  // món lẻ: khớp tên món trước (vd "card truoc.jpg", "card-sau.png")
  const addonSlots = slots.filter((s) => s.key.startsWith("a:"));
  for (const s of addonSlots) {
    const base = fold(s.label.split(" · ")[0]);
    const word = base.split(" ")[0];
    if (!n.includes(base) && !(word.length >= 4 && n.includes(word))) continue;
    const back = /(sau|trong|back|inside)/.test(n);
    const pick = addonSlots.find((x) => x.piece === s.piece && x.side === (back ? 1 : 0));
    if (pick) return pick.key;
  }
  if (pack) {
    const k = matchFileName(fileName, { front: pack.front, back: pack.back, disc: pack.disc });
    if (k && slots.some((s) => s.key === k)) return k;
  }
  return null;
}
/** xếp nhiều file: nhiều bản cùng gói (Combo 1, Combo 2) → file trùng ô thì xếp sang bản kế tiếp; ô đã có ảnh / tên không nhận ra
   → danh sách để chọn tay */
export function assign(files: File[], slots: Slot[], pack: Pack | null | undefined, filled: Set<string>) {
  const placed: { file: File; slot: string }[] = [], left: File[] = [], taken = new Set<string>();
  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true }))) {
    const k = matchSlot(f.name, slots, pack);
    const cands = k ? (k.startsWith("a:") ? [k] : slots.filter((s) => s.key === k || s.key.endsWith(`:${k}`)).map((s) => s.key)) : [];
    const pick = cands.find((c) => !taken.has(c) && !filled.has(c)) ?? (k && !taken.has(k) && !cands.some((c) => filled.has(c)) ? k : undefined);
    if (pick) { placed.push({ file: f, slot: pick }); taken.add(pick); } else left.push(f);
  }
  return { placed, left };
}
