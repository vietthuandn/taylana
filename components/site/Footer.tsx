import Link from "next/link";

// Footer chung cho mọi trang (1 dòng: logo · link · ©)
export function Footer() {
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
