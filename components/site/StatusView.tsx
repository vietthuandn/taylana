import Link from "next/link";
import type { StatusPage } from "@/lib/statusPages";

/** Trang trạng thái: nền màu, ảnh minh hoạ giữa trang (cỡ vừa), 1 dòng thông báo, tối đa 3 nút điều hướng (nút đầu = nút chính) */
export function StatusView({ page, full = false }: { page: StatusPage; full?: boolean }) {
  return (
    <div className={`grid flex-1 place-items-center px-4 py-10 font-sans ${full ? "min-h-dvh" : "min-h-[calc(100dvh-var(--header-h))]"}`} style={{ background: page.bg }}>
      <div className="flex w-full max-w-[460px] flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {page.image && <img src={page.image} alt="" className="mb-5 block aspect-[1400/1150] w-[min(260px,70vw)] object-contain" />}
        {page.message && <p className="whitespace-pre-line text-[17px] font-medium leading-relaxed text-[#18181b] sm:text-[19px]">{page.message}</p>}
        {page.buttons.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {page.buttons.map((b, i) => (
              <Link key={i} href={b.href || "/"} className={i === 0
                ? "inline-flex h-11 items-center rounded-[10px] bg-[var(--c-primary,#ff5fa2)] px-5 text-[15px] font-semibold text-white hover:opacity-90"
                : "inline-flex h-11 items-center rounded-[10px] border border-[#d4d4d8] bg-white px-5 text-[15px] font-medium text-[#18181b] hover:bg-[#f4f4f5]"}>{b.label}</Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
