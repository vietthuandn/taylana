import Image from "next/image";
import Link from "next/link";
import type { TileItem } from "@/lib/tileItems";

/* Lưới "ảnh + tên" (Trang chủ Mẫu 1, trang Thiết kế Mẫu 1): ảnh nguyên bản (không khung / nền / bo góc), tên đậm ngay dưới.
   Điện thoại 2 mục / hàng · máy tính ≤ 6 mục: 3 / hàng, > 6 mục: 4 / hàng · hàng cuối căn giữa.
   preview: bản thu nhỏ trong admin (chữ cỡ cố định, cột theo khung chứa). */
export function TileGrid({ items, preview = false }: { items: TileItem[]; preview?: boolean }) {
  const list = items.filter((x) => !x.hidden);
  const four = list.length > 6;
  const w = preview
    ? (four ? "w-[calc((100%-36px)/4)]" : "w-[calc((100%-24px)/3)]")
    : `w-[calc((100%-24px)/2)] ${four ? "md:w-[calc((100%-72px)/4)]" : "md:w-[calc((100%-48px)/3)]"}`;
  const box = preview ? "w-full" : `mx-auto w-[92vw] md:w-full ${four ? "md:max-w-[1040px]" : "md:max-w-[min(900px,calc((100dvh-var(--header-h)-170px)*1.45))]"}`;
  return (
    <ul className={`flex flex-wrap justify-center ${preview ? "gap-x-3 gap-y-2.5" : "gap-x-6 gap-y-5"} ${box}`}>
      {list.map((o, i) => (
        <li key={o.id} className={`min-w-0 [container-type:inline-size] ${w} ${preview ? "" : "animate-[rise_.6s_cubic-bezier(.2,.8,.2,1)_both]"}`} style={preview ? undefined : { animationDelay: `${i * 60}ms` }}>
          <Link href={o.href || "/"} scroll={!o.href.includes("?")} tabIndex={preview ? -1 : undefined}
            className={`flex flex-col items-center text-center outline-none focus-visible:ring-4 focus-visible:ring-[var(--c-primary)] ${preview ? "pointer-events-none" : ""}`}>
            {o.image_url && (
              // ảnh admin tải lên: hiện nguyên ảnh. Qua bộ tối ưu ảnh của Next (tự thu nhỏ đúng cỡ hiển thị + WebP/AVIF)
              // → cả ảnh cũ tải lên trước khi có nén vẫn nhẹ. SVG giữ nguyên.
              <Image src={o.image_url} alt="" width={600} height={600} priority={!preview && i < 6} unoptimized={/\.svg($|\?)/i.test(o.image_url)}
                sizes={preview ? "140px" : four ? "(min-width: 768px) 250px, 46vw" : "(min-width: 768px) 300px, 46vw"} className="block aspect-square h-auto w-full object-contain" />
            )}
            {/* cỡ chữ theo bề ngang ô (~11%, giống bản xem trước trong admin), tối đa 2 dòng — không bị cắt mất chữ */}
            <span className={`line-clamp-2 block w-full pt-[0.18em] font-tile font-bold leading-[1.3] tracking-[-0.01em] text-[var(--c-section-text)] ${o.image_url ? "-mt-[5%]" : ""}`}
              style={{ fontSize: preview ? 13 : "clamp(14px, 11cqw, 24px)" }}>{o.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
