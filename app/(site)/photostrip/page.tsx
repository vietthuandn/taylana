import { redirect } from "next/navigation";
import { FEATURE_PHOTOSTRIP } from "@/lib/features";
import { publicClient } from "@/lib/supabase/public";
import type { PhotostripFrame } from "@/lib/templates";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhotostripLoader } from "./PhotostripLoader";

export const metadata = { title: "Làm Photostrip" };
export const revalidate = 60;

export default async function PhotostripPage() {
  if (!FEATURE_PHOTOSTRIP) redirect("/");
  const sb = publicClient();
  let frames: PhotostripFrame[] = [];
  if (sb) {
    const { data } = await sb.from("photostrip_frames").select("*").eq("is_active", true).order("sort_order").order("created_at");
    frames = data ?? [];
  }
  return (
    <>
      <PageHeader eyebrow="2 x 6 inch" title="Làm photostrip" />
      <PhotostripLoader frames={frames} />
    </>
  );
}
