"use client";
/* Tìm lời gợi ý qua API công khai LRCLIB — gọi THẲNG từ trình duyệt (không qua server của tiệm, không lưu kết quả).
   Giới hạn 1 lần gọi mỗi 2 giây (xếp hàng khi tìm nhiều bài). */
import { cleanLyrics, stripTimestamps } from "./clean";
import { SITE_URL } from "@/lib/site";

export type LrcResult = { id: number; trackName: string; artistName: string; albumName: string; duration: number; plainLyrics: string | null; syncedLyrics: string | null; instrumental?: boolean };
const API = "https://lrclib.net/api/search";
const GAP = 2000;
let chain: Promise<unknown> = Promise.resolve();
let last = 0;

/** Tìm (xếp hàng, tối thiểu 2 giây / lần). Lỗi mạng → ném lỗi có thông báo rõ ràng. */
export function searchLyrics(track: string, artist: string): Promise<LrcResult[]> {
  const run = async () => {
    const wait = Math.max(0, last + GAP - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const q = new URLSearchParams({ track_name: track.trim() });
    if (artist.trim()) q.set("artist_name", artist.trim());
    let res: Response;
    try { res = await fetch(`${API}?${q}`, { headers: { "Lrclib-Client": `Taylana (${SITE_URL})` } }); }
    catch { throw new Error("Lỗi mạng: không kết nối được LRCLIB. Bạn kiểm tra mạng rồi thử lại nhé."); }
    if (!res.ok) throw new Error(`LRCLIB đang bận (mã ${res.status}). Bạn thử lại sau ít phút nhé.`);
    const list = (await res.json()) as LrcResult[];
    return list.filter((r) => !r.instrumental && (r.plainLyrics || r.syncedLyrics));
  };
  const p = chain.then(run, run);
  chain = p.catch(() => null);
  return p;
}
/** Lời gợi ý của 1 kết quả: plainLyrics, không có thì syncedLyrics bỏ mốc thời gian → dọn lời */
export const lyricsOf = (r: LrcResult) => cleanLyrics(r.plainLyrics?.trim() ? r.plainLyrics : stripTimestamps(r.syncedLyrics ?? ""));
export const fmtDuration = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
export const parseDuration = (d: string) => { const m = d.trim().match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };

/** so khớp không phân biệt hoa thường, dấu, ký tự đặc biệt */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
/** kết quả khớp nhất theo tên bài, ca sĩ và thời lượng (nếu có) */
export function bestMatch(list: LrcResult[], title: string, artist: string, duration: string) {
  const t = norm(title), a = norm(artist), d = parseDuration(duration);
  let best: LrcResult | null = null, bs = -1;
  for (const r of list) {
    const rt = norm(r.trackName), ra = norm(r.artistName);
    let s = rt === t ? 4 : rt.includes(t) || t.includes(rt) ? 2 : 0;
    if (a) s += ra === a ? 3 : ra.includes(a) || a.includes(ra) ? 1.5 : 0;
    if (d && r.duration) { const diff = Math.abs(r.duration - d); s += diff <= 3 ? 2 : diff <= 10 ? 1 : 0; }
    if (r.plainLyrics) s += 0.5;
    if (s > bs) { bs = s; best = r; }
  }
  return bs >= 2 ? best : null;
}
