"use client";
/* Kho ảnh cục bộ (IndexedDB) cho bản nháp — localStorage quá nhỏ để chứa ảnh.
   Ảnh khách tải lên có src dạng "idb:<id>"; ảnh đã lưu lên tài khoản: "sb:<đường dẫn trong bucket design-assets>". */
import { readUrls } from "./storage/client";

const DB = "taylana-cd", STORE = "blobs";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function putBlob(id: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function getBlob(id: string): Promise<Blob | null> {
  const db = await open();
  return new Promise((res) => {
    const r = db.transaction(STORE).objectStore(STORE).get(id);
    r.onsuccess = () => res((r.result as Blob) ?? null);
    r.onerror = () => res(null);
  });
}

// Lưu file ảnh khách vào kho cục bộ → trả về src "idb:..."
export async function storeLocalImage(file: Blob) {
  const id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  await putBlob(id, file);
  return `idb:${id}`;
}

// Đổi src lưu trữ thành URL dùng được trong trình duyệt (có cache)
const cache = new Map<string, Promise<string | null>>();
export function resolveSrc(src: string): Promise<string | null> {
  if (!src.startsWith("idb:") && !src.startsWith("sb:")) return Promise.resolve(src);
  if (!cache.has(src)) {
    cache.set(src, (async () => {
      if (src.startsWith("idb:")) {
        const b = await getBlob(src.slice(4));
        return b ? URL.createObjectURL(b) : null;
      }
      const k = `design-assets/${src.slice(3)}`;
      const u = (await readUrls([k]).catch(() => ({} as Record<string, string>)))[k] ?? null;
      if (!u) cache.delete(src);
      else setTimeout(() => cache.delete(src), 50 * 60 * 1000); // link đọc hạn 1 giờ
      return u;
    })());
  }
  return cache.get(src)!;
}

// Lấy blob của 1 src (để tải lên tài khoản)
export async function srcToBlob(src: string): Promise<Blob | null> {
  if (src.startsWith("idb:")) return getBlob(src.slice(4));
  const url = await resolveSrc(src);
  if (!url) return null;
  const r = await fetch(url);
  return r.ok ? r.blob() : null;
}
