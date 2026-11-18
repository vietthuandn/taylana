"use client";

// Tải ảnh dùng được trên canvas (không bị "tainted"). Ảnh link ngoài → qua /api/img-proxy (chỉ link admin đã lưu).
const cache = new Map<string, Promise<HTMLImageElement>>();

export function proxied(url: string) {
  if (!url || url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/")) return url;
  try {
    const u = new URL(url);
    if (u.origin === location.origin || u.hostname.endsWith(".supabase.co")) return url; // Supabase Storage có CORS
  } catch { return url; }
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

export function loadImg(url: string): Promise<HTMLImageElement> {
  const key = proxied(url);
  let p = cache.get(key);
  if (!p) {
    p = new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.decoding = "async";
      im.onload = () => res(im);
      im.onerror = () => { cache.delete(key); rej(new Error("Không tải được ảnh")); };
      im.src = key;
    });
    cache.set(key, p);
  }
  return p;
}
