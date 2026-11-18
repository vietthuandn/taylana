"use client";
/* Bản nháp CD Scrapbook (IndexedDB trên máy khách): ảnh, thứ tự, mẫu, chữ, chỉnh ô — tải lại trang không mất. */
import { getBlob, putBlob } from "@/lib/blobStore";
import type { Adjust, DiscText, Style, Template } from "./types";

const META = "scrapbook-draft";
export type DraftPhoto = { id: string; name: string; blob: Blob };
export type DraftMeta = {
  ids: string[]; names: Record<string, string>; style: Style | null; text: DiscText; adjust: Record<string, Adjust>; seeds: Partial<Record<Style, number>>;
  work?: Template | null; edited?: boolean; // mẫu khách đã sửa tự do (lớp đã di chuyển / thêm sticker, chữ…)
};

export async function saveDraft(photos: DraftPhoto[], meta: Omit<DraftMeta, "ids" | "names">) {
  for (const p of photos) await putBlob(`scrapbook-photo-${p.id}`, p.blob);
  const m: DraftMeta = { ...meta, ids: photos.map((p) => p.id), names: Object.fromEntries(photos.map((p) => [p.id, p.name])) };
  await putBlob(META, new Blob([JSON.stringify(m)], { type: "application/json" }));
}
export async function loadDraft(): Promise<{ photos: DraftPhoto[]; meta: DraftMeta } | null> {
  try {
    const b = await getBlob(META);
    if (!b) return null;
    const meta = JSON.parse(await b.text()) as DraftMeta;
    if (!meta.ids?.length) return null;
    const photos: DraftPhoto[] = [];
    for (const id of meta.ids) { const blob = await getBlob(`scrapbook-photo-${id}`); if (blob) photos.push({ id, name: meta.names?.[id] ?? "anh.jpg", blob }); }
    return { photos, meta };
  } catch { return null; }
}
