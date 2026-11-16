"use client";
// Lưu / mở thiết kế Custom CD của khách (bảng designs + bucket riêng tư design-assets/<user_id>/...)
import { createClient } from "./supabase/client";
import { srcToBlob } from "./blobStore";
import type { PageDoc } from "./cdDoc";
import type { SpineSide } from "@/components/designer/Spine";

export type DesignData = {
  v: 1;
  frontN: number;
  backN: number;
  spread: boolean;
  docs: Record<string, PageDoc>;
  zones: Record<string, SpineSide>;
  guides?: boolean; // trạng thái "Hiển thị guideline"
  pkg?: string; // gói đang chọn ("custom" = Tuỳ chỉnh)
};
export type DesignRow = { id: string; name: string; thumbnail: string | null; created_at: string; updated_at: string; data?: DesignData };

const uploaded = new Map<string, string>(); // idb:... → sb:...

// Tải các ảnh còn nằm trong máy (idb:) lên tài khoản, đổi src thành sb:<đường dẫn>
async function uploadImages(data: DesignData, userId: string): Promise<DesignData> {
  const sb = createClient();
  const conv = async (src?: string) => {
    if (!src || !src.startsWith("idb:")) return src;
    if (uploaded.has(src)) return uploaded.get(src)!;
    const blob = await srcToBlob(src);
    if (!blob) return src;
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : blob.type === "image/gif" ? "gif" : "jpg";
    const path = `${userId}/${src.slice(4)}.${ext}`;
    const { error } = await sb.storage.from("design-assets").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
    if (error) throw new Error("Tải ảnh lên thất bại: " + error.message);
    uploaded.set(src, `sb:${path}`);
    return `sb:${path}`;
  };
  const docs: Record<string, PageDoc> = {};
  for (const [k, d] of Object.entries(data.docs)) {
    const els = await Promise.all(d.els.map(async (e) => ({ ...e, src: await conv(e.src) })));
    const fills: PageDoc["fills"] = {};
    for (const [fk, f] of Object.entries(d.fills)) fills[fk] = { ...f, src: (await conv(f.src))! };
    docs[k] = { ...d, els, fills, bgImage: d.bgImage ? { src: (await conv(d.bgImage.src))! } : null };
  }
  return { ...data, docs };
}

export async function saveDesign(data: DesignData, opts: { id?: string | null; name: string; thumbnail: string | null }) {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Bạn cần đăng nhập để lưu thiết kế.");
  const clean = await uploadImages(data, u.user.id);
  const row = { name: opts.name.trim() || "Thiết kế không tên", data: clean, thumbnail: opts.thumbnail };
  if (opts.id) {
    const { error } = await sb.from("designs").update(row).eq("id", opts.id);
    if (error) throw new Error(error.message);
    return { id: opts.id, data: clean };
  }
  const { data: ins, error } = await sb.from("designs").insert(row).select("id").single();
  if (error) throw new Error(error.code === "PGRST205" || error.code === "42P01" ? "Tiệm chưa bật tính năng lưu thiết kế (cần chạy migration)." : error.message);
  return { id: ins.id as string, data: clean };
}

export async function listDesigns(): Promise<DesignRow[]> {
  const { data, error } = await createClient().from("designs").select("id, name, thumbnail, created_at, updated_at").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DesignRow[];
}
export async function loadDesign(id: string): Promise<DesignRow | null> {
  const { data } = await createClient().from("designs").select("*").eq("id", id).maybeSingle();
  return (data as DesignRow) ?? null;
}
export async function renameDesign(id: string, name: string) {
  const { error } = await createClient().from("designs").update({ name: name.trim() || "Thiết kế không tên" }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteDesign(id: string) {
  const { error } = await createClient().from("designs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
