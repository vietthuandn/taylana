/* Bộ dàn trang Booklet Lyrics: mỗi mẫu là 1 chiến lược dàn (chỉ dùng khối HÌNH CHỮ NHẬT).
   Trang 1 = bìa (ảnh 1 tràn trang + tên album); trang lyrics tối đa 2 bài; chỗ trống lấp bằng ảnh
   (tràn trang · nửa trang · tràn 2 trang ở gáy · 1/3 trang · polaroid nghiêng nhẹ); trang cuối = credit hoặc ảnh. */
import { rng } from "@/lib/scrapbook/generate";
import { isLong, type LongRule } from "./capacity";
import { GUTTER_MM, PAGE_MM as P, SAFE_MM, type Album, type Block, type LayoutId, type Page, type Song } from "./types";

/** Khung nội dung của trang (lề an toàn 5 mm, phía gáy 7 mm). Trang lẻ = trang phải → gáy bên trái. */
export function contentBox(no: number) {
  const left = no % 2 === 1 ? GUTTER_MM : SAFE_MM;
  return { x: left, y: SAFE_MM, w: P - SAFE_MM - GUTTER_MM, h: P - SAFE_MM * 2 };
}
// nhóm bài vào trang lyrics: bài dài 1 trang, bài ngắn đi cặp đôi theo thứ tự
export function groupSongs(songs: Song[], longLines: LongRule) {
  const out: number[][] = [];
  let pend: number | null = null;
  songs.forEach((s, i) => {
    if (isLong(s, longLines, i)) { if (pend !== null) { out.push([pend]); pend = null; } out.push([i]); }
    else if (pend === null) pend = i; else { out.push([pend, i]); pend = null; }
  });
  if (pend !== null) out.push([pend]);
  return out;
}

export function buildBooklet(layout: LayoutId, n: number, songs: Song[], album: Album, seed: number, longLines: LongRule) {
  const r = rng(seed * 13 + n * 101 + layout.length * 7);
  const groups = groupSongs(songs, longLines).slice(0, n - 1);
  let free = n - 1 - groups.length;
  let slot = 0;
  const next = () => slot++;
  const pages: Page[] = [];
  // trang 1: bìa
  pages.push({ no: 1, blocks: [{ k: "photo", slot: next(), x: 0, y: 0, w: P, h: P }, { k: "cover", x: 0, y: P * 0.7, w: P, h: P * 0.3 }] });

  // trang cuối: credit / ảnh nếu còn chỗ, không thì chứa lyrics
  const endFree = free > 0;
  if (endFree) free--;
  const M = n - 2; // số trang ở giữa (2 … n − 1)
  const lyricMid = groups.length - (endFree ? 0 : 1);
  const tokens: ("L" | "F" | "S1" | "S2")[] = Array(M).fill("L");
  const freeIdx: number[] = [];
  if (layout === "cinema" && free >= 2) {
    // 1 cặp mở đôi ở giữa sách: trang chẵn p (trái) + p + 1 (phải)
    let best = -1;
    for (let i = 0; i + 1 < M; i++) { const p = i + 2; if (p % 2 === 0 && (best < 0 || Math.abs(p - n / 2) < Math.abs(best + 2 - n / 2))) best = i; }
    if (best >= 0) { tokens[best] = "S1"; tokens[best + 1] = "S2"; free -= 2; }
  }
  if (layout === "alternate") {
    // xen kẽ: lyrics, ảnh, lyrics, ảnh…
    for (let i = 1; i < M && free > 0; i += 2) if (tokens[i] === "L") { tokens[i] = "F"; free--; }
  }
  // phần trống còn lại: rải đều
  const open = tokens.map((t, i) => (t === "L" ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < free && open.length; k++) freeIdx.push(open[Math.min(open.length - 1, Math.round(((k + 1) * open.length) / (free + 1)))]);
  freeIdx.forEach((i) => { tokens[i] = "F"; });
  void lyricMid;

  let g = 0;
  const lyricPage = (no: number, grp: number[]): Block[] => {
    const b = contentBox(no);
    const one = grp.length === 1 && !isLong(songs[grp[0]], longLines, grp[0]);
    if (!one) return [{ k: "lyrics", songs: grp, ...b }];
    const flip = r() < 0.5;
    const half = b.h / 2 - 2;
    if (layout === "minimal") return [{ k: "lyrics", songs: grp, x: b.x, y: b.y, w: b.w, h: half }];
    if (layout === "alternate") return flip
      ? [{ k: "photo", slot: next(), x: 0, y: 0, w: P, h: P / 2 }, { k: "lyrics", songs: grp, x: b.x, y: P / 2 + 4, w: b.w, h: half }]
      : [{ k: "lyrics", songs: grp, x: b.x, y: b.y, w: b.w, h: half }, { k: "photo", slot: next(), x: 0, y: P / 2, w: P, h: P / 2 }];
    if (layout === "magazine") {
      // ảnh nửa trang trái / phải (phía ngoài) cạnh khối lyrics hẹp 2 cột → dùng trên / dưới để giữ 3 cột dễ đọc
      return no % 4 < 2
        ? [{ k: "photo", slot: next(), x: 0, y: 0, w: P, h: P * 0.48 }, { k: "lyrics", songs: grp, x: b.x, y: P * 0.48 + 5, w: b.w, h: P * 0.52 - 10 }]
        : [{ k: "lyrics", songs: grp, x: b.x, y: b.y, w: b.w, h: P * 0.52 - 10 }, { k: "photo", slot: next(), x: 0, y: P * 0.52, w: P, h: P * 0.48 }];
    }
    if (layout === "cinema") return [{ k: "lyrics", songs: grp, x: b.x, y: b.y, w: b.w, h: b.h * 0.64 }, { k: "photo", slot: next(), x: 0, y: P * 0.69, w: P, h: P * 0.31 }];
    // polaroid: 2 ảnh nhỏ nghiêng nhẹ ở nửa dưới
    return [
      { k: "lyrics", songs: grp, x: b.x, y: b.y, w: b.w, h: half },
      { k: "photo", slot: next(), x: b.x + 4, y: P / 2 + 6, w: 42, h: 42, rot: -4 + r() * 3, polaroid: true },
      { k: "photo", slot: next(), x: b.x + b.w - 46, y: P / 2 + 10, w: 42, h: 42, rot: 2 + r() * 3, polaroid: true },
    ];
  };
  const photoPage = (no: number): Block[] => {
    if (layout === "minimal") return [{ k: "photo", slot: next(), x: 18, y: 18, w: 84, h: 84 }];
    if (layout === "polaroid") return [
      { k: "photo", slot: next(), x: 12, y: 10, w: 52, h: 52, rot: -5 + r() * 2, polaroid: true },
      { k: "photo", slot: next(), x: 56, y: 22, w: 52, h: 52, rot: 3 + r() * 3, polaroid: true },
      { k: "photo", slot: next(), x: 30, y: 62, w: 48, h: 48, rot: -2 + r() * 4, polaroid: true },
    ];
    if (layout === "magazine") return no % 2 ? [{ k: "photo", slot: next(), x: 0, y: 0, w: P / 2, h: P }, { k: "photo", slot: next(), x: P / 2, y: 0, w: P / 2, h: P }] : [{ k: "photo", slot: next(), x: 0, y: 0, w: P, h: P }];
    return [{ k: "photo", slot: next(), x: 0, y: 0, w: P, h: P }];
  };
  let spreadSlot = -1;
  for (let i = 0; i < M; i++) {
    const no = i + 2, t = tokens[i];
    if (t === "L" && g < groups.length - (endFree ? 0 : 1)) pages.push({ no, blocks: lyricPage(no, groups[g++]) });
    else if (t === "S1") { spreadSlot = next(); pages.push({ no, blocks: [{ k: "photo", slot: spreadSlot, x: 0, y: 0, w: P * 2, h: P }] }); }
    else if (t === "S2") pages.push({ no, blocks: [{ k: "photo", slot: spreadSlot, x: -P, y: 0, w: P * 2, h: P }] }); // cùng 1 ảnh, cắt đúng ở gáy
    else pages.push({ no, blocks: photoPage(no) });
  }
  // trang cuối
  if (!endFree && g < groups.length) pages.push({ no: n, blocks: lyricPage(n, groups[g++]) });
  else if (album.credit.trim()) pages.push({ no: n, blocks: [{ k: "credit", ...contentBox(n) }] });
  else pages.push({ no: n, blocks: layout === "minimal" ? [{ k: "photo", slot: next(), x: 18, y: 18, w: 84, h: 84 }] : [{ k: "photo", slot: next(), x: 0, y: 0, w: P, h: P }] });
  return { pages, photoCount: slot, shownSongs: groups.slice(0, g).flat().length };
}
