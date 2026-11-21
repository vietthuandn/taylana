"use client";
import { deleteFiles, downloadPrivate, uploadFile } from "@/lib/storage/client";
/* CD Template · Booklet Template · Back cover Template: lưu vào "Thiết kế của tôi" (bảng designs) — ảnh + sticker của khách
   + FILE IN đã dựng sẵn (prints) lên bucket riêng tư design-assets/<user_id>/ (chỉ khi khách đã đăng nhập và bấm "Lưu").
   Thiết kế lưu 24 giờ kể từ lần sửa gần nhất, tối đa 5 thiết kế / tài khoản. File in dùng để Tải / Đặt đơn ở "Thiết kế của tôi". */
import { createClient } from "@/lib/supabase/client";
import { assertDesignSlot, type PrintRef } from "@/lib/designs";
import type { Adjust, DiscText, Template } from "./types";

export type ScrapKind = "booklet-scrapbook" | "cd-scrapbook" | "back-scrapbook";
export type ScrapDesign = {
  v: 1; kind: ScrapKind; pages: number; faces?: number; showTitle: boolean; rightsOk: boolean; text: DiscText; adjust: Record<string, Adjust>;
  doc: Template[]; applied: string | null; photoIds: string[]; stickerIds: string[]; paths?: Record<string, string>; colors?: string[];
  prints?: PrintRef[];
};
export type PrintFile = Omit<PrintRef, "path"> & { blob: Blob };
export async function saveScrapToAccount(data: ScrapDesign, files: { id: string; blob: Blob }[], opts: { id: string | null; name: string; thumbnail: string | null }, printFiles: PrintFile[] = []) {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Bạn cần đăng nhập để lưu thiết kế.");
  if (!opts.id) await assertDesignSlot();
  const up = async (b: Blob) => {
    try { return (await uploadFile("design", b, { contentType: b.type === "image/png" ? "image/png" : "image/jpeg" })).path; }
    catch (e) { throw new Error("Tải ảnh lên thất bại: " + (e instanceof Error ? e.message : "")); }
  };
  const paths: Record<string, string> = { ...(data.paths ?? {}) };
  for (const f of files) if (!paths[f.id]) paths[f.id] = await up(f.blob);
  const prints: PrintRef[] = [];
  for (const p of printFiles) prints.push({ kind: p.kind, page: p.page, name: p.name, w: p.w, h: p.h, path: await up(p.blob) });
  const old = data.prints ?? [];
  const row = { name: opts.name.trim() || "Thiết kế", data: { ...data, paths, prints }, thumbnail: opts.thumbnail, updated_at: new Date().toISOString() };
  let id = opts.id;
  if (id) {
    const { error } = await sb.from("designs").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: r, error } = await sb.from("designs").insert(row).select("id").single();
    if (error) throw new Error(error.code === "PGRST205" || error.code === "42P01" ? "Tiệm chưa bật tính năng lưu thiết kế (cần chạy migration)." : error.message);
    id = r.id as string;
  }
  // file in của lần lưu trước → xoá (đã thay bằng bản mới)
  if (old.length) deleteFiles({ keys: old.map((p) => `design-assets/${p.path}`) }).catch(() => 0);
  return { id: id!, paths, prints };
}
export async function loadScrapFromAccount(id: string, kind: ScrapKind = "booklet-scrapbook"): Promise<{ data: ScrapDesign; blobs: Record<string, Blob> } | null> {
  const sb = createClient();
  const { data } = await sb.from("designs").select("data").eq("id", id).maybeSingle();
  const d = data?.data as ScrapDesign | undefined;
  if (!d || d.kind !== kind) return null;
  const blobs: Record<string, Blob> = {};
  for (const [fid, path] of Object.entries(d.paths ?? {})) { const b = await downloadPrivate(`design-assets/${path}`); if (b) blobs[fid] = b; }
  return { data: d, blobs };
}
