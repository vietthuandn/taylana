// Tải hộ ảnh từ link ngoài (khung / mặt nạ / nền mockup) để canvas xuất được file (tránh lỗi CORS).
// CHỈ cho phép link admin đã lưu trong database (hoặc admin đang đăng nhập — để soạn mẫu), tối đa 15MB, chỉ image/*.
import { createClient } from "@/lib/supabase/server";
import { publicClient } from "@/lib/supabase/public";

const MAX = 15 * 1024 * 1024; // 15MB (tách tờ sticker ở admin)
const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status });

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
  if (!allowed && !(await isAdmin())) return bad("Link chưa được admin cho phép", 403);

  let res: Response;
  try { res = await fetch(target, { redirect: "follow", headers: { Accept: "image/*" }, signal: AbortSignal.timeout(15000) }); }
  catch { return bad("Không tải được ảnh", 502); }
  if (!res.ok) return bad(`Không tải được ảnh (${res.status})`, 502);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return bad("Link không phải ảnh", 415);
  if (Number(res.headers.get("content-length") ?? 0) > MAX) return bad("Ảnh lớn hơn 15MB", 413);

  // đọc có giới hạn 10MB
  const reader = res.body?.getReader();
  if (!reader) return bad("Không tải được ảnh", 502);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX) { reader.cancel(); return bad("Ảnh lớn hơn 15MB", 413); }
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
