/* Dán danh sách bài / dán lời cả album. */
import { cleanLyrics } from "./clean";
import { norm } from "./lrclib";

export type TrackRow = { title: string; artist: string; duration: string; alt: string };
/** Mỗi dòng 1 bài: "Tên bài - Ca sĩ" / "Tên bài – Ca sĩ" / "Ca sĩ - Tên bài" (alt = phía còn lại, tìm lời thử cả 2 chiều),
 *  "1. Tên bài", "01) Tên bài", "Tên bài (3:45)" → bỏ số thứ tự, tách thời lượng; dòng trống bỏ qua. */
export function parseTrackList(text: string, commonArtist: string): TrackRow[] {
  return text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    let s = l.replace(/^\s*(?:#|track\s*)?\d{1,3}\s*[.)\-:–]\s*/i, "");
    let duration = "";
    const dm = s.match(/[\s([-]*(\d{1,2}:\d{2})\s*\)?\s*$/);
    if (dm) { duration = dm[1]; s = s.slice(0, dm.index).trim(); }
    const parts = s.split(/\s+[-–—]\s+/);
    if (parts.length >= 2) {
      const a = parts[0].trim(), b = parts.slice(1).join(" - ").trim();
      return { title: a, artist: b, duration, alt: b };
    }
    return { title: s.trim(), artist: commonArtist, duration, alt: "" };
  }).filter((r) => r.title);
}

export type Segment = { song: number | null; lyrics: string };
/** Tách 1 khối lời nhiều bài theo tên bài trong tracklist (không phân biệt hoa thường / dấu, bỏ số thứ tự đầu dòng). */
export function splitAlbumLyrics(text: string, titles: string[]): Segment[] {
  const T = titles.map((t) => norm(t));
  const lines = text.replace(/\r/g, "").split("\n");
  const near = (a: string, b: string) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    return s.length >= 4 && l.includes(s) && s.length / l.length >= 0.75;
  };
  const marks: { at: number; song: number }[] = [];
  lines.forEach((ln, i) => {
    const key = norm(ln.replace(/^\s*\d{1,3}\s*[.)\-:–]\s*/, ""));
    if (!key || key.split(" ").length > 12) return;
    const idx = T.findIndex((t) => near(key, t));
    if (idx >= 0 && !marks.some((m) => m.song === idx)) marks.push({ at: i, song: idx });
  });
  return marks.map((m, k) => ({ song: m.song, lyrics: cleanLyrics(lines.slice(m.at + 1, marks[k + 1]?.at ?? lines.length).join("\n")) })).filter((s) => s.lyrics);
}
