import Image from "next/image";
import Link from "next/link";
import { getSettings, optionIcons } from "@/lib/settings";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { Button } from "@/components/ui/Button";
import { CdDisc, FlowerBadge, PetalFrame, StampBadge } from "@/components/ui/Shapes";

// Lấy lại nội dung mới nhất từ database tối đa mỗi 60 giây.
export const revalidate = 60;

// Nền tối → chữ trắng
function isDark(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export default async function HomePage() {
  const { home, options } = await getSettings();
  const dark = isDark(home.banner_bg);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:py-8">
      {/* ---------- BANNER (chỉ máy tính, từ 768px) ---------- */}
      <section className="hidden md:block">
        <div className="grid grid-cols-[1.2fr_1fr] items-center gap-8 overflow-hidden rounded-[32px] px-10 py-10 lg:px-14"
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
          <PetalFrame className="ml-auto aspect-square w-full max-w-[440px]">
            {home.banner_image ? (
              <Image src={home.banner_image} alt={home.banner_title} fill priority sizes="440px" className="object-cover" />
            ) : (
              <div className="grid h-full place-items-center bg-violet-500"><CdDisc spin className="w-3/4" /></div>
            )}
          </PetalFrame>
        </div>
      </section>

      {/* ---------- 6 LỰA CHỌN ---------- */}
      <section className="flex flex-1 items-center justify-center md:mt-10 md:flex-none">
        <ul className="grid w-full max-w-md grid-cols-2 gap-x-4 gap-y-8 md:max-w-none md:grid-cols-6">
          {options.map((o, i) => {
            const Badge = i % 2 === 0 ? FlowerBadge : StampBadge;
            return (
              <li key={i}>
                <Link href={o.href || "/"} className="group flex flex-col items-center text-center">
                  <Badge color={o.color} className="h-32 w-32 md:h-28 md:w-28">
                    {o.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.icon_url} alt="" className="h-14 w-14 object-contain md:h-12 md:w-12" />
                    ) : (
                      <ServiceIcon name={optionIcons[i]} className={`h-14 w-14 md:h-12 md:w-12 ${o.color === "lime" ? "text-ink-900" : "text-white"}`} />
                    )}
                  </Badge>
                  <span className="mt-3 text-sm font-bold uppercase leading-tight tracking-wide text-ink-900 sm:text-base">{o.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
