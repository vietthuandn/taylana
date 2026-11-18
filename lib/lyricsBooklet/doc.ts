"use client";
/* Bản nháp Booklet Lyrics (IndexedDB) + lưu vào "Thiết kế của tôi" (bảng designs, ảnh lên bucket riêng tư design-assets/<user_id>/). */
import { getBlob, putBlob } from "@/lib/blobStore";
import { createClient } from "@/lib/supabase/client";
import type { Adjust, Album, BackId, LayoutId, LyricsFormat, Song } from "./types";

export type LyricsDoc = {
  v: 1; kind: "lyrics-booklet";
  album: Album; songs: Song[]; pack: number; layout: LayoutId; back: BackId; paletteId: string; fmt?: LyricsFormat;
  seeds: Partial<Record<LayoutId, number>>; adjust: Record<string, Adjust>; photoIds: string[]; backPhotoId: string | null;
  photoPaths?: Record<string, string>; // khi lưu lên tài khoản: id ảnh → đường dẫn trong design-assets
};
export type DocPhoto = { id: string; blob: Blob };
const META = "lyrics-booklet-draft";

export async function saveLocal(doc: LyricsDoc, photos: DocPhoto[]) {
  for (const p of photos) await putBlob(`lyrics-photo-${p.id}`, p.blob);
  await putBlob(META, new Blob([JSON.stringify(doc)], { type: "application/json" }));
}
export async function loadLocal(): Promise<{ doc: LyricsDoc; photos: DocPhoto[] } | null> {
  try {
    const m = await getBlob(META);
    if (!m) return null;
    const doc = JSON.parse(await m.text()) as LyricsDoc;
    if (doc.kind !== "lyrics-booklet") return null;
    const ids = [...doc.photoIds, ...(doc.backPhotoId ? [doc.backPhotoId] : [])];
    const photos: DocPhoto[] = [];
    for (const id of ids) { const b = await getBlob(`lyrics-photo-${id}`); if (b) photos.push({ id, blob: b }); }
    return { doc, photos };
  } catch { return null; }
}

export async function saveToAccount(doc: LyricsDoc, photos: DocPhoto[], opts: { id: string | null; name: string; thumbnail: string | null }) {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Bạn cần đăng nhập để lưu thiết kế.");
  const paths: Record<string, string> = { ...(doc.photoPaths ?? {}) };
  for (const p of photos) {
    if (paths[p.id]) continue;
    const path = `${u.user.id}/lyrics-${p.id}.${p.blob.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await sb.storage.from("design-assets").upload(path, p.blob, { contentType: p.blob.type || "image/jpeg", upsert: true });
    if (error) throw new Error("Tải ảnh lên thất bại: " + error.message);
    paths[p.id] = path;
  }
  const row = { name: opts.name.trim() || "Booklet Lyrics", data: { ...doc, photoPaths: paths }, thumbnail: opts.thumbnail };
  if (opts.id) {
    const { error } = await sb.from("designs").update(row).eq("id", opts.id);
    if (error) throw new Error(error.message);
    return { id: opts.id, paths };
  }
  const { data, error } = await sb.from("designs").insert(row).select("id").single();
  if (error) throw new Error(error.code === "PGRST205" || error.code === "42P01" ? "Tiệm chưa bật tính năng lưu thiết kế (cần chạy migration)." : error.message);
  return { id: data.id as string, paths };
}
export async function loadFromAccount(id: string): Promise<{ doc: LyricsDoc; photos: DocPhoto[] } | null> {
  const sb = createClient();
  const { data } = await sb.from("designs").select("data").eq("id", id).maybeSingle();
  const doc = data?.data as LyricsDoc | undefined;
  if (!doc || doc.kind !== "lyrics-booklet") return null;
  const photos: DocPhoto[] = [];
  for (const [pid, path] of Object.entries(doc.photoPaths ?? {})) {
    const r = await sb.storage.from("design-assets").download(path);
    if (r.data) photos.push({ id: pid, blob: r.data });
  }
  return { doc, photos };
}
