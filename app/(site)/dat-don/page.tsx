import { redirect } from "next/navigation";
import { productOfOption } from "@/lib/catalog";
import { TileGrid } from "@/components/site/TileGrid";
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
  // giống Trang chủ / trang Thiết kế (Mẫu 1): ảnh + tên sản phẩm, không hiện giá
  return (
    <>
      <PageHeader title="Đặt đơn" />
      {products.length ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-6">
          <section className="flex justify-center pt-2 md:pt-4">
            <TileGrid items={products.map((p) => ({ id: p.id, title: p.name, href: `/san-pham/${p.slug}`, image_url: p.images[0] ?? null }))} />
          </section>
        </div>
      ) : <p className="py-16 text-center text-[14px] text-[#71717a]">Tiệm đang cập nhật sản phẩm, bạn quay lại sau nhé!</p>}
    </>
  );
}
