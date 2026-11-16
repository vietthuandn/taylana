import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { services } from "@/lib/services";
import { faq } from "@/lib/faq";
import { publicClient } from "@/lib/supabase/public";
import type { Package, Review, ShowcaseItem } from "@/lib/types";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { ProductCard } from "@/components/site/ProductCard";
import { Stars } from "@/components/site/Stars";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Accordion } from "@/components/ui/Accordion";
import { Stat } from "@/components/ui/Stat";
import { CdDisc, FlowerBadge, Sparkle, WavyFrame } from "@/components/ui/Shapes";

// Lấy lại nội dung mới nhất từ database tối đa mỗi 60 giây.
export const revalidate = 60;

export default async function HomePage() {
  const { home } = await getSettings();
  const sb = publicClient();
  let packages: Package[] = [];
  let reviews: Review[] = [];
  let hero: ShowcaseItem | null = null;
  let rating = { avg: 0, count: 0 };
  if (sb) {
    const [p, r, s, all] = await Promise.all([
      sb.from("packages").select("*").eq("is_active", true).order("sort_order").limit(5),
      sb.from("reviews").select("*").eq("is_approved", true).order("created_at", { ascending: false }).limit(3),
      sb.from("showcase_items").select("*").eq("is_active", true).order("sort_order").limit(1),
      sb.from("reviews").select("rating").eq("is_approved", true).limit(1000),
    ]);
    packages = p.data ?? [];
    reviews = r.data ?? [];
    hero = s.data?.[0] ?? null;
    const ratings = (all.data ?? []).map((x) => x.rating as number);
    if (ratings.length) rating = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
  }
  const [big, ...small] = packages;

  return (
    <>
      {/* ---------- 1. HERO ---------- */}
      <section className="px-4 pt-5 sm:pt-8">
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[32px] bg-lime-500 px-6 py-10 sm:px-10 sm:py-14 md:grid-cols-[1.25fr_1fr]">
          <Sparkle color="white" className="absolute right-[44%] top-8 hidden h-8 w-8 animate-twinkle md:block" />
          <Sparkle color="ink" className="absolute bottom-10 left-[46%] hidden h-5 w-5 animate-twinkle md:block" />
          <div className="relative">
            {home.banner_note && <span className="eyebrow mb-4 bg-ink-900 text-white">{home.banner_note}</span>}
            <h1 className="text-[44px] sm:text-6xl lg:text-[80px]">{home.banner_title}</h1>
            <p className="mt-4 max-w-md text-base text-ink-700 sm:text-lg">{home.banner_subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href="/dat-don">Đặt đơn ngay →</Button>
              <Button href="/custom-cd" variant="ghost">Tự thiết kế CD</Button>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <WavyFrame shape="flower" border="violet" className="aspect-square w-full">
              {hero ? (
                <Image src={hero.image_url} alt={hero.title || "Sản phẩm của Taylana"} fill priority sizes="(min-width:768px) 380px, 90vw" className="object-cover" />
              ) : (
                <div className="grid h-full place-items-center bg-violet-500"><CdDisc spin className="w-3/4" /></div>
              )}
            </WavyFrame>
            <CdDisc spin className="absolute -bottom-4 -left-4 w-24 sm:w-28" />
            <Sparkle className="absolute -right-2 top-2 h-10 w-10 animate-twinkle" />
          </div>
        </div>
      </section>

      {/* ---------- 2. 6 DỊCH VỤ ---------- */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <ul className="grid grid-cols-3 gap-x-3 gap-y-8 lg:grid-cols-6">
          {services.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="group flex flex-col items-center text-center">
                <FlowerBadge color={s.color} className="h-24 w-24 sm:h-28 sm:w-28">
                  <ServiceIcon name={s.icon} className={`h-10 w-10 sm:h-12 sm:w-12 ${s.color === "lime" ? "text-ink-900" : "text-white"}`} />
                </FlowerBadge>
                <span className="mt-3 text-sm font-bold uppercase leading-tight tracking-wide text-ink-900 sm:text-base">{s.title}</span>
                <span className="mt-1 hidden text-xs text-ink-500 sm:block">{s.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- 3. SẢN PHẨM NỔI BẬT ---------- */}
      {big && (
        <section className="mx-auto max-w-6xl px-4 pt-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <SectionTitle eyebrow="Gói được chọn nhiều" title="Sản phẩm nổi bật" tone="violet" />
            <Button href="/dat-don" variant="ghost">Xem tất cả gói →</Button>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ProductCard pkg={big} big />
            {small.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:gap-5">
                {small.map((p, i) => <ProductCard key={p.id} pkg={p} index={i + 1} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- 4. VÌ SAO CHỌN TAYLANA ---------- */}
      <section className="px-4 pt-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink-900 px-6 py-12 sm:px-10">
          <CdDisc className="absolute -right-16 -top-16 w-56 opacity-90 sm:w-72" spin />
          <h2 className="relative max-w-xl text-4xl text-white sm:text-5xl lg:text-[56px]">Vì sao chọn Taylana?</h2>
          <div className="relative mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
            <Stat dark value="300" label="DPI — file in sắc nét, đúng khổ" />
            <Stat dark value="3" label="Phần tự thiết kế: bìa trước, bìa sau, mặt đĩa" />
            <Stat dark value={rating.count ? `★${rating.avg.toFixed(1)}` : "100%"} label={rating.count ? `Điểm từ ${rating.count} đánh giá` : "Làm thủ công từng đơn"} />
            <Stat dark value="24/7" label="Đặt đơn & nộp file online" />
          </div>
        </div>
      </section>

      {/* ---------- 5. ĐÁNH GIÁ ---------- */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <SectionTitle eyebrow="Khách nói gì" title="Đánh giá" tone="hot" />
            <Button href="/san-pham#danh-gia" variant="ghost">Xem thêm →</Button>
          </div>
          <ul className="grid gap-5 md:grid-cols-3">
            {reviews.map((r) => (
              <li key={r.id} className="card flex flex-col p-6">
                <Stars value={r.rating} className="text-lg" />
                <p className="mt-3 flex-1 text-ink-700">“{r.content}”</p>
                <p className="mt-4 font-display text-xl uppercase text-ink-900">{r.customer_name}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- 6. HỎI ĐÁP ---------- */}
      <section id="hoi-dap" className="mx-auto grid max-w-6xl scroll-mt-24 gap-8 px-4 pt-20 lg:grid-cols-[1fr_1.4fr]">
        <SectionTitle eyebrow="Hỏi đáp" title="Câu hỏi thường gặp" tone="lime"
          subtitle="Chưa thấy câu trả lời? Nhắn tiệm qua Zalo ở cuối trang nhé." />
        <Accordion items={faq.map((f) => ({ q: f.q, a: <p>{f.a}</p> }))} />
      </section>
    </>
  );
}
