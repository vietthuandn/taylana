import { publicClient } from "@/lib/supabase/public";
import type { PhotostripFrame } from "@/lib/templates";
import { PageTitle } from "@/components/site/PageTitle";
import { PhotostripLoader } from "./PhotostripLoader";

export const metadata = { title: "Làm Photostrip" };
export const revalidate = 60;

export default async function PhotostripPage() {
  const sb = publicClient();
  let frames: PhotostripFrame[] = [];
  if (sb) {
    const { data } = await sb.from("photostrip_frames").select("*").eq("is_active", true).order("sort_order").order("created_at");
    frames = data ?? [];
  }
  return (
    <>
      <PageTitle title="Làm Photostrip" subtitle="Chọn khung 3 hoặc 4 ảnh, thả ảnh vào, thêm chữ, ngày tháng và sticker — in khổ 2x6 inch ♡" />
      <PhotostripLoader frames={frames} />
    </>
  );
}
