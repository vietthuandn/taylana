import Image from "next/image";
import Link from "next/link";
import type { ToolLink } from "@/lib/designTools";
import { CdDisc } from "@/components/ui/Shapes";

// Lưới thẻ chọn công cụ (Thiết Kế, Gửi file): máy tính 4 cột, điện thoại 2 cột, cách 16px
export function ToolGrid({ tools }: { tools: ToolLink[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tools.map((t) => (
        <li key={t.href}>
          <Link href={t.href} className="flex aspect-square flex-col overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white transition-colors hover:border-[#ff5fa2]">
            <div className="relative min-h-0 flex-1 bg-[#f4f4f5]">
              {t.image ? <Image src={t.image} alt="" fill sizes="(min-width:1024px) 280px, 50vw" className="object-cover" />
                : <div className="grid h-full place-items-center"><CdDisc className="w-1/2" /></div>}
            </div>
            <div className="p-3">
              <p className="truncate text-[15px] font-semibold text-[#18181b]">{t.title}</p>
              <p className="line-clamp-2 text-[13px] text-[#71717a]">{t.desc}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
