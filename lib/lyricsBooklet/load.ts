import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { mergeSettings, type LyricsSettings } from "./types";

// Cài đặt Booklet Lyrics (site_settings "lyrics_booklet"); chưa có thì dùng mặc định
export async function getLyricsSettings(): Promise<LyricsSettings> {
  const sb = publicClient();
  if (!sb) return mergeSettings(null);
  const { data } = await sb.from("site_settings").select("value").eq("key", "lyrics_booklet").maybeSingle();
  return mergeSettings((data?.value as Partial<LyricsSettings>) ?? null);
}
