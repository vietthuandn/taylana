import Image from "next/image";
import Link from "next/link";
import { isDark } from "@/lib/settings";
import type { HomeVariantProps } from "@/lib/homeData";
import { optionIcons, type HomeOption } from "@/lib/settings";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { Button } from "@/components/ui/Button";
import { CdDisc, PetalFrame } from "@/components/ui/Shapes";

// Mẫu 1 · Hiện tại — giao diện trang chủ gốc (giữ nguyên). Dữ liệu: Admin → Trang chủ.
export default function HomeV1({ home, options, settings }: HomeVariantProps) {
  const dark = isDark(home.banner_bg);
  const pageBg = typeof settings.page_bg === "string" && settings.page_bg ? settings.page_bg : "#FCE4EC";

  return (
    <div className="flex w-full flex-1 flex-col" style={{ background: pageBg }}>
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:py-8">
      {/* ---------- BANNER (chỉ máy tính, từ 768px) ---------- */}
      {home.banner_enabled && (
      <section className="hidden md:block">
        <div className={`grid items-center gap-8 overflow-hidden rounded-[32px] px-10 py-10 lg:px-14 ${home.banner_image_enabled ? "grid-cols-[1.2fr_1fr]" : "grid-cols-1"}`}
          style={{ background: home.banner_bg }}>
          <div className={dark ? "text-white" : "text-ink-900"}>
            <h1 className={`text-5xl lg:text-[72px] ${dark ? "!text-white" : ""}`}>{home.banner_title}</h1>
            {home.banner_subtitle && <p className={`mt-4 max-w-md text-lg ${dark ? "text-white/85" : "text-ink-700"}`}>{home.banner_subtitle}</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              {home.btn1_label && <Button href={home.btn1_href || "/dat-don"} variant={dark ? "lime" : "primary"}>{home.btn1_label}</Button>}
              {home.btn2_enabled && home.btn2_label && (
                <Button href={home.btn2_href || "/"} variant="ghost" className={dark ? "!border-white !text-white hover:!bg-white hover:!text-ink-900" : ""}>
                  {home.btn2_label}
                </Button>
              )}
            </div>
          </div>
          {home.banner_image_enabled && (() => {
            const img = home.banner_image ? (
              <Image src={home.banner_image} alt={home.banner_title} fill priority sizes="440px" className="object-cover" />
            ) : (
              <div className="grid h-full place-items-center bg-violet-500"><CdDisc spin className="w-3/4" /></div>
            );
            return home.banner_image_petal ? (
              <PetalFrame className="ml-auto aspect-square w-full max-w-[440px]">{img}</PetalFrame>
            ) : (
              <div className="relative ml-auto aspect-square w-full max-w-[440px] overflow-hidden border-2 border-ink-900">{img}</div>
            );
          })()}
        </div>
      </section>
      )}

      {/* ---------- 6 MỤC: ô ảnh vuông + tên bên dưới ---------- */}
      <section className={`flex flex-1 items-center justify-center ${home.banner_enabled ? "md:mt-6 md:flex-none" : ""}`}>
        <div className={`relative w-full max-w-[720px] ${home.banner_enabled ? "" : "md:max-w-[min(720px,calc((100dvh-var(--header-h)-180px)*1.5+40px))]"}`}>
          <Stars />
          <ul className="relative z-10 grid grid-cols-2 gap-[14px] md:grid-cols-3 md:gap-5">
            {options.map((o, i) => (
              <li key={i} className="animate-[rise_.6s_cubic-bezier(.2,.8,.2,1)_both]" style={{ animationDelay: `${i * 60}ms` }}>
                <Item o={o} index={i} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
    </div>
  );
}

function Item({ o, index }: { o: HomeOption; index: number }) {
  const title = o.title.replace(/[[\]]/g, "");
  return (
    <Link href={o.href || "/"} className="group flex flex-col items-center text-center outline-none">
      <span className="relative block aspect-square w-full rounded-[28px] p-[4%] transition duration-300 ease-out active:scale-[0.97] group-focus-visible:ring-4 group-focus-visible:ring-[#ff5fa2] md:group-hover:-translate-y-1 md:group-hover:rotate-1 md:group-hover:shadow-[0_16px_32px_rgba(0,0,0,.10)]"
        style={{ background: o.bg || "#F8A5BE" }}>
        {o.image_url ? (
          // ảnh PNG admin tải lên: giữ tỉ lệ, phủ gần kín ô
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.image_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[#1A1A1A]"><ServiceIcon name={optionIcons[index]} className="h-[45%] w-[45%]" /></span>
        )}
      </span>
      <span className="mt-[10px] block w-full truncate text-[22px] font-extrabold leading-tight text-[#1A1A1A] md:text-[28px]">{title}</span>
    </Link>
  );
}

// ngôi sao trang trí ở khoảng trống giữa các ô (nằm dưới ô, không chặn bấm)
const STARS: { x: string; y: string; s: number; c: string; m?: boolean }[] = [
  { x: "-4%", y: "4%", s: 22, c: "#FFC83D" },
  { x: "49%", y: "-3%", s: 16, c: "#FF8A65", m: true },
  { x: "101%", y: "18%", s: 20, c: "#FF8A65" },
  { x: "32%", y: "47%", s: 14, c: "#FFC83D", m: true },
  { x: "66%", y: "46%", s: 18, c: "#FF8A65" },
  { x: "-3%", y: "72%", s: 16, c: "#FF8A65", m: true },
  { x: "99%", y: "88%", s: 22, c: "#FFC83D" },
  { x: "50%", y: "99%", s: 14, c: "#FFC83D", m: true },
];
function Stars() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {STARS.map((t, i) => (
        <svg key={i} viewBox="0 0 24 24" width={t.s} height={t.s} className={`absolute -translate-x-1/2 -translate-y-1/2 opacity-90 ${t.m ? "max-[479px]:hidden" : ""}`} style={{ left: t.x, top: t.y }}>
          <path d="M12 1.5l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.8l7.1-.7z" fill={t.c} />
        </svg>
      ))}
    </div>
  );
}
