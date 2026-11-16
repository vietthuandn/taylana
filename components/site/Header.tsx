import Link from "next/link";
import { services } from "@/lib/services";
import { Scallop } from "@/components/decor/Scallop";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-pink-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <Logo />

          {/* Máy tính: menu ngang */}
          <nav className="hidden gap-1 lg:flex">
            {services.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-full px-3 py-2 font-display text-cocoa-700 hover:bg-cream-100"
              >
                {s.title}
              </Link>
            ))}
          </nav>

          {/* Điện thoại: nút Menu mở danh sách (không cần JavaScript) */}
          <details className="group relative lg:hidden">
            <summary className="btn list-none bg-cream-100 !min-h-11 !px-4 !text-base [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">☰ Menu</span>
              <span className="hidden group-open:inline">✕ Đóng</span>
            </summary>
            <nav className="pop absolute right-0 mt-3 w-64 rounded-3xl bg-cream-50 p-2">
              {services.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="block rounded-2xl px-4 py-3 font-display text-lg hover:bg-pink-100"
                >
                  {s.title}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
      <Scallop color="var(--color-pink-200)" hole="var(--color-cream-100)" />
    </header>
  );
}
