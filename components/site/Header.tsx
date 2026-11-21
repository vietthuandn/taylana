import Link from "next/link";
import { Sparkle } from "@/components/ui/Shapes";
import { AccountButton } from "./AccountButton";
import { CartButton, HeaderNav, MobileMenu, MobileNav } from "./HeaderNav";

export function Logo() {
  return (
    <Link href="/" aria-label="Taylana — Trang chủ" className="flex items-center gap-1.5 font-display text-3xl leading-none text-[var(--c-header-text)]">
      TAYLANA
      <Sparkle className="h-4 w-4 animate-twinkle" />
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 h-[var(--header-h)] border-b border-[#e5e5e7] bg-[var(--c-header-bg)] font-sans">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <HeaderNav />

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <CartButton />
          <AccountButton />
        </div>

        {/* Điện thoại & máy tính bảng: menu hamburger */}
        <MobileMenu>
          <MobileNav />
        </MobileMenu>
      </div>
    </header>
  );
}
