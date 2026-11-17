import { Suspense } from "react";
import { publicClient } from "@/lib/supabase/public";
import type { ShowcaseItem } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Gallery } from "./Gallery";

export const metadata = { title: "Về chúng tôi" };
export const revalidate = 60;

// Trang Về chúng tôi: gallery ảnh sản phẩm tiệm đã làm (Admin → Gallery)
export default async function AboutPage() {
  const sb = publicClient();
  let items: ShowcaseItem[] = [];
  if (sb) {
    const { data } = await sb.from("showcase_items").select("*").eq("is_active", true).order("sort_order").order("created_at", { ascending: false });
    items = data ?? [];
  }
  return (
    <>
      <PageHeader title="Về chúng tôi" subtitle="Những chiếc CD tiệm đã thiết kế và thi công cùng khách." />
      <div className="mx-auto w-full max-w-6xl px-4">
        <Suspense><Gallery items={items} /></Suspense>
      </div>
    </>
  );
}
