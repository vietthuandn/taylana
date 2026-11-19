"use client";
import { downloadPrivate, uploadFile } from "@/lib/storage/client";
/* Booklet Scrapbook: lưu vào "Thiết kế của tôi" (bảng designs) — ảnh + sticker của khách lên bucket riêng tư design-assets/<user_id>/
   (chỉ khi khách đã đăng nhập và bấm "Lưu"). */
import { createClient } from "@/lib/supabase/client";
import type { Adjust, DiscText, Template } from "./types";

export type ScrapDesign = {
  v: 1; kind: "booklet-scrapbook"; pages: number; showTitle: boolean; rightsOk: boolean; text: DiscText; adjust: Record<string, Adjust>;
  doc: Template[]; applied: string | null; photoIds: string[]; stickerIds: string[]; paths?: Record<string, string>; colors?: string[];
};
export async function saveScrapToAccount(data: ScrapDesign, files: { id: string; blob: Blob }[], opts: { id: string | null; name: string; thumbnail: string | null }) {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Bạn cần đăng nhập để lưu thiết kế.");
  const paths: Record<string, string> = { ...(data.paths ?? {}) };
  for (const f of files) {
    if (paths[f.id]) continue;
    let path: string;
    try { path = (await uploadFile("design", f.blob, { contentType: f.blob.type === "image/png" ? "image/png" : "image/jpeg" })).path; }
    catch (e) { throw new Error("Tải ảnh lên thất bại: " + (e instanceof Error ? e.message : "")); }
    paths[f.id] = path;
  }
  const row = { name: opts.name.trim() || "Booklet Scrapbook", data: { ...data, paths }, thumbnail: opts.thumbnail };
  if (opts.id) {
    const { error } = await sb.from("designs").update(row).eq("id", opts.id);
    if (error) throw new Error(error.message);
    return { id: opts.id, paths };
  }
  const { data: r, error } = await sb.from("designs").insert(row).select("id").single();
  if (error) throw new Error(error.code === "PGRST205" || error.code === "42P01" ? "Tiệm chưa bật tính năng lưu thiết kế (cần chạy migration)." : error.message);
  return { id: r.id as string, paths };
}
export async function loadScrapFromAccount(id: string): Promise<{ data: ScrapDesign; blobs: Record<string, Blob> } | null> {
  const sb = createClient();
  const { data } = await sb.from("designs").select("data").eq("id", id).maybeSingle();
  const d = data?.data as ScrapDesign | undefined;
  if (!d || d.kind !== "booklet-scrapbook") return null;
  const blobs: Record<string, Blob> = {};
  for (const [fid, path] of Object.entries(d.paths ?? {})) { const b = await downloadPrivate(`design-assets/${path}`); if (b) blobs[fid] = b; }
  return { data: d, blobs };
}
