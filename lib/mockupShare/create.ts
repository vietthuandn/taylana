"use client";
/* Tạo link chia sẻ mockup (admin, trên trình duyệt): nén ảnh (cạnh dài ≤ 2400px, JPG 0.88; PNG nếu có vùng trong suốt)
   → tải lên bucket riêng tư "mockup-shares/<id>/" → lưu 1 dòng mockup_shares (RLS: chỉ admin). */
import { createClient } from "@/lib/supabase/client";
import { deleteFiles, uploadFile } from "@/lib/storage/client";
import { SHARE_TTL_MS, newToken, type ShareBg, type ShareState } from "./types";

type Img = CanvasImageSource & { width: number; height: number };
function hasAlpha(c: HTMLCanvasElement) {
  const x = c.getContext("2d", { willReadFrequently: true })!, d = x.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
  return false;
}
async function encode(img: Img, max = 2400, forceJpg = false) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
  const png = !forceJpg && hasAlpha(c);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, png ? "image/png" : "image/jpeg", 0.88));
  if (!blob) throw new Error("Không nén được ảnh");
  return { blob, ext: png ? "png" : "jpg", type: png ? "image/png" : "image/jpeg" };
}
export type ShareInput = Omit<ShareState, "v" | "slots" | "bg" | "thumb"> & { images: Record<string, Img>; bg: { kind: "gradient"; id: string } | { kind: "shop"; url: string; name: string } | { kind: "file"; img: Img } };

export async function createShare(inp: ShareInput, onProgress: (done: number, total: number) => void) {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Cần đăng nhập admin để chia sẻ.");
  const id = crypto.randomUUID(), token = newToken();
  const entries = Object.entries(inp.images);
  const total = entries.length + (inp.bg.kind === "file" ? 1 : 0) + 2;
  let done = 0;
  const tick = () => onProgress(++done, total);
  const put = async (name: string, img: Img, max?: number, jpg?: boolean) => {
    const e = await encode(img, max, jpg);
    let path: string;
    try { path = (await uploadFile("share", e.blob, { folder: id, filename: `${name}.${e.ext}`, contentType: e.type })).path; }
    catch (x) { throw new Error("Tải ảnh lên thất bại: " + (x instanceof Error ? x.message : "")); }
    tick();
    return path;
  };
  onProgress(0, total);
  const slots: Record<string, string> = {};
  for (const [k, img] of entries) slots[k] = await put(k, img);
  const bg: ShareBg = inp.bg.kind === "file" ? { kind: "file", path: await put("bg", inp.bg.img, 2400, true) } : inp.bg;
  const first = inp.images.f1 ?? inp.images.d ?? Object.values(inp.images)[0];
  const thumb = first ? await put("thumb", first, 320, true) : undefined;
  if (!first) tick();
  const state: ShareState = { v: 1, pkgName: inp.pkgName, layout: inp.layout, box: inp.box, slots, bg, view: inp.view, booklet: inp.booklet, tray: inp.tray, finish: inp.finish, modelUrl: inp.modelUrl, thumb };
  const expires = new Date(Date.now() + SHARE_TTL_MS).toISOString();
  const { error } = await sb.from("mockup_shares").insert({ id, token, state, expires_at: expires });
  if (error) {
    await deleteFiles({ prefixes: [`mockup-shares/${id}/`] }).catch(() => 0);
    throw new Error(error.code === "42P01" || error.code === "PGRST205" ? "Chưa có bảng chia sẻ — cần chạy supabase/migration_mockup_shares.sql." : error.message);
  }
  tick();
  return { id, token, expires };
}
/** thu hồi ngay: xoá mọi file trong thư mục của link (Storage API) rồi xoá dòng dữ liệu */
export async function revokeShare(id: string) {
  const sb = createClient();
  await deleteFiles({ prefixes: [`mockup-shares/${id}/`] });
  const { error } = await sb.from("mockup_shares").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
