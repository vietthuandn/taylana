"use client";
/* Nhóm chất liệu (asset_groups) phía trình duyệt admin + ảnh thu nhỏ ~160px (WebP giữ alpha) cho danh sách. */
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/storage/client";
import { fold, slugify, typeName } from "./assetGroups";
import type { AssetGroupRow } from "./types";

export const GROUP_MIGRATE = "Chưa có bảng nhóm chất liệu — cần chạy supabase/migration_asset_groups.sql.";
export async function loadGroups() {
  const { data, error } = await createClient().from("asset_groups").select("*").order("sort_order").order("name");
  if (error) throw new Error(GROUP_MIGRATE);
  return (data ?? []) as AssetGroupRow[];
}
/** tìm nhóm theo tên (không phân biệt hoa thường / dấu) hoặc tạo mới */
export async function ensureGroup(name: string, groups: AssetGroupRow[]): Promise<AssetGroupRow> {
  const n = name.trim().replace(/\s+/g, " ");
  const hit = groups.find((g) => fold(g.name) === fold(n));
  if (hit) return hit;
  const sb = createClient();
  const slug = slugify(n);
  const r = await sb.from("asset_groups").insert({ name: n, slug, sort_order: groups.length + 1 }).select("*").single();
  if (!r.error && r.data) return r.data as AssetGroupRow;
  const again = await sb.from("asset_groups").select("*").eq("slug", slug).maybeSingle(); // trùng slug → dùng nhóm đó
  if (again.data) return again.data as AssetGroupRow;
  throw new Error(r.error?.message.includes("asset_groups") ? GROUP_MIGRATE : r.error?.message ?? "Không tạo được nhóm");
}
/** nhóm mặc định khi để trống = tên Loại */
export const typeGroup = (type: string, groups: AssetGroupRow[]) => ensureGroup(typeName(type), groups);

/** ảnh thu nhỏ (cạnh dài 160px, WebP có alpha) → tải lên kho công khai, trả link */
export async function uploadAssetThumb(src: CanvasImageSource & { width: number; height: number }) {
  const k = Math.min(1, 160 / Math.max(src.width, src.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp") return null; // trình duyệt không xuất được WebP → dùng ảnh gốc
  return (await uploadFile("scrapbook", blob, { folder: "thumbs", contentType: "image/webp" })).url;
}
