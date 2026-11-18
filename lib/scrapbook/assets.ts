"use client";
/* Tải ảnh chất liệu (qua /api/img-proxy để canvas xuất được file) — 1 lần, dùng chung */
import { loadImg } from "@/lib/mockup/images";
import type { ScrapAsset } from "./types";

const cache = new Map<string, Promise<HTMLImageElement | null>>();
export async function loadAssetImages(assets: ScrapAsset[]) {
  const out: Record<string, { img: HTMLImageElement; asset: ScrapAsset }> = {};
  await Promise.all(assets.map(async (a) => {
    let p = cache.get(a.url);
    if (!p) { p = loadImg(a.url).catch(() => null); cache.set(a.url, p); }
    const img = await p;
    if (img) out[a.id] = { img, asset: a };
  }));
  return out;
}
