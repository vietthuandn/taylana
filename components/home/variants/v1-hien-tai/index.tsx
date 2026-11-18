import Image from "next/image";
import Link from "next/link";
import { isDark } from "@/lib/settings";
import type { HomeVariantProps } from "@/lib/homeData";
import { HomeTiles } from "@/components/site/HomeTiles";
import { Button } from "@/components/ui/Button";
import { CdDisc, PetalFrame } from "@/components/ui/Shapes";

// Mẫu 1 · Hiện tại — giao diện trang chủ gốc (giữ nguyên). Dữ liệu: Admin → Trang chủ.
export default function HomeV1({ home, options }: HomeVariantProps) {
  const dark = isDark(home.banner_bg);

  return (
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

      {/* ---------- 6 NÚT LỚN (lưới bento) ---------- */}
      <section className={`flex flex-1 items-center justify-center ${home.banner_enabled ? "md:mt-6 md:flex-none" : ""}`}>
        <div className="w-full">
          <HomeTiles options={options} />
        </div>
      </section>
    </div>
  );
}
