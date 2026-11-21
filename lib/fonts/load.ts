/* Tải font Google KHI CẦN (không tải sẵn tất cả):
   · xem trước tên font trong dropdown: CSS API kèm text=<tên font> (chỉ đúng các chữ cái của tên), đổi tên họ font thành "__p <tên>"
     để không đè lên bản đầy đủ · bản đầy đủ khi chọn / khi thiết kế đang dùng: subset latin + vietnamese (Google tự chia theo
     unicode-range), display=swap, chờ document.fonts.load() xong. Trình duyệt tự cache file font.
   · danh sách font đang bật: site_settings.google_fonts (Admin → Quản lý chất liệu → Font chữ). */
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { FONT_CATALOG, fontInfo, type GFont } from "./catalog";

export type FontSettings = { order?: string[]; off?: string[]; extra?: GFont[] };
let ALL: GFont[] = FONT_CATALOG; // mọi font biết (catalog + admin thêm) — để tải được cả font đã tắt mà thiết kế cũ đang dùng
let ENABLED: GFont[] = FONT_CATALOG;
let listP: Promise<GFont[]> | null = null;

/** áp cài đặt admin: thứ tự, tắt, font thêm */
export function applyFontSettings(v: FontSettings | null | undefined) {
  const extra = (v?.extra ?? []).filter((f) => f && f.family && !FONT_CATALOG.some((c) => c.family === f.family));
  ALL = [...FONT_CATALOG, ...extra];
  const order = v?.order ?? [], off = new Set(v?.off ?? []);
  const rank = (f: GFont) => { const i = order.indexOf(f.family); return i < 0 ? 1000 + ALL.indexOf(f) : i; };
  ENABLED = [...ALL].sort((a, b) => rank(a) - rank(b)).filter((f) => !off.has(f.family));
  return { all: ALL, enabled: ENABLED };
}
/** font đang bật (khách chỉ thấy các font này) */
export function loadFontList(): Promise<GFont[]> {
  if (!listP) listP = (async () => {
    if (!hasSupabase) return ENABLED;
    const { data } = await createClient().from("site_settings").select("value").eq("key", "google_fonts").maybeSingle();
    return applyFontSettings(data?.value as FontSettings | null).enabled;
  })().catch(() => ENABLED);
  return listP;
}
export const knownFont = (family?: string | null) => fontInfo(family, ALL);

const fam = (f: string) => encodeURIComponent(f).replace(/%20/g, "+");
export function fullCssUrl(f: GFont) {
  const ws = f.weights.length ? f.weights : [400];
  const axis = f.italic ? `ital,wght@${[...ws.map((w) => `0,${w}`), ...ws.map((w) => `1,${w}`)].join(";")}` : `wght@${ws.join(";")}`;
  return `https://fonts.googleapis.com/css2?family=${fam(f.family)}:${axis}&display=swap`;
}
const links = new Map<string, Promise<void>>();
function addLink(href: string) {
  let p = links.get(href);
  if (!p) {
    p = new Promise<void>((res) => {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href;
      l.onload = () => res(); l.onerror = () => res();
      document.head.appendChild(l);
    });
    links.set(href, p);
  }
  return p;
}
/** tải bản đầy đủ 1 font (độ đậm + kiểu nghiêng đang dùng) rồi chờ trình duyệt sẵn sàng vẽ */
export async function loadFont(family: string, weight = 400, italic = false) {
  if (typeof document === "undefined" || !document.fonts) return;
  const f = knownFont(family);
  if (f) await addLink(fullCssUrl(f));
  await document.fonts.load(`${italic ? "italic " : ""}${weight} 32px "${family}"`, "Aăâđêôơưẩ").catch(() => null);
}
/** chờ mọi font của các lớp chữ (họ font · độ đậm · nghiêng) — gọi trước khi xuất file in / PNG */
export async function ensureLayerFonts(layers: { k: string; family?: string; weight?: number; bold?: boolean; italic?: boolean }[]) {
  const need = new Map<string, [string, number, boolean]>();
  for (const l of layers) if ((l.k === "text" || l.k === "wish") && l.family) {
    const w = l.weight ?? (l.bold ? 700 : 400), it = !!l.italic;
    need.set(`${l.family}|${w}|${it}`, [l.family, w, it]);
  }
  await Promise.all([...need.values()].map(([f, w, it]) => loadFont(f, w, it)));
}
/** họ font xem trước (chỉ chữ cái của tên) */
export const previewFamily = (family: string) => `"__p ${family}", "${family}"`;
const previews = new Map<string, Promise<void>>();
export function loadPreview(family: string) {
  let p = previews.get(family);
  if (!p) {
    p = (async () => {
      const r = await fetch(`https://fonts.googleapis.com/css2?family=${fam(family)}&text=${encodeURIComponent(family)}`);
      if (!r.ok) return;
      const css = (await r.text()).replace(/font-family:\s*'([^']+)'/g, (_m, n) => `font-family: '__p ${n}'`);
      const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
      await document.fonts.load(`20px "__p ${family}"`, family).catch(() => null);
    })().catch(() => undefined);
    previews.set(family, p);
  }
  return p;
}
/** kiểm tra 1 font Google theo tên: có tồn tại + có tiếng Việt không, độ đậm / nghiêng nào có (admin "Thêm font Google theo tên") */
export async function probeGoogleFont(family: string): Promise<GFont | { error: string }> {
  const name = family.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Nhập tên font" };
  const base = await fetch(`https://fonts.googleapis.com/css2?family=${fam(name)}`).catch(() => null);
  if (!base || !base.ok) return { error: `Không tìm thấy font “${name}” trên Google Fonts (kiểm tra đúng chữ hoa / thường).` };
  if (!/\/\*\s*vietnamese\s*\*\//i.test(await base.text())) return { error: `Font “${name}” không có tiếng Việt — không thêm.` };
  const ws: number[] = [];
  await Promise.all([100, 200, 300, 400, 500, 600, 700, 800, 900].map(async (w) => { const r = await fetch(`https://fonts.googleapis.com/css2?family=${fam(name)}:wght@${w}`).catch(() => null); if (r?.ok) ws.push(w); }));
  const it = await fetch(`https://fonts.googleapis.com/css2?family=${fam(name)}:ital@1`).then((r) => r.ok).catch(() => false);
  return { family: name, group: "sans", weights: ws.sort((a, b) => a - b).length ? ws : [400], italic: it };
}
