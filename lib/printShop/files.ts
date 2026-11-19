"use client";
/* Ảnh của phiên in: CHỈ lưu trên máy (IndexedDB "taylana-ban-in"), không tải lên server. Khoá = "<phiên>/<đơn>/<ô>". */
const DB = "taylana-ban-in", STORE = "files";
export type StoredFile = { key: string; batch: string; blob: Blob; name: string; at: number };
let dbp: Promise<IDBDatabase> | null = null;
function open() {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: "key" }); s.createIndex("batch", "batch"); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void) => {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => res((req as IDBRequest<T> | undefined)?.result as T);
    t.onerror = () => rej(t.error);
  });
};
export const fileKey = (batch: string, order: string, slot: string) => `${batch}/${order}/${slot}`;
export const putFile = (f: StoredFile) => tx("readwrite", (s) => { s.put(f); });
export const getFile = (key: string) => tx<StoredFile | undefined>("readonly", (s) => s.get(key));
export const delFile = (key: string) => tx("readwrite", (s) => { s.delete(key); });
export async function batchFiles(batch: string): Promise<StoredFile[]> {
  return tx<StoredFile[]>("readonly", (s) => s.index("batch").getAll(batch)) ?? [];
}
export async function deleteBatchFiles(batch: string) {
  const list = await batchFiles(batch);
  await tx("readwrite", (s) => { for (const f of list) s.delete(f.key); });
  return list.length;
}
/** phiên "Đã xong" quá 7 ngày → xoá ảnh trên máy */
export async function cleanupOld(batches: { id: string; status: string; finished_at: string | null }[]) {
  const old = batches.filter((b) => b.status === "done" && b.finished_at && Date.now() - new Date(b.finished_at).getTime() > 7 * 864e5);
  let n = 0;
  for (const b of old) n += await deleteBatchFiles(b.id).catch(() => 0);
  return n;
}
