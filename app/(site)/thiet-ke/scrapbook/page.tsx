import { getTypePackages } from "@/lib/catalogLoad";
import { getMockupData } from "@/lib/mockup/load";
import { getScrapbookData } from "@/lib/scrapbook/load";
import { ScrapbookLoader } from "./ScrapbookLoader";

export const metadata = { title: "CD Scrapbook" };
export const revalidate = 60;

// gói "CD + Hộp" (chọn sẵn khi bấm "Đặt in CD này")
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

export default async function ScrapbookPage() {
  const [data, packages, mock] = await Promise.all([getScrapbookData(), getTypePackages(), getMockupData()]);
  const box = packages.find((p) => /^cd ?\+ ?hộp/.test(norm(p.name)));
  return <ScrapbookLoader assets={data.assets} settings={data.settings} fonts={data.fonts} glyphs={data.glyphs} frames={data.frames} frameSets={data.frameSets} stickerCfg={data.stickerCfg} backgrounds={mock.backgrounds} boxPackageId={box?.id ?? null} />;
}
