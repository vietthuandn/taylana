"use client";

// Hiện khi một trang admin gặp lỗi — kèm mã lỗi để tra trong Vercel → Logs.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="admin-ui grid min-h-dvh place-items-center px-4 text-center">
      <div className="w-full max-w-md rounded-[12px] border border-[#e5e5e7] bg-white p-6">
        <h1>Trang quản trị gặp lỗi</h1>
        <p className="mt-2 break-words text-[14px] text-[#71717a]">{error.message || "Lỗi máy chủ"}</p>
        {error.digest && <p className="mt-1 text-[12px] text-[#a1a1aa]">Mã lỗi: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button className="h-9 rounded-[8px] bg-[#ff5fa2] px-4 text-[14px] font-medium text-white hover:bg-[#f0468f]" onClick={reset}>Thử lại</button>
          <a className="inline-flex h-9 items-center rounded-[8px] border border-[#e5e5e7] bg-white px-4 text-[14px] font-medium text-[#18181b] hover:bg-[#f4f4f5]" href="/admin/login">Đăng nhập lại</a>
        </div>
      </div>
    </main>
  );
}
