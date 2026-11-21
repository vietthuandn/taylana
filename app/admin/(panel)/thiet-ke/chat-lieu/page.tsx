import { AdminPage, PageHeader } from "@/components/admin/ui";
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { ScrapbookAdmin } from "../../scrapbook/ScrapbookAdmin";
import { CutoutAdmin } from "../../scrapbook/CutoutAdmin";
import { FrameAdmin } from "../../scrapbook/FrameAdmin";
import { WishAdmin } from "../../scrapbook/WishAdmin";
import { GoogleFontsAdmin } from "../../scrapbook/GoogleFontsAdmin";

const TABS = [["sticker", "Sticker & trang trí"], ["khung", "Khung ảnh"], ["font", "Font chữ"], ["loi-chuc", "Lời chúc"]] as const;

// Admin → Thiết kế → Quản lý chất liệu
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "sticker";
  return (
    <AdminPage>
      <PageHeader title="Quản lý chất liệu" />
      <div className="mb-6"><ResponsiveTabs value={tab} tabs={TABS.map(([id, label]) => ({ id, label, href: `/admin/thiet-ke/chat-lieu?tab=${id}` }))} /></div>
      {tab === "font" ? <div className="space-y-6"><GoogleFontsAdmin /><CutoutAdmin /></div> : tab === "khung" ? <FrameAdmin /> : tab === "loi-chuc" ? <WishAdmin /> : <ScrapbookAdmin />}
    </AdminPage>
  );
}
