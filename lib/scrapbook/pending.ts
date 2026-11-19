"use client";
import { uploadFile } from "@/lib/storage/client";
/* "Đặt in CD này": file in mặt đĩa được giữ trong IndexedDB (trên máy khách) cho tới khi đơn được tạo,
   rồi tự tải lên Storage + gắn vào đơn (giống Gửi file). Ảnh khách KHÔNG lên server trước bước này. */
import { getBlob, putBlob } from "@/lib/blobStore";
import { createClient } from "@/lib/supabase/client";

const KEY = "scrapbook-pending-disc", META = "scrapbook-pending-meta";
const TTL = 24 * 3600 * 1000;

export async function savePendingDisc(png: Blob) {
  await putBlob(KEY, png);
  await putBlob(META, new Blob([JSON.stringify({ at: Date.now() })], { type: "application/json" }));
}
export async function hasPendingDisc() {
  try {
    const m = await getBlob(META);
    if (!m) return false;
    const { at } = JSON.parse(await m.text()) as { at?: number };
    return !!at && Date.now() - at < TTL;
  } catch { return false; }
}
/** Gọi ngay sau khi tạo đơn thành công. Lỗi thì bỏ qua (khách vẫn gửi file sau được). */
export async function attachPendingDisc(orderId: string) {
  try {
    if (!(await hasPendingDisc())) return false;
    const blob = await getBlob(KEY);
    if (!blob) return false;
    const sb = createClient();
    const path = (await uploadFile("order", blob, { folder: orderId, contentType: "image/png" })).path;
    const reg = await sb.rpc("register_order_file", {
      p_order_id: orderId, p_kind: "disc", p_storage_path: path, p_file_name: "mat-dia-cd-template.png",
      p_mime_type: "image/png", p_size_bytes: blob.size, p_page: null, p_width_px: 1417, p_height_px: 1417,
    });
    if (reg.error) return false;
    await putBlob(META, new Blob(["{}"], { type: "application/json" })); // dùng 1 lần
    return true;
  } catch { return false; }
}
