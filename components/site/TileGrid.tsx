import Image from "next/image";
import Link from "next/link";
import type { TileItem } from "@/lib/tileItems";

/* Lưới "ảnh + tên" (Trang chủ Mẫu 1, trang Thiết kế Mẫu 1): ảnh nguyên bản (không khung / nền / bo góc), tên đậm ngay dưới.
   Điện thoại 2 mục / hàng · máy tính ≤ 6 mục: 3 / hàng, > 6 mục: 4 / hàng · hàng cuối căn giữa.
   preview: bản thu nhỏ trong admin (chữ cỡ cố định, cột theo khung chứa). */
export function TileGrid({ items, preview = false, showDesc = false }: { items: TileItem[]; preview?: boolean; showDesc?: boolean }) {
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
          <Box href={o.href} preview={preview}>
            {o.image_url && (
              // ảnh admin tải lên: hiện nguyên ảnh. Qua bộ tối ưu ảnh của Next (tự thu nhỏ đúng cỡ hiển thị + WebP/AVIF)
              // → cả ảnh cũ tải lên trước khi có nén vẫn nhẹ. SVG giữ nguyên.
              // Khung cố định tỉ lệ 1400 × 1150 (đúng cỡ ảnh icon PNG nền trong suốt). Phía sau là 1 nền bo góc 1308 × 1048, căn giữa,
              // màu theo Theme (--c-tile-bg) → đổi màu nền ở Theme, không phải sửa từng ảnh. Tỉ lệ giữ nguyên ở mọi cỡ màn hình.
              <span className="relative block aspect-[1400/1150] w-full">
                <span aria-hidden className="absolute left-1/2 top-1/2 h-[91.13%] w-[93.43%] -translate-x-1/2 -translate-y-1/2 rounded-[6%/7.3%] bg-[var(--c-tile-bg)]" />
                <Image src={o.image_url} alt="" width={700} height={575} priority={!preview && i < 6} unoptimized={/\.svg($|\?)/i.test(o.image_url)}
                  sizes={preview ? "140px" : four ? "(min-width: 768px) 250px, 46vw" : "(min-width: 768px) 300px, 46vw"} className="relative block h-full w-full object-contain" />
              </span>
            )}
            {/* cỡ chữ theo bề ngang ô (~11%, giống bản xem trước trong admin), tối đa 2 dòng — không bị cắt mất chữ */}
            <span className={`line-clamp-2 block w-full pt-[0.18em] font-tile font-bold leading-[1.3] tracking-[-0.01em] text-[var(--c-section-text)] ${o.image_url ? "mt-1" : ""}`}
              style={{ fontSize: preview ? 13 : "clamp(14px, 11cqw, 24px)" }}>{o.title}</span>
            {showDesc && o.desc && <span className="mt-0.5 block w-full whitespace-pre-line text-[#52525b]" style={{ fontSize: preview ? 11 : "clamp(12px, 7cqw, 16px)" }}>{o.desc}</span>}
          </Box>
        </li>
      ))}
    </ul>
  );
}

/** ô mục: có link → Link (link ngoài http mở tab mới, tel: / mailto: mở thẳng) · không có link → chỉ hiện thông tin */
function Box({ href, preview, children }: { href: string; preview: boolean; children: React.ReactNode }) {
  const cls = `flex flex-col items-center text-center outline-none focus-visible:ring-4 focus-visible:ring-[var(--c-primary)] ${preview ? "pointer-events-none" : ""}`;
  if (!href) return <div className={cls}>{children}</div>;
  if (/^(https?:|tel:|mailto:)/i.test(href))
    return <a href={href} className={cls} tabIndex={preview ? -1 : undefined} {...(/^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a>;
  return <Link href={href} scroll={!href.includes("?")} tabIndex={preview ? -1 : undefined} className={cls}>{children}</Link>;
}
