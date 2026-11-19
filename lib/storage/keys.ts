/* Khoá file (dùng chung server + trình duyệt). Khoá = "<thư mục gốc cũ>/<đường dẫn cũ>", giữ nguyên cấu trúc của Supabase Storage:
   công khai (bucket R2 taylana-public): scrapbook/… · mockups/… · public-assets/…
   riêng tư (bucket R2 taylana-private): order-files/<id đơn>/… · design-assets/<user_id>/… · mockup-shares/<id link>/…
   Database vẫn lưu như cũ: file công khai = link đầy đủ, file riêng tư = đường dẫn trong thư mục gốc (không kèm tên thư mục gốc). */
export const PUBLIC_ROOTS = ["scrapbook", "mockups", "public-assets"] as const;
export const PRIVATE_ROOTS = ["order-files", "design-assets", "mockup-shares"] as const;
export type Root = (typeof PUBLIC_ROOTS)[number] | (typeof PRIVATE_ROOTS)[number];

export const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
export const rootOf = (key: string) => key.split("/")[0] as Root;
export const isPublicKey = (key: string) => (PUBLIC_ROOTS as readonly string[]).includes(rootOf(key));
export const isValidKey = (key: string) => /^[A-Za-z0-9][A-Za-z0-9._\-/]{2,400}$/.test(key) && !key.includes("..") && !key.includes("//") && [...PUBLIC_ROOTS, ...PRIVATE_ROOTS].includes(rootOf(key) as never);
/** khoá của file riêng tư từ đường dẫn đang lưu trong database */
export const privateKey = (root: (typeof PRIVATE_ROOTS)[number], path: string) => `${root}/${path}`;

/** link công khai (R2 hoặc Supabase Storage cũ) → khoá; không phải file của tiệm → null */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let k: string | null = null;
  if (R2_PUBLIC_URL && url.startsWith(`${R2_PUBLIC_URL}/`)) k = url.slice(R2_PUBLIC_URL.length + 1);
  else { const i = url.indexOf("/storage/v1/object/public/"); if (i >= 0) k = url.slice(i + "/storage/v1/object/public/".length); }
  if (!k) return null;
  try { k = decodeURIComponent(k.split("?")[0]); } catch { return null; }
  return isValidKey(k) ? k : null;
}
/** link ảnh có đọc thẳng được trên canvas (CORS đã bật) — không cần qua /api/img-proxy */
export function isStorageUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".supabase.co")) return true;
    return !!R2_PUBLIC_URL && u.origin === new URL(R2_PUBLIC_URL).origin;
  } catch { return false; }
}
