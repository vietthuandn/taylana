import Image from "next/image";
import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/site/Stars";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return <p className="text-[#71717a]">Chưa có đánh giá nào — bạn là người đầu tiên nhé!</p>;
  return (
    <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {reviews.map((r) => (
        <li key={r.id} className="mb-4 break-inside-avoid rounded-[12px] border border-[#e5e5e7] bg-white p-5">
          {r.image_url && (
            <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-[8px]">
              <Image src={r.image_url} alt="" fill sizes="(min-width:1024px) 360px, 100vw" className="object-cover" />
            </div>
          )}
          <Stars value={r.rating} className="text-[15px]" />
          {r.content && <p className="mt-2 whitespace-pre-line text-[14px] text-[#3f3f46]">“{r.content}”</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium text-[#18181b]">{r.customer_name}</span>
            <span className="text-[12px] text-[#71717a]">{formatDate(r.created_at, false)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
