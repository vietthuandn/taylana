import Image from "next/image";
import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/site/Stars";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return <p>Chưa có đánh giá nào — bạn là người đầu tiên nhé!</p>;
  return (
    <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3">
      {reviews.map((r) => (
        <li key={r.id} className="card mb-5 break-inside-avoid p-5">
          {r.image_url && (
            <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-[14px]">
              <Image src={r.image_url} alt="" fill sizes="(min-width:1024px) 360px, 100vw" className="object-cover" />
            </div>
          )}
          <Stars value={r.rating} className="text-lg" />
          {r.content && <p className="mt-2 whitespace-pre-line text-ink-700">“{r.content}”</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-display text-xl uppercase text-ink-900">{r.customer_name}</span>
            <span className="text-xs text-ink-500">{formatDate(r.created_at, false)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
