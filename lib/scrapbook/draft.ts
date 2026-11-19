"use client";
/* Bản nháp scrapbook (IndexedDB trên máy khách): ảnh, sticker khách tải, thiết kế (các bề mặt), chữ, chỉnh ô — tải lại trang không mất.
   prefix: "scrapbook" (CD Template) · "bscrap" (Booklet Template). */
import { getBlob, putBlob } from "@/lib/blobStore";
import type { Adjust, DiscText, Style, Template } from "./types";

export type DraftPhoto = { id: string; name: string; blob: Blob };
export type DraftMeta = {
  ids: string[]; names: Record<string, string>; text: DiscText; adjust: Record<string, Adjust>;
  doc?: Template[] | null; edited?: boolean; applied?: string | null; // thiết kế của khách (bản chép từ mẫu, độc lập với mẫu)
  stickers?: string[]; // sticker khách tự tải (id)
  pages?: number; showTitle?: boolean; rightsOk?: boolean; // Booklet Template
  colors?: string[]; // màu riêng khách đã chọn (dòng "Đã dùng" trong Cài đặt chữ), mới nhất ở đầu
  style?: Style | null; seeds?: Partial<Record<Style, number>>; work?: Template | null; // (bản nháp cũ của CD Template)
};
export type DraftSticker = { id: string; blob: Blob };

export async function saveDraft(prefix: string, photos: DraftPhoto[], meta: Omit<DraftMeta, "ids" | "names">, stickers: DraftSticker[] = []) {
  for (const p of photos) await putBlob(`${prefix}-photo-${p.id}`, p.blob);
  for (const s of stickers) await putBlob(`${prefix}-usticker-${s.id}`, s.blob);
  const m: DraftMeta = { ...meta, stickers: stickers.map((s) => s.id), ids: photos.map((p) => p.id), names: Object.fromEntries(photos.map((p) => [p.id, p.name])) };
  await putBlob(`${prefix}-draft`, new Blob([JSON.stringify(m)], { type: "application/json" }));
}
export async function loadDraft(prefix: string): Promise<{ photos: DraftPhoto[]; meta: DraftMeta; stickers: DraftSticker[] } | null> {
  try {
    const b = await getBlob(`${prefix}-draft`);
    if (!b) return null;
    const meta = JSON.parse(await b.text()) as DraftMeta;
    const photos: DraftPhoto[] = [], stickers: DraftSticker[] = [];
    for (const id of meta.ids ?? []) { const blob = await getBlob(`${prefix}-photo-${id}`); if (blob) photos.push({ id, name: meta.names?.[id] ?? "anh.jpg", blob }); }
    for (const id of meta.stickers ?? []) { const blob = await getBlob(`${prefix}-usticker-${id}`); if (blob) stickers.push({ id, blob }); }
    return { photos, meta, stickers };
  } catch { return null; }
}
