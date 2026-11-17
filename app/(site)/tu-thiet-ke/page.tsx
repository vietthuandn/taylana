import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { CdDisc, Sparkle } from "@/components/ui/Shapes";
import { FilmIcon } from "@/components/decor/Icons";

export const metadata = { title: "Tự Tay Thiết Kế" };

// Trang gộp: chọn Custom CD hoặc Làm Photostrip (trình chỉnh giữ nguyên ở /custom-cd và /photostrip)
export default function DesignHubPage() {
  return (
    <>
      <PageHeader eyebrow="Thiết kế online" title="Tự tay thiết kế" subtitle="Chọn thứ bạn muốn làm — xuất file 300 DPI đúng khổ in, gửi kèm đơn luôn." />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-2">
        <Link href="/custom-cd" className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[32px] bg-violet-500 p-7 text-white transition hover:-translate-y-1 sm:p-9">
          <CdDisc spin className="absolute -right-10 -top-10 w-64 sm:w-72" />
          <Sparkle color="white" className="absolute left-8 top-8 h-8 w-8 animate-twinkle" />
          <h2 className="relative text-5xl !text-white sm:text-6xl">Custom CD</h2>
          <p className="relative mt-2 max-w-sm text-white/85">Thiết kế bìa trước, bìa sau và mặt đĩa theo mẫu có sẵn — thả ảnh, thêm chữ & sticker.</p>
          <span className="btn btn-lime relative mt-5 self-start">Bắt đầu thiết kế →</span>
        </Link>
        <Link href="/photostrip" className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[32px] bg-hot-500 p-7 text-white transition hover:-translate-y-1 sm:p-9">
          <div className="absolute -right-4 -top-6 flex rotate-12 flex-col gap-2 rounded-2xl bg-white p-3 shadow-lg">
            {[0, 1, 2, 3].map((i) => <span key={i} className="block h-16 w-20 rounded-md bg-ink-100" />)}
          </div>
          <FilmIcon className="absolute left-8 top-8 h-10 w-10 text-white" />
          <h2 className="relative text-5xl !text-white sm:text-6xl">Làm Photostrip</h2>
          <p className="relative mt-2 max-w-sm text-white/85">Dải ảnh 3–4 khung khổ 2x6 inch — thêm chữ, ngày tháng và sticker.</p>
          <span className="btn btn-lime relative mt-5 self-start">Làm photostrip →</span>
        </Link>
      </div>
    </>
  );
}
