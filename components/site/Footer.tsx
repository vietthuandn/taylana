import Link from "next/link";

// Footer chung cho mọi trang (1 dòng: logo · link · ©)
export function Footer() {
  return (
    <footer className="border-t border-[#e5e5e7] bg-white font-sans">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-[13px] text-[#71717a]">
        <span className="font-display text-xl text-[#18181b]">TAYLANA</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/lien-he" className="hover:text-[#ff5fa2]">Liên hệ</Link>
          <Link href="/huong-dan" className="hover:text-[#ff5fa2]">Hướng dẫn</Link>
          <Link href="/san-pham#danh-gia" className="hover:text-[#ff5fa2]">Đánh giá</Link>
          <Link href="/don-hang-cua-toi" className="hover:text-[#ff5fa2]">Đơn hàng của tôi</Link>
        </nav>
        <span className="text-[12px] text-[#a1a1aa]">© {new Date().getFullYear()} Tiệm In Taylana</span>
      </div>
    </footer>
  );
}
