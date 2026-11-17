import Link from "next/link";
import { Search } from "lucide-react";
import { Sparkle } from "@/components/ui/Shapes";
import { AccountButton } from "./AccountButton";
import { CartButton, HeaderNav, MobileNav } from "./HeaderNav";

function SearchBox({ className = "" }: { className?: string }) {
  return (
    <form action="/ve-chung-toi" role="search" className={`relative ${className}`}>
      <input name="q" type="search" placeholder="Tìm sản phẩm..." aria-label="Tìm sản phẩm"
        className="h-9 w-full rounded-[8px] border border-[#e5e5e7] bg-white pl-9 pr-3 text-[14px] text-[#18181b] placeholder:text-[#a1a1aa] focus:border-[#ff5fa2] focus:outline-none focus:ring-[3px] focus:ring-[#ff5fa2]/15" />
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
    </form>
  );
}

export function Logo() {
  return (
    <Link href="/" aria-label="Taylana — Trang chủ" className="flex items-center gap-1.5 font-display text-3xl leading-none text-[#18181b]">
      TAYLANA
      <Sparkle className="h-4 w-4 animate-twinkle" />
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 h-[var(--header-h)] border-b border-[#e5e5e7] bg-white font-sans">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <HeaderNav />

        <SearchBox className="ml-auto hidden w-52 md:block lg:ml-0" />
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <CartButton />
          <AccountButton />
        </div>

        {/* Điện thoại & máy tính bảng: menu hamburger */}
        <details className="group relative lg:hidden">
          <summary aria-label="Mở menu"
            className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-[8px] border border-[#e5e5e7] bg-white text-[#18181b] [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col gap-[4px] group-open:hidden">
              <span className="h-[1.5px] w-4 bg-current" /><span className="h-[1.5px] w-4 bg-current" /><span className="h-[1.5px] w-4 bg-current" />
            </span>
            <span className="hidden text-[15px] leading-none group-open:block">✕</span>
          </summary>
          <div className="absolute right-0 mt-2 w-72 rounded-[12px] border border-[#e5e5e7] bg-white p-2 shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
            <SearchBox className="mb-2 md:hidden" />
            <MobileNav />
          </div>
        </details>
      </div>
    </header>
  );
}
