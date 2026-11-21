/* POST /api/storage/upload-url { scope, folder?, filename, contentType, size } → { url, headers, key, path, publicUrl }
   Kiểm tra quyền theo scope (phiên Supabase), loại + dung lượng file; khoá do server tự sinh (không dùng tên file khách đặt).
   Trình duyệt PUT file thẳng lên R2 bằng url (hạn 10 phút) — dữ liệu ảnh không đi qua server. */
import { getPublicUrl, getUploadUrl } from "@/lib/storage";
import { canWrite, whoAmI } from "@/lib/storage/access";
import { isValidKey } from "@/lib/storage/keys";
import { serviceClient } from "@/lib/supabase/service";

const MB = 1024 * 1024;
const USER_QUOTA = 200 * MB; // dung lượng ảnh tối đa của 1 khách
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "application/pdf": "pdf", "application/zip": "zip", "model/gltf-binary": "glb" };
const SCOPES: Record<string, { root: string; types: string[] }> = {
  scrapbook: { root: "scrapbook", types: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
  mockups: { root: "mockups", types: ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "model/gltf-binary"] },
  "public-assets": { root: "public-assets", types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"] },
  order: { root: "order-files", types: ["image/jpeg", "image/png", "application/pdf", "application/zip"] },
  design: { root: "design-assets", types: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  share: { root: "mockup-shares", types: ["image/jpeg", "image/png", "image/webp"] },
};
const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  let b: { scope?: string; folder?: string; filename?: string; contentType?: string; size?: number };
  try { b = await req.json(); } catch { return bad("Dữ liệu không hợp lệ"); }
  const s = SCOPES[b.scope ?? ""], type = String(b.contentType ?? ""), size = Number(b.size);
  if (!s) return bad("Loại tải lên không hợp lệ");
  if (!s.types.includes(type)) return bad("Loại file không được phép");
  if (!Number.isFinite(size) || size <= 0) return bad("Dung lượng file không hợp lệ");
  const max = type === "application/zip" ? 100 * MB : 30 * MB;
  if (size > max) return bad(`File tối đa ${max / MB}MB`, 413);

  const w = await whoAmI();
  if (type === "image/svg+xml" && w.role !== "admin") return bad("Chỉ admin được tải ảnh SVG", 403);
  const folder = String(b.folder ?? "").replace(/^\/+|\/+$/g, "");
  let dir: string;
  if (b.scope === "design") {
    if (!w.userId) return bad("Bạn cần đăng nhập", 401);
    dir = w.userId;
    // mỗi khách tối đa 200MB ảnh (thiết kế đã lưu + sticker tự tải) — tính theo bảng user_files, không liệt kê bucket
    if (w.role !== "admin" && w.role !== "designer") {
      const { data: used } = (await serviceClient()?.from("user_files").select("size").eq("user_id", w.userId)) ?? { data: null };
      const total = (used ?? []).reduce((t, r) => t + Number(r.size), 0);
      if (total + size > USER_QUOTA) return bad(`Bạn đã dùng ${Math.round(total / MB)}MB / ${USER_QUOTA / MB}MB ảnh — vào Thiết kế của tôi xoá bớt thiết kế cũ rồi lưu lại nhé.`, 413);
    }
  }
  else if (!/^[A-Za-z0-9][A-Za-z0-9_\-/]{0,120}$/.test(folder) || folder.includes("//")) return bad("Thư mục không hợp lệ");
  else dir = folder;
  if ((b.scope === "order" || b.scope === "share") && dir.includes("/")) return bad("Thư mục không hợp lệ");

  const key = `${s.root}/${dir}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${EXT[type]}`;
  if (!isValidKey(key)) return bad("Thư mục không hợp lệ");
  if (!(await canWrite(w, key))) return bad("Bạn không có quyền tải file lên đây", 403);
  const pub = ["scrapbook", "mockups", "public-assets"].includes(s.root);
  try {
    const up = await getUploadUrl(pub ? "public" : "private", key, type, max, size);
    // file của khách (thiết kế / sticker tự tải): ghi sẵn dung lượng → trang Quản lý tài khoản không phải liệt kê bucket
    if (b.scope === "design" && w.userId) await serviceClient()?.from("user_files").insert({ key, user_id: w.userId, size }).then(() => undefined, () => undefined);
    return Response.json({ ...up, key, path: key.slice(s.root.length + 1), publicUrl: pub ? getPublicUrl(key) : null });
  } catch (e) { return bad(e instanceof Error ? e.message : "Không tạo được link tải lên", 500); }
}
