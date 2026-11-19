"use client";
/* Thư viện mẫu — phía trình duyệt: tải danh mục / mẫu / bộ booklet, dựng ảnh thu nhỏ bằng ảnh thử rồi tải lên kho công khai
   (thư mục scrapbook/thumbs — R2 nếu đã chuyển), tìm / tạo danh mục "Cơ bản". */
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/storage/client";
import { renderSurface, type RenderOpts } from "./render";
import { TPL_COLS, type Bundle, type Category, type CategoryScope, type DesignTpl, type TplKind } from "./library";
import type { Template } from "./types";

export const MIGRATE_MSG = "Chưa có bảng mẫu mới — cần chạy supabase/migration_design_library.sql.";
export const isMissing = (m?: string) => !!m && /template_categories|booklet_bundles|kind|category_id|config|photo_count|schema cache|does not exist/i.test(m);

export async function loadCategories(scope: CategoryScope) {
  const { data, error } = await createClient().from("template_categories").select("*").eq("scope", scope).order("sort_order").order("name");
  if (error) throw new Error(isMissing(error.message) ? MIGRATE_MSG : error.message);
  return (data ?? []) as Category[];
}
export async function loadTemplates(kinds: TplKind[]) {
  const { data, error } = await createClient().from("design_templates").select(TPL_COLS).in("kind", kinds).order("sort_order").order("created_at");
  if (error) throw new Error(isMissing(error.message) ? MIGRATE_MSG : error.message);
  return (data ?? []) as unknown as DesignTpl[];
}
export async function loadBundles() {
  const { data, error } = await createClient().from("booklet_bundles").select("*").order("sort_order").order("created_at");
  if (error) throw new Error(isMissing(error.message) ? MIGRATE_MSG : error.message);
  return (data ?? []) as Bundle[];
}
/** danh mục "Cơ bản" của 1 phạm vi (tạo nếu chưa có) */
export async function basicCategory(scope: CategoryScope) {
  const sb = createClient();
  const { data } = await sb.from("template_categories").select("id").eq("scope", scope).eq("name", "Cơ bản").maybeSingle();
  if (data?.id) return data.id as string;
  const r = await sb.from("template_categories").insert({ scope, name: "Cơ bản", sort_order: 0 }).select("id").single();
  if (r.error) throw new Error(isMissing(r.error.message) ? MIGRATE_MSG : r.error.message);
  return r.data.id as string;
}
/** ảnh thu nhỏ JPEG (cạnh dài ~480px) của 1 hoặc nhiều bề mặt ghép ngang, tải lên kho công khai → link */
export async function uploadThumb(surfaces: Template[], ro: Omit<RenderOpts, "template" | "size">, px = 480) {
  const list = surfaces.filter(Boolean);
  if (!list.length) return null;
  const parts = list.map((t) => renderSurface({ template: t, ...ro, size: t.surface === "spread" ? px : Math.round(px / (list.length > 1 ? 2 : 1)) }).canvas);
  const W = parts.reduce((s, c) => s + c.width, 0) + (parts.length - 1) * 6, H = Math.max(...parts.map((c) => c.height));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!; x.fillStyle = "#f4f4f5"; x.fillRect(0, 0, W, H);
  let ox = 0; for (const p of parts) { x.drawImage(p, ox, (H - p.height) / 2); ox += p.width + 6; }
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.86));
  if (!blob) return null;
  return (await uploadFile("scrapbook", blob, { folder: "thumbs", contentType: "image/jpeg" })).url;
}
