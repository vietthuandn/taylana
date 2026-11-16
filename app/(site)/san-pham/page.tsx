import { publicClient } from "@/lib/supabase/public";
import type { Review, ShowcaseItem } from "@/lib/types";
import { PageTitle } from "@/components/site/PageTitle";
import { Scallop } from "@/components/decor/Scallop";
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
      <PageTitle title="Sản phẩm của tiệm" subtitle="Một vài chiếc CD tiệm đã làm cùng các bạn ♡" />
      <section className="mx-auto max-w-5xl px-4">
        <ShowcaseGrid items={items} />
      </section>

      <section className="mt-16">
        <Scallop up color="var(--color-pink-100)" />
        <div className="bg-pink-100 px-4 py-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl">Khách nói gì về tiệm</h2>
            {reviews.length > 0 && (
              <p className="mt-1 text-center text-cocoa-500">
                ★ {avg.toFixed(1)} / 5 · {reviews.length} đánh giá
              </p>
            )}
            <div className="mt-6">
              <ReviewList reviews={reviews} />
            </div>
          </div>
        </div>
        <Scallop color="var(--color-pink-100)" />
      </section>

      <section className="mx-auto max-w-xl px-4 pt-12">
        <h2 className="mb-4 text-center text-3xl">Gửi đánh giá cho tiệm</h2>
        <ReviewForm />
      </section>
    </>
  );
}
