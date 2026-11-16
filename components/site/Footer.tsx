import { Scallop } from "@/components/decor/Scallop";
import { NoteIcon, StarIcon } from "@/components/decor/Icons";

export function Footer() {
  return (
    <footer className="mt-16">
      <Scallop up color="var(--color-matcha-200)" hole="var(--color-cream-100)" />
      <div className="bg-matcha-200 pb-8 pt-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <NoteIcon className="h-6 w-6 text-cocoa-500" />
          <span className="font-display text-xl">Tiệm In Taylana</span>
          <StarIcon className="h-6 w-6 text-butter-200" />
        </div>
        <p className="text-sm text-cocoa-500">Thiết kế & thi công CD handmade · Làm bằng cả trái tim ♡</p>
        <p className="mt-1 text-xs text-cocoa-400">© {new Date().getFullYear()} Tiệm In Taylana</p>
      </div>
    </footer>
  );
}
