/* Dọn lời bài hát khi dán / khi điền lời gợi ý:
   bỏ nhãn đoạn ([Chorus], [Verse 1], (Điệp khúc), [ĐK]…), dòng rác khi copy từ trang lyrics ("You might also like", "Embed",
   "See … Live", "Translations", "… Lyrics" ở dòng đầu, dòng chỉ có số contributor), mốc thời gian [00:12.34];
   bỏ khoảng trắng thừa đầu / cuối dòng, gộp nhiều dòng trống liên tiếp thành 1. Giữ nguyên ngắt dòng của khách. */

const TAG = /^[[(]\s*(chorus|verse|intro|outro|bridge|hook|refrain|pre[- ]?chorus|post[- ]?chorus|interlude|instrumental|break|drop|tag|coda|đk|dk|điệp khúc|diep khuc|phiên khúc|phien khuc|lời \d+|loi \d+|rap)\b[^\])]*[\])]\s*$/i;
const JUNK = [
  /^you might also like/i, /^\d*\s*embed$/i, /^see .* live$/i, /^get tickets as low as/i, /^translations?$/i,
  /^\d+\s*contributors?/i, /^\d+\s*người đóng góp/i, /^(english|español|français|deutsch|português|русский|tiếng việt)$/i, /^read more$/i,
];
const TIME = /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g;

export function cleanLyrics(text: string) {
  let lines = text.replace(/\r/g, "").replace(TIME, "").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  // "… Lyrics" ở dòng đầu (tiêu đề trang lyrics)
  const first = lines.findIndex((l) => l);
  if (first >= 0 && /\blyrics\b/i.test(lines[first]) && lines[first].length < 120) lines.splice(first, 1);
  lines = lines.filter((l) => !TAG.test(l) && !JUNK.some((r) => r.test(l))).map((l) => l.replace(/\s*\d*\s*embed$/i, ""));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
}
/** syncedLyrics (LRC) → lời thường: bỏ mốc thời gian [mm:ss.xx] */
export const stripTimestamps = (lrc: string) => lrc.replace(/\r/g, "").split("\n").map((l) => l.replace(TIME, "").trim()).join("\n");
