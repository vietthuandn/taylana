import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Chạy trước mỗi request vào /admin: làm mới phiên đăng nhập Supabase (cookie).
export async function proxy(request: NextRequest) {
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
    await supabase.auth.getUser();
  } catch {
    // lỗi mạng tạm thời: bỏ qua, trang admin sẽ tự báo lỗi
  }
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
