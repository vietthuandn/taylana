"use client";

// Hiện khi một trang admin gặp lỗi — kèm mã lỗi để tra trong Vercel → Logs.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="pop max-w-md rounded-[2rem] bg-cream-50 px-6 py-8">
        <h1 className="text-2xl">Ối, trang quản trị gặp lỗi</h1>
        <p className="mt-2 break-words text-sm text-cocoa-500">{error.message || "Lỗi máy chủ"}</p>
        {error.digest && <p className="mt-1 text-xs text-cocoa-400">Mã lỗi: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn bg-pink-200" onClick={reset}>Thử lại</button>
          <a className="btn bg-cream-50" href="/admin/login">Đăng nhập lại</a>
        </div>
      </div>
    </main>
  );
}
