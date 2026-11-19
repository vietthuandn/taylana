"use client";
import { createClient } from "./supabase/client";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const SVG = "image/svg+xml";

function extOf(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type.split("/")[1] ?? "bin";
}

export function randomName(file: File) {
  const id = crypto.randomUUID().slice(0, 8);
  return `${Date.now()}-${id}.${extOf(file)}`;
}

// Tải ảnh lên bucket công khai "public-assets", trả về link ảnh.
export async function uploadPublicImage(file: File, folder: string, maxMB = 15, allowSvg = false) {
  if (!IMAGE_TYPES.includes(file.type) && !(allowSvg && file.type === SVG)) throw new Error(allowSvg ? "Chỉ nhận ảnh PNG, SVG, JPG hoặc WEBP" : "Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF");
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Ảnh tối đa ${maxMB}MB`);
  const supabase = createClient();
  const path = `${folder}/${randomName(file)}`;
  const { error } = await supabase.storage
    .from("public-assets")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Tải ảnh thất bại: " + error.message);
  return supabase.storage.from("public-assets").getPublicUrl(path).data.publicUrl;
}

// Lấy đường dẫn trong bucket từ link công khai (để xoá file khi xoá mục)
export function publicPathFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/public-assets/";
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

export async function removePublicImage(url: string | null | undefined) {
  const path = publicPathFromUrl(url);
  if (path) await createClient().storage.from("public-assets").remove([path]);
}

// Tải ảnh khung / mặt nạ mockup lên bucket công khai "mockups" (chỉ admin)
export async function uploadMockupImage(file: File, folder = "frames") {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Chỉ nhận ảnh PNG, JPG hoặc WEBP");
  if (file.size > 15 * 1024 * 1024) throw new Error("Ảnh tối đa 15MB");
  const supabase = createClient();
  const path = `${folder}/${randomName(file)}`;
  const { error } = await supabase.storage.from("mockups").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (!error) return supabase.storage.from("mockups").getPublicUrl(path).data.publicUrl;
  // Chưa có bucket "mockups" (chưa chạy migration_mockups.sql) → lưu tạm vào bucket công khai "public-assets"
  if (/bucket not found/i.test(error.message)) {
    const alt = `mockups/${path}`;
    const r = await supabase.storage.from("public-assets").upload(alt, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (r.error) throw new Error("Tải ảnh thất bại: " + r.error.message);
    return supabase.storage.from("public-assets").getPublicUrl(alt).data.publicUrl;
  }
  throw new Error("Tải ảnh thất bại: " + error.message);
}

// Mô hình 3D hộp CD (.glb) → bucket "mockups/models" (chỉ admin)
export async function uploadMockupModel(file: File) {
  if (!/\.glb$/i.test(file.name)) throw new Error("Chỉ nhận file .glb");
  if (file.size > 30 * 1024 * 1024) throw new Error("File tối đa 30MB");
  const supabase = createClient();
  const path = `models/${randomName(file)}`;
  const { error } = await supabase.storage.from("mockups").upload(path, file, { contentType: "model/gltf-binary", cacheControl: "31536000", upsert: false });
  if (!error) return supabase.storage.from("mockups").getPublicUrl(path).data.publicUrl;
  throw new Error("Tải mô hình thất bại: " + error.message + (/mime|type/i.test(error.message) ? " (cần chạy supabase/migration_mockup_glb.sql)" : ""));
}

// Chất liệu CD Scrapbook (PNG trong suốt…) → bucket công khai "scrapbook" (chỉ admin)
export async function uploadScrapbookAsset(file: File) {
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new Error("Chỉ nhận PNG, JPG, WEBP hoặc SVG");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh tối đa 10MB");
  const supabase = createClient();
  const path = `assets/${randomName(file)}`;
  const { error } = await supabase.storage.from("scrapbook").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Tải ảnh thất bại: " + error.message + (/bucket not found/i.test(error.message) ? " (cần chạy supabase/migration_scrapbook.sql)" : ""));
  return supabase.storage.from("scrapbook").getPublicUrl(path).data.publicUrl;
}

// Ảnh xem trước / icon nút của Template Canva → bucket công khai "mockups/canva" (chỉ admin; icon nhận cả SVG)
export async function uploadCanvaImage(file: File) {
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new Error("Chỉ nhận ảnh PNG, JPG, WEBP hoặc SVG");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh tối đa 10MB");
  const supabase = createClient();
  const path = `canva/${randomName(file)}`;
  const { error } = await supabase.storage.from("mockups").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Tải ảnh thất bại: " + error.message + (/mime|type/i.test(error.message) ? " (cần chạy supabase/migration_canva_templates.sql)" : ""));
  return supabase.storage.from("mockups").getPublicUrl(path).data.publicUrl;
}
