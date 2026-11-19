import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { canAccess, type StaffRole } from "@/lib/roles";

// Chạy trước mỗi request vào /admin (và /thiet-ke/mockup): làm mới phiên đăng nhập Supabase (cookie).
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  request.headers.set("x-pathname", path); // layout /admin đọc lại để kiểm tra quyền lần 2 ở server
  let response = NextResponse.next({ request });
  if (!hasSupabase) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // Nhà thiết kế vào trang không được phép → về trang của mình kèm thông báo
    if (user && path.startsWith("/admin") && !path.startsWith("/admin/login")) {
      const r = await supabase.rpc("my_staff_role");
      const role = (r.error ? null : r.data) as StaffRole | null;
      if (role === "designer" && !canAccess(role, path)) {
        const to = request.nextUrl.clone(); to.pathname = "/admin"; to.search = "?khong-quyen=1";
        const res = NextResponse.redirect(to);
        response.cookies.getAll().forEach((c) => res.cookies.set(c));
        return res;
      }
    }
  } catch {
    // lỗi mạng tạm thời: bỏ qua, trang admin sẽ tự báo lỗi
  }
  return response;
}

export const config = { matcher: ["/admin/:path*", "/thiet-ke/mockup"] }; // + trang Mockup: nhận ra admin để hiện nút "Chia sẻ"
