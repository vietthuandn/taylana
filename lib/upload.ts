"use client";
/* Tải ảnh công khai lên kho lưu trữ (Cloudflare R2 — lib/storage): xin link rồi PUT thẳng từ trình duyệt, trả về link ảnh công khai. */
import { deleteFiles, uploadFile, type UploadScope } from "./storage/client";
import { keyFromUrl } from "./storage/keys";

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

async function put(scope: UploadScope, file: Blob, folder: string, contentType?: string) {
  const r = await uploadFile(scope, file, { folder, contentType }).catch((e) => { throw new Error("Tải ảnh thất bại: " + (e instanceof Error ? e.message : "")); });
  if (!r.url) throw new Error("Tải ảnh thất bại");
  return r.url;
}

// Ảnh công khai (thư mục gốc "public-assets"), trả về link ảnh.
export async function uploadPublicImage(file: File, folder: string, maxMB = 15, allowSvg = false) {
  if (!IMAGE_TYPES.includes(file.type) && !(allowSvg && file.type === SVG)) throw new Error(allowSvg ? "Chỉ nhận ảnh PNG, SVG, JPG hoặc WEBP" : "Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF");
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Ảnh tối đa ${maxMB}MB`);
  return put("public-assets", file, folder);
}

// Đường dẫn trong "public-assets" từ link công khai (R2 hoặc Supabase cũ)
export function publicPathFromUrl(url: string | null | undefined) {
  const k = keyFromUrl(url);
  return k?.startsWith("public-assets/") ? k.slice("public-assets/".length) : null;
}
export async function removePublicImage(url: string | null | undefined) {
  if (keyFromUrl(url)) await deleteFiles({ urls: [url] }).catch(() => 0);
}

// Ảnh khung / mặt nạ mockup → "mockups/<folder>" (admin / nhà thiết kế)
export async function uploadMockupImage(file: File, folder = "frames") {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Chỉ nhận ảnh PNG, JPG hoặc WEBP");
  if (file.size > 15 * 1024 * 1024) throw new Error("Ảnh tối đa 15MB");
  return put("mockups", file, folder);
}

// Mô hình 3D hộp CD (.glb) → "mockups/models"
export async function uploadMockupModel(file: File) {
  if (!/\.glb$/i.test(file.name)) throw new Error("Chỉ nhận file .glb");
  if (file.size > 30 * 1024 * 1024) throw new Error("File tối đa 30MB");
  return put("mockups", file, "models", "model/gltf-binary").catch((e) => { throw new Error(String(e instanceof Error ? e.message : e).replace("Tải ảnh", "Tải mô hình")); });
}

// Quản lý chất liệu (PNG trong suốt…) → "scrapbook/<folder>"
export async function uploadScrapbookAsset(file: Blob & { type: string }, folder = "assets") {
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new Error("Chỉ nhận PNG, JPG, WEBP hoặc SVG");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh tối đa 10MB");
  return put("scrapbook", file, folder);
}

// Ảnh xem trước / icon nút Template Canva → "mockups/canva" (icon nhận cả SVG)
export async function uploadCanvaImage(file: File) {
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new Error("Chỉ nhận ảnh PNG, JPG, WEBP hoặc SVG");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh tối đa 10MB");
  return put("mockups", file, "canva");
}
