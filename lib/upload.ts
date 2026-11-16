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
