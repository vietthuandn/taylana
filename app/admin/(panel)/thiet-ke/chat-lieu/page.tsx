import Link from "next/link";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { ScrapbookAdmin } from "../../scrapbook/ScrapbookAdmin";
import { CutoutAdmin } from "../../scrapbook/CutoutAdmin";
import { FrameAdmin } from "../../scrapbook/FrameAdmin";
import { WishAdmin } from "../../scrapbook/WishAdmin";

const TABS = [["sticker", "Sticker & trang trí"], ["khung", "Khung ảnh"], ["font", "Font chữ"], ["loi-chuc", "Lời chúc"]] as const;

// Admin → Thiết kế → Quản lý chất liệu
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "sticker";
  return (
    <AdminPage>
      <PageHeader title="Quản lý chất liệu" />
      <nav className="mb-6 inline-flex flex-wrap rounded-[10px] border border-[#e5e5e7] bg-white p-1">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/admin/thiet-ke/chat-lieu?tab=${id}`}
            className={cx("rounded-[8px] px-4 py-1.5 text-[14px] font-medium", tab === id ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:text-[#18181b]")}>{label}</Link>
        ))}
      </nav>
      {tab === "font" ? <CutoutAdmin /> : tab === "khung" ? <FrameAdmin /> : tab === "loi-chuc" ? <WishAdmin /> : <ScrapbookAdmin />}
    </AdminPage>
  );
}
