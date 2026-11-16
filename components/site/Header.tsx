import Link from "next/link";
import { services } from "@/lib/services";
import { SearchIcon } from "@/components/decor/Icons";
import { Sparkle } from "@/components/ui/Shapes";
import { AccountButton } from "./AccountButton";

function SearchBox({ className = "" }: { className?: string }) {
  return (
    <form action="/san-pham" role="search" className={`relative ${className}`}>
      <input name="q" type="search" placeholder="Tìm sản phẩm..." aria-label="Tìm sản phẩm"
        className="field !min-h-11 !py-2 !pl-11 !text-[15px]" />
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-900" />
    </form>
  );
}

export function Logo() {
  return (
    <Link href="/" aria-label="Taylana — Trang chủ" className="flex items-center gap-1.5 font-display text-3xl leading-none text-ink-900">
      TAYLANA
      <Sparkle className="h-4 w-4 animate-twinkle" />
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-ink-900 bg-cream-100/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Logo />

        <nav className="ml-4 hidden flex-1 gap-1 lg:flex">
          {services.map((s) => (
            <Link key={s.href} href={s.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-ink-900 transition hover:bg-lime-500">
              {s.short}
            </Link>
          ))}
        </nav>

        <SearchBox className="ml-auto hidden w-56 md:block lg:ml-0" />
        <div className="ml-auto md:ml-0"><AccountButton /></div>

        {/* Điện thoại & máy tính bảng: menu hamburger (không cần JavaScript) */}
        <details className="group relative lg:hidden">
          <summary aria-label="Mở menu"
            className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full bg-ink-900 text-white [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col gap-[5px] group-open:hidden">
              <span className="h-[2px] w-5 bg-white" /><span className="h-[2px] w-5 bg-white" /><span className="h-[2px] w-5 bg-white" />
            </span>
            <span className="hidden text-xl leading-none group-open:block">✕</span>
          </summary>
          <div className="absolute right-0 mt-3 w-72 rounded-[24px] border-[1.5px] border-ink-900 bg-white p-3 shadow-[0_12px_40px_rgba(20,20,20,.18)]">
            <SearchBox className="mb-2 md:hidden" />
            <nav>
              {services.map((s) => (
                <Link key={s.href} href={s.href}
                  className="flex items-center justify-between rounded-full px-4 py-3 font-semibold text-ink-900 hover:bg-lime-500">
                  {s.title}<span aria-hidden>→</span>
                </Link>
              ))}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
