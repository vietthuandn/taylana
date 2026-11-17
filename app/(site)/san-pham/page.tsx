import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { Review, ShowcaseItem } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader title="Sản phẩm & đánh giá" subtitle="Một vài chiếc CD tiệm đã thiết kế và thi công cùng khách." />
      <section className="mx-auto w-full max-w-6xl px-4">
        <Suspense>
          <ShowcaseGrid items={items} />
        </Suspense>
      </section>

      <section id="danh-gia" className="mx-auto mt-14 w-full max-w-6xl scroll-mt-24 px-4">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Đánh giá</h2>
            <p className="mt-0.5 text-[14px] text-[#71717a]">Khách nói gì về tiệm.</p>
          </div>
          {reviews.length > 0 && (
            <p className="text-[14px] text-[#71717a]"><span className="text-[20px] font-semibold text-[#18181b]">★ {avg.toFixed(1)}</span> · {reviews.length} đánh giá</p>
          )}
        </div>
        <ReviewList reviews={reviews} />
      </section>

      <section className="mx-auto mt-14 w-full max-w-2xl px-4 pb-12">
        <div className="mb-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Gửi đánh giá</h2>
          <p className="mt-0.5 text-[14px] text-[#71717a]">Đánh giá sẽ hiện lên sau khi tiệm duyệt.</p>
        </div>
        <ReviewForm />
      </section>
    </>
  );
}
