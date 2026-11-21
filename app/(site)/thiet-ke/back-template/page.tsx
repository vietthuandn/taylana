import { getMockupData } from "@/lib/mockup/load";
import { getLibrary, getScrapbookData } from "@/lib/scrapbook/load";
import { BackLoader } from "./BackLoader";

export const metadata = { title: "Back cover Template" };
export const revalidate = 60;

// Back cover Template: mẫu bìa sau 15 × 11,7 cm (Admin → Quản lý template → Back cover Template)
export default async function Page() {
  const [data, mock, lib] = await Promise.all([getScrapbookData(), getMockupData(), getLibrary(["back"], "back")]);
  return <BackLoader kind="back" assets={data.assets} assetGroups={data.groups} library={lib} fonts={data.fonts} glyphs={data.glyphs} frames={data.frames} frameSets={data.frameSets} topics={data.topics} wishes={data.wishes} backgrounds={mock.backgrounds} boxPackageId={null} />;
}
