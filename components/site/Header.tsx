import Link from "next/link";
import { Sparkle } from "@/components/ui/Shapes";
import { AccountButton } from "./AccountButton";
import { getTheme } from "@/lib/themeLoad";
import { CartButton, HeaderNav, MobileMenu, MobileNav } from "./HeaderNav";

export async function Logo() {
  const logo = (await getTheme().catch(() => null))?.logo_url;
  return (
    <Link href="/" aria-label="Taylana — Trang chủ" className="flex shrink-0 items-center gap-1.5 font-display text-3xl leading-none text-[var(--c-header-text)]">
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} alt="Taylana" className="block h-9 w-auto max-w-[160px] object-contain" />
        : <>TAYLANA<Sparkle className="h-4 w-4 animate-twinkle" /></>}
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 h-[var(--header-h)] pt-[env(safe-area-inset-top)] border-b border-[#e5e5e7] [background:var(--c-header-bg)] font-sans">
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
