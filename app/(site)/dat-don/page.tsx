import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Disc3 } from "lucide-react";
import { formatVND } from "@/lib/format";
import { fromPrice, productOfOption } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalogLoad";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Đặt đơn" };

// Trang danh sách sản phẩm. Link cũ /dat-don?goi=<id> (hoặc ?sp=&chon=) → trang chi tiết sản phẩm, chọn sẵn đúng lựa chọn.
export default async function ProductListPage({ searchParams }: { searchParams: Promise<{ goi?: string; sp?: string; chon?: string; sl?: string }> }) {
  const q = await searchParams;
  const products = (await getCatalog()).filter((p) => p.is_active);
  if (q.goi || q.sp || q.chon) {
    const p = products.find((x) => x.slug === q.sp) ?? productOfOption(products, q.goi ?? q.chon?.split(",")[0] ?? "");
    if (p) {
      const keep = new URLSearchParams();
      if (q.goi) keep.set("goi", q.goi);
      if (q.chon) keep.set("chon", q.chon);
      if (q.sl) keep.set("sl", q.sl);
      redirect(`/san-pham/${p.slug}${keep.size ? `?${keep}` : ""}`);
    }
  }
  return (
    <>
      <PageHeader title="Đặt đơn" subtitle="Chọn sản phẩm bạn muốn đặt." />
      <div className="mx-auto w-full max-w-[1200px] px-4 lg:px-6">
        {products.length ? (
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/san-pham/${p.slug}`} className="block overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white transition-colors hover:border-[#ff5fa2]">
                  <div className="relative aspect-square bg-[#f4f4f5]">
                    {p.images[0] ? <Image src={p.images[0]} alt={p.name} fill sizes="(min-width:1024px) 280px, 50vw" className="object-cover" />
                      : <Disc3 size={64} strokeWidth={1} className="absolute inset-0 m-auto text-[#d4d4d8]" />}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-[40px] text-[14px] leading-5 text-[#18181b]">{p.name}</p>
                    <p className="mt-1 text-[16px] font-semibold tabular-nums text-[#ff5fa2]">Từ {formatVND(fromPrice(p))}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="py-16 text-center text-[14px] text-[#71717a]">Tiệm đang cập nhật sản phẩm, bạn quay lại sau nhé!</p>}
      </div>
    </>
  );
}
