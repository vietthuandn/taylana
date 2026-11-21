import Link from "next/link";
import { optionIcons, TEXT_COLORS } from "@/lib/settings";
import { services } from "@/lib/services";
import type { HomeVariantProps } from "@/lib/homeData";
import { ServiceIcon } from "@/components/site/ServiceIcon";

// Mẫu 2 · Cơ bản — 1 dòng chào, 1 dòng mô tả, 6 lựa chọn dạng thẻ ngang (icon trái, tên + mô tả phải).
// Dữ liệu chung: Admin → Trang chủ (6 ô: tên, link, icon, màu). Dữ liệu riêng (variant_settings["v2-co-ban"]):
//   { title?: string, subtitle?: string, descriptions?: string[] }
const stripBrackets = (s: string) => s.replace(/\[|\]/g, "");

export default function HomeV2({ home, options, settings }: HomeVariantProps) {
  const title = (settings.title as string) || "Tiệm In Taylana";
  const subtitle = (settings.subtitle as string) || home.banner_subtitle || "Thiết kế & in CD theo yêu cầu.";
  const descs = Array.isArray(settings.descriptions) ? (settings.descriptions as string[]) : [];

  return (
    <div className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8 font-sans">
      <h1 className="text-center font-sans text-[28px] font-bold normal-case tracking-[-0.02em] text-[#18181b]">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-center text-[15px] text-[#71717a]">{subtitle}</p>
      <ul className="mt-8 flex flex-col gap-3">
        {options.map((o, i) => {
          const desc = descs[i] || services.find((s) => s.href === o.href)?.desc || "";
          const color = TEXT_COLORS[o.text_color] ?? "#18181b";
          return (
            <li key={i}>
              <Link href={o.href || "/"} className="flex items-center gap-4 rounded-[12px] border border-[#e5e5e7] bg-white p-4 transition-colors hover:border-[var(--c-primary)]">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px]" style={{ background: o.bg, color, boxShadow: /^#?f{6}$/i.test(o.bg) ? "inset 0 0 0 1px #e5e5e7" : undefined }}>
                  {o.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image_url} alt="" className="h-7 w-7 object-contain" />
                  ) : <ServiceIcon name={optionIcons[i]} className="h-7 w-7" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-[#18181b]">{stripBrackets(o.title)}</span>
                  {desc && <span className="block truncate text-[13px] text-[#71717a]">{desc}</span>}
                </span>
                <span aria-hidden className="text-[#a1a1aa]">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
