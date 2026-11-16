import Link from "next/link";
import { CdIcon } from "@/components/decor/Icons";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Tiệm In Taylana — Trang chủ">
      <CdIcon className="h-10 w-10 animate-spin-slow text-cocoa-700" />
      <span className="leading-none">
        <span className="block text-[11px] tracking-[0.2em] uppercase text-cocoa-400">tiệm in</span>
        <span className="block font-display text-2xl text-cocoa-700">Taylana</span>
      </span>
    </Link>
  );
}
