"use client";
import { uploadFile } from "@/lib/storage/client";
/* File thiết kế chờ gắn vào đơn (dùng chung: Booklet Lyrics…): giữ trong IndexedDB trên máy khách cho tới khi đơn được tạo,
   rồi tải lên bucket order-files + register_order_file (giống Gửi file). Ảnh khách KHÔNG lên server trước bước này. */
import { getBlob, putBlob } from "@/lib/blobStore";
import { createClient } from "@/lib/supabase/client";

const META = "pending-order-files";
const TTL = 24 * 3600 * 1000;
export type PendingFile = { kind: "booklet" | "back" | "disc" | "front"; page: number | null; name: string; blob: Blob; w: number; h: number };

export async function savePendingFiles(files: PendingFile[]) {
  const list = [];
  for (const [i, f] of files.entries()) { const id = `${META}-${i}`; await putBlob(id, f.blob); list.push({ id, kind: f.kind, page: f.page, name: f.name, w: f.w, h: f.h }); }
  await putBlob(META, new Blob([JSON.stringify({ at: Date.now(), list })], { type: "application/json" }));
}
/** Gọi ngay sau khi tạo đơn. Lỗi thì bỏ qua (khách vẫn gửi file sau được). */
export async function attachPendingFiles(orderId: string) {
  try {
    const m = await getBlob(META);
    if (!m) return 0;
    const { at, list } = JSON.parse(await m.text()) as { at?: number; list?: { id: string; kind: string; page: number | null; name: string; w: number; h: number }[] };
    if (!at || !list?.length || Date.now() - at > TTL) return 0;
    await putBlob(META, new Blob(["{}"], { type: "application/json" })); // dùng 1 lần
    const sb = createClient();
    let n = 0;
    for (const f of list) {
      const blob = await getBlob(f.id);
      if (!blob) continue;
      const path = await uploadFile("order", blob, { folder: orderId, contentType: blob.type === "image/png" ? "image/png" : "image/jpeg" }).then((r) => r.path).catch(() => null);
      if (!path) continue;
      const reg = await sb.rpc("register_order_file", {
        p_order_id: orderId, p_kind: f.kind, p_storage_path: path, p_file_name: f.name,
        p_mime_type: blob.type || "image/jpeg", p_size_bytes: blob.size, p_page: f.page, p_width_px: f.w, p_height_px: f.h,
      });
      if (!reg.error) n++;
    }
    return n;
  } catch { return 0; }
}
