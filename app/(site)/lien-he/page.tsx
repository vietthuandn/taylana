import { PageHeader } from "@/components/ui/PageHeader";
import { TileGrid } from "@/components/site/TileGrid";
import { getContactItems } from "@/lib/homeData";

export const metadata = { title: "Liên hệ" };
export const revalidate = 60;

// Liên hệ: lưới ảnh + tên giống Trang chủ / Thiết kế (Admin → Giao diện → Liên hệ). Mục không có link = chỉ hiện thông tin (vd. Giờ làm việc).
export default async function ContactPage() {
  const items = await getContactItems();
  return (
    <>
      <PageHeader title="Liên hệ" />
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-6">
        <section className="flex justify-center pt-2 md:pt-4"><TileGrid items={items} showDesc /></section>
      </div>
    </>
  );
}
