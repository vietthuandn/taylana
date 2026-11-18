/* Sức chứa booklet: trang 1 là bìa (không lyrics); mỗi trang lyrics tối đa 2 bài; bài dài hơn LONG_SONG_LINES dòng chiếm nguyên trang.
   Số trang lyrics tối thiểu = tổng "suất" (bài ngắn 0.5, bài dài 1), làm tròn lên. Gói n trang dùng được khi (n − 1) ≥ số đó. */
import { PACKS, type Song } from "./types";

export const lineCount = (lyrics: string) => (lyrics.trim() ? lyrics.replace(/\n{3,}/g, "\n\n").trim().split("\n").length : 0);
export const isLong = (s: Song, longLines: number) => !s.titleOnly && lineCount(s.lyrics) > longLines;
export function minLyricPages(songs: Song[], longLines: number) {
  return Math.ceil(songs.reduce((t, s) => t + (isLong(s, longLines) ? 1 : 0.5), 0));
}
export const packFits = (n: number, songs: Song[], longLines: number) => n - 1 >= minLyricPages(songs, longLines);
export const smallestPack = (songs: Song[], longLines: number) => PACKS.find((n) => packFits(n, songs, longLines)) ?? null;
/** Dọn lyrics: bỏ khoảng trắng cuối dòng, giữ tối đa 1 dòng trống liên tiếp, giữ ngắt dòng của khách */
export const cleanLyrics = (t: string) => t.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
