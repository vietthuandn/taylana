/* Sức chứa booklet: trang 1 là bìa (không lyrics); mỗi trang lyrics tối đa 2 bài; bài DÀI (không vừa nửa trang) chiếm nguyên trang.
   "Dài" tính theo CHIỀU CAO THẬT sau khi dàn chữ (truyền hàm đo — xem longRule); số = cách cũ: đếm dòng thô > LONG_SONG_LINES.
   Số trang lyrics tối thiểu = tổng "suất" (bài ngắn 0.5, bài dài 1), làm tròn lên. Gói n trang dùng được khi (n − 1) ≥ số đó. */
import { songFits, type Ctx } from "./render";
import { GUTTER_MM, PAGE_MM, SAFE_MM } from "./types";
import { PACKS, type Song } from "./types";

export const lineCount = (lyrics: string) => (lyrics.trim() ? lyrics.replace(/\n{3,}/g, "\n\n").trim().split("\n").length : 0);
export type LongRule = number | ((s: Song, i: number) => boolean);
export const isLong = (s: Song, rule: LongRule, i = 0) => !s.titleOnly && (typeof rule === "number" ? lineCount(s.lyrics) > rule : rule(s, i));
/** Bài dài = không vừa khối nửa trang (3 cột, đúng font + cỡ chữ + kiểu lời), đo bằng canvas measureText */
export function longRule(c: Pick<Ctx, "bodyFont" | "titleFont" | "minPt" | "fmt">): LongRule {
  const w = PAGE_MM - SAFE_MM - GUTTER_MM, half = (PAGE_MM - SAFE_MM * 2) / 2 - 2;
  return (s, i) => !songFits(s, i, c, w, half);
}
export function minLyricPages(songs: Song[], longLines: LongRule) {
  return Math.ceil(songs.reduce((t, s, i) => t + (isLong(s, longLines, i) ? 1 : 0.5), 0));
}
export const packFits = (n: number, songs: Song[], longLines: LongRule) => n - 1 >= minLyricPages(songs, longLines);
export const smallestPack = (songs: Song[], longLines: LongRule) => PACKS.find((n) => packFits(n, songs, longLines)) ?? null;
export { cleanLyrics } from "./clean";
