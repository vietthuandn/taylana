import Link from "next/link";
import { isDark, optionIcons, type HomeOption } from "@/lib/settings";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { FlowerBadge, StampBadge } from "@/components/ui/Shapes";

const PRESET = { lime: "#c8e03c", violet: "#7b68ee", hot: "#ff5fa2" } as const;

// Bento: ô 1 và ô 6 rộng gấp đôi → 2 hàng x 4 cột trên máy tính, ô rộng trên điện thoại
const SPAN = ["col-span-2", "", "", "", "", "col-span-2"];

// 6 nút lớn trên trang chủ
export function HomeTiles({ options, fill }: { options: HomeOption[]; fill: boolean }) {
  return (
    <ul className={`grid w-full flex-1 auto-rows-fr grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 ${fill ? "md:min-h-[460px]" : "md:flex-none md:auto-rows-[250px]"}`}>
      {options.map((o, i) => {
        const bg = o.color === "custom" ? o.bg_custom : PRESET[o.color];
        const dark = isDark(bg);
        const fg = dark ? "#ffffff" : "#141414"; // màu chữ
        const badgeFill = dark ? "#ffffff" : "#141414"; // bông hoa / con dấu chứa icon
        const iconColor = o.icon_color || bg; // icon lấy màu ô
        const Badge = i % 2 === 0 ? FlowerBadge : StampBadge;
        const wide = SPAN[i] !== "";
        return (
          <li key={i} className={`${SPAN[i]} min-h-[150px] animate-[rise_.6s_cubic-bezier(.2,.8,.2,1)_both]`} style={{ animationDelay: `${i * 70}ms` }}>
            <Link href={o.href || "/"} style={{ background: bg, color: fg }}
              className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] border-2 border-ink-900 p-4 transition duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_#141414] focus-visible:-translate-y-1 focus-visible:shadow-[8px_8px_0_#141414] focus-visible:outline-none sm:p-6">
              {/* hình khổng lồ trang trí ở góc */}
              <Badge fillColor={fg} className={`pointer-events-none absolute -bottom-10 -right-10 opacity-[0.13] transition duration-700 group-hover:scale-110 ${wide ? "h-56 w-56 sm:h-72 sm:w-72" : "h-40 w-40 sm:h-52 sm:w-52"}`} />

              <div className="relative flex items-start justify-between">
                <span className="font-display text-lg leading-none opacity-70 sm:text-2xl">{String(i + 1).padStart(2, "0")}</span>
                <span className="grid h-10 w-10 place-items-center rounded-full text-lg transition duration-300 group-hover:rotate-45 sm:h-12 sm:w-12 sm:text-xl"
                  style={{ background: fg, color: bg }} aria-hidden>↗</span>
              </div>

              <div className={`relative flex gap-3 ${wide ? "items-end justify-between" : "flex-col"}`}>
                <h2 className={`font-display leading-[0.95] !text-[inherit] ${wide ? "text-4xl sm:text-5xl lg:text-6xl" : "text-[26px] sm:text-[34px]"}`}>{o.title}</h2>
                <Badge fillColor={badgeFill} className={`shrink-0 transition duration-500 group-hover:rotate-12 ${wide ? "order-last h-20 w-20 sm:h-28 sm:w-28" : "order-first h-14 w-14 sm:h-16 sm:w-16"}`}>
                  {o.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.icon_url} alt="" className={`object-contain ${wide ? "h-10 w-10 sm:h-14 sm:w-14" : "h-7 w-7 sm:h-8 sm:w-8"}`} />
                  ) : (
                    <span style={{ color: iconColor }}>
                      <ServiceIcon name={optionIcons[i]} className={wide ? "h-10 w-10 sm:h-14 sm:w-14" : "h-7 w-7 sm:h-8 sm:w-8"} />
                    </span>
                  )}
                </Badge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
