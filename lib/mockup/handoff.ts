"use client";

// Chuyển ảnh đang có (Trình chỉnh CD / Gửi file CD) sang trang Xem Mockup qua IndexedDB trong trình duyệt — không upload.
import { getBlob, putBlob } from "@/lib/blobStore";

const KEY = "mockup-handoff";
export type Handoff = { packageId: string | null; files: Record<string, File> }; // key = id ô: f1..f12, b1, b2, d

export async function saveHandoff(packageId: string | null, files: Record<string, Blob & { name?: string }>) {
  const ids: Record<string, string> = {};
  for (const [slot, blob] of Object.entries(files)) {
    const id = `${KEY}-${slot}`;
    await putBlob(id, blob);
    ids[slot] = id;
    ids[`${slot}#name`] = (blob as File).name ?? `${slot}.png`;
  }
  await putBlob(KEY, new Blob([JSON.stringify({ packageId, ids, at: Date.now() })], { type: "application/json" }));
}

export async function takeHandoff(): Promise<Handoff | null> {
  try {
    const meta = await getBlob(KEY);
    if (!meta) return null;
    const { packageId, ids, at } = JSON.parse(await meta.text()) as { packageId: string | null; ids: Record<string, string>; at: number };
    if (Date.now() - at > 6 * 3600 * 1000) return null; // cũ hơn 6 giờ thì bỏ
    const files: Record<string, File> = {};
    for (const [slot, id] of Object.entries(ids)) {
      if (slot.includes("#")) continue;
      const b = await getBlob(id);
      if (b) files[slot] = new File([b], ids[`${slot}#name`] ?? `${slot}.png`, { type: b.type || "image/png" });
    }
    await putBlob(KEY, new Blob(["{}"])); // dùng 1 lần
    return { packageId, files };
  } catch { return null; }
}

// Ánh xạ trang của trình chỉnh CD → ô ảnh: front/booklet trang n → f{n}, back trang n → b{n}, disc → d
export const slotOfDesign = (kind: string, page: number | null) =>
  kind === "disc" ? "d" : kind === "back" ? `b${page ?? 1}` : `f${page ?? 1}`;
