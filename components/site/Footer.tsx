import Link from "next/link";
import { services } from "@/lib/services";
import { getSettings } from "@/lib/settings";
import { ContactButtons } from "./ContactButtons";
import { NewsletterForm } from "./NewsletterForm";
import { Sparkle } from "@/components/ui/Shapes";

export async function Footer() {
  const { contact } = await getSettings();
  return (
    <footer id="lien-he" className="mt-20 overflow-hidden border-t-[1.5px] border-ink-900 bg-cream-100">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 pt-12 lg:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
        <div className="col-span-2 lg:col-span-1">
          <p className="font-display text-3xl text-ink-900">LIÊN HỆ TIỆM</p>
          {contact.note && <p className="mt-2 text-sm">{contact.note}</p>}
          <ContactButtons contact={contact} className="mt-4" />
          {contact.hours && <p className="mt-3 text-sm text-ink-500">Giờ làm việc: {contact.hours}</p>}
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-900">Dịch vụ</p>
          <ul className="space-y-2 text-sm">
            {services.map((s) => <li key={s.href}><Link href={s.href} className="hover:text-violet-500 hover:underline">{s.title}</Link></li>)}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-900">Hỗ trợ</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/huong-dan" className="hover:text-violet-500 hover:underline">Chuẩn bị file in</Link></li>
            <li><Link href="/nop-file" className="hover:text-violet-500 hover:underline">Nộp file cho đơn</Link></li>
            <li><Link href="/#hoi-dap" className="hover:text-violet-500 hover:underline">Câu hỏi thường gặp</Link></li>
            <li><Link href="/san-pham#danh-gia" className="hover:text-violet-500 hover:underline">Gửi đánh giá</Link></li>
          </ul>
        </div>

        <div className="col-span-2 lg:col-span-1">
          <p className="mb-1 font-display text-2xl text-ink-900">NHẬN TIN MỚI</p>
          <p className="mb-3 text-sm">Mẫu mới, ưu đãi và lịch nhận đơn — để lại email hoặc Zalo nhé.</p>
          <NewsletterForm />
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl items-center justify-between px-4 text-xs text-ink-500">
        <span>© {new Date().getFullYear()} Tiệm In Taylana</span>
        <span>Thiết kế & thi công CD theo yêu cầu</span>
      </div>
      {/* Chữ TAYLANA khổng lồ tràn chiều ngang */}
      <div aria-hidden className="relative mt-6 select-none text-center font-display leading-[0.8] text-ink-900" style={{ fontSize: "26vw" }}>
        TAYLANA
        <Sparkle className="absolute right-[4%] top-[8%] h-[8vw] w-[8vw] animate-twinkle" />
        <Sparkle color="lime" className="absolute left-[3%] top-[30%] h-[5vw] w-[5vw] animate-twinkle" />
      </div>
    </footer>
  );
}

// Footer gọn cho trang chủ
export function CompactFooter() {
  return (
    <footer className="border-t-[1.5px] border-ink-900 bg-cream-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm">
        <span className="font-display text-xl text-ink-900">TAYLANA</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/lien-he" className="hover:text-violet-500 hover:underline">Liên hệ</Link>
          <Link href="/huong-dan" className="hover:text-violet-500 hover:underline">Hướng dẫn</Link>
          <Link href="/san-pham#danh-gia" className="hover:text-violet-500 hover:underline">Đánh giá</Link>
        </nav>
        <span className="text-xs text-ink-500">© {new Date().getFullYear()} Tiệm In Taylana</span>
      </div>
    </footer>
  );
}
