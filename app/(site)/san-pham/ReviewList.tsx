import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/site/Stars";

const bgs = ["bg-cream-50", "bg-butter-100", "bg-matcha-100"];

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return <p className="text-center text-cocoa-500">Chưa có đánh giá nào — bạn là người đầu tiên nhé!</p>;
  return (
    <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {reviews.map((r, i) => (
        <li key={r.id} className={`pop-sm mb-4 break-inside-avoid rounded-3xl p-4 ${bgs[i % 3]}`}>
          {r.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image_url} alt="" loading="lazy" className="sticker mb-3 w-full rounded-lg" />
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-lg">{r.customer_name}</span>
            <Stars value={r.rating} />
          </div>
          {r.content && <p className="mt-1 whitespace-pre-line text-sm text-cocoa-600">{r.content}</p>}
          <p className="mt-2 text-xs text-cocoa-400">{formatDate(r.created_at, false)}</p>
        </li>
      ))}
    </ul>
  );
}
