import { Suspense } from "react";
import { getTypePackages } from "@/lib/catalogLoad";
import { getMockupData } from "@/lib/mockup/load";
import { getLibrary, getScrapbookData } from "@/lib/scrapbook/load";
import { BookletScrapLoader } from "./BookletScrapLoader";

export const metadata = { title: "Booklet Template" };
export const revalidate = 60;

// gói "Combo + Booklet N trang" theo số trang (nút "Đặt in booklet này" chọn sẵn đúng gói)
export default async function Page() {
  const [data, packages, mock, lib] = await Promise.all([getScrapbookData(), getTypePackages(), getMockupData(), getLibrary(["booklet_single", "booklet_spread"], true)]);
  const packIds: Record<number, string> = {};
  for (const p of packages) { const n = p.front_pages ?? 0; if (n >= 2 && !packIds[n]) packIds[n] = p.id; }
  return (
    <Suspense>
      <BookletScrapLoader assets={data.assets} library={lib} fonts={data.fonts} glyphs={data.glyphs} frames={data.frames} frameSets={data.frameSets}
        topics={data.topics} wishes={data.wishes} backgrounds={mock.backgrounds} packIds={packIds} />
    </Suspense>
  );
}
