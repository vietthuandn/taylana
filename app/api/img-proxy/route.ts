// Tải hộ ảnh từ link ngoài (khung / mặt nạ / nền mockup) để canvas xuất được file (tránh lỗi CORS).
// CHỈ cho phép link admin đã lưu trong database (hoặc admin đang đăng nhập — để soạn mẫu), tối đa 15MB, chỉ image/*.
import { createClient } from "@/lib/supabase/server";
import { publicClient } from "@/lib/supabase/public";

const MAX_DEFAULT = 15 * 1024 * 1024; // 15MB (tách tờ sticker ở admin) · ảnh Google Drive: 30MB
const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status });

/** ảnh Google Drive (tải từ "Từ Google Drive" khi bị chặn CORS): cho phép khi ĐÃ ĐĂNG NHẬP, tối đa 30MB */
const isGoogle = (h: string) => /(^|\.)googleapis\.com$|(^|\.)googleusercontent\.com$/.test(h);
async function loggedIn() {
  try { const sb = await createClient(); const { data: { user } } = await sb.auth.getUser(); return !!user; } catch { return false; }
}
async function isAdmin() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data } = await sb.rpc("is_admin");
    return !!data;
  } catch { return false; }
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  let target: URL;
  try { target = new URL(url); } catch { return bad("Link không hợp lệ"); }
  if (target.protocol !== "https:" && target.protocol !== "http:") return bad("Link không hợp lệ");

  const sb = publicClient();
  const allowed = sb ? (await sb.rpc("mockup_url_allowed", { p_url: url })).data === true : false;
  const google = isGoogle(target.hostname);
  if (google && target.protocol !== "https:") return bad("Link không hợp lệ");
  if (!allowed && !(google ? await loggedIn() : await isAdmin())) return bad(google ? "Cần đăng nhập để tải ảnh từ Google Drive" : "Link chưa được admin cho phép", google ? 401 : 403);
  const MAX = google ? 30 * 1024 * 1024 : MAX_DEFAULT;

  let res: Response;
  try { res = await fetch(target, { redirect: "follow", headers: { Accept: "image/*" }, signal: AbortSignal.timeout(15000) }); }
  catch { return bad("Không tải được ảnh", 502); }
  if (!res.ok) return bad(`Không tải được ảnh (${res.status})`, 502);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/") && !(google && type === "application/octet-stream")) return bad("Link không phải ảnh", 415);
  if (Number(res.headers.get("content-length") ?? 0) > MAX) return bad(`Ảnh lớn hơn ${MAX / 1048576}MB`, 413);

  // đọc có giới hạn 10MB
  const reader = res.body?.getReader();
  if (!reader) return bad("Không tải được ảnh", 502);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX) { reader.cancel(); return bad(`Ảnh lớn hơn ${MAX / 1048576}MB`, 413); }
    chunks.push(value);
  }
  return new Response(new Blob(chunks as BlobPart[], { type }), {
    headers: {
      "Content-Type": type,
      "Cache-Control": allowed ? "public, max-age=31536000, immutable" : "private, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
