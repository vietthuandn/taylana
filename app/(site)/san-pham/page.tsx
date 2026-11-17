import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { Review, ShowcaseItem } from "@/lib/types";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ShowcaseGrid } from "./ShowcaseGrid";
import { ReviewList } from "./ReviewList";
import { ReviewForm } from "./ReviewForm";

export const metadata = { title: "Sản phẩm & Đánh giá" };
export const revalidate = 60;

export default async function ProductsPage() {
  const sb = publicClient();
  let items: ShowcaseItem[] = [];
  let reviews: Review[] = [];
  if (sb) {
    const [s, r] = await Promise.all([
      sb.from("showcase_items").select("*").eq("is_active", true).order("sort_order").order("created_at", { ascending: false }),
      sb.from("reviews").select("*").eq("is_approved", true).order("created_at", { ascending: false }).limit(60),
    ]);
    items = s.data ?? [];
    reviews = r.data ?? [];
  }
  const avg = reviews.length ? reviews.reduce((t, r) => t + r.rating, 0) / reviews.length : 0;

  return (
    <>
      <PageHeader eyebrow="Tiệm đã làm" title="Sản phẩm" subtitle="Một vài chiếc CD tiệm đã thiết kế và thi công cùng khách." />
      <section className="mx-auto max-w-6xl px-4">
        <Suspense>
          <ShowcaseGrid items={items} />
        </Suspense>
      </section>

      <section id="danh-gia" className="mx-auto mt-20 max-w-6xl scroll-mt-24 px-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <SectionTitle eyebrow="Khách nói gì" title="Đánh giá" tone="hot" />
          {reviews.length > 0 && <Stat value={`★${avg.toFixed(1)}`} label={`từ ${reviews.length} đánh giá`} />}
        </div>
        <ReviewList reviews={reviews} />
      </section>

      <section className="mx-auto mt-20 max-w-2xl px-4">
        <SectionTitle title="Gửi đánh giá" align="center" className="mb-6" subtitle="Đánh giá sẽ hiện lên sau khi tiệm duyệt." />
        <ReviewForm />
      </section>
    </>
  );
}
