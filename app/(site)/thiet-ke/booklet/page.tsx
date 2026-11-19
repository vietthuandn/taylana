import { Suspense } from "react";
import { getTypePackages } from "@/lib/catalogLoad";
import { getMockupData } from "@/lib/mockup/load";
import { getScrapbookData } from "@/lib/scrapbook/load";
import { BookletScrapLoader } from "./BookletScrapLoader";

export const metadata = { title: "Booklet Template" };
export const revalidate = 60;

// gói "Combo + Booklet N trang" theo số trang (nút "Đặt in booklet này" chọn sẵn đúng gói)
export default async function Page() {
  const [data, packages, mock] = await Promise.all([getScrapbookData(), getTypePackages(), getMockupData()]);
  const packIds: Record<number, string> = {};
  for (const p of packages) { const n = p.front_pages ?? 0; if (n >= 4 && !packIds[n]) packIds[n] = p.id; }
  return (
    <Suspense>
      <BookletScrapLoader assets={data.assets} settings={data.settings} customs={data.customs} fonts={data.fonts} glyphs={data.glyphs} frames={data.frames} frameSets={data.frameSets} stickerCfg={data.stickerCfgBooklet}
        topics={data.topics} wishes={data.wishes} backgrounds={mock.backgrounds} packIds={packIds} />
    </Suspense>
  );
}
