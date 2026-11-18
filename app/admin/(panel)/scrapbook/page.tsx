import Link from "next/link";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { ScrapbookAdmin } from "./ScrapbookAdmin";
import { CutoutAdmin } from "./CutoutAdmin";
import { TemplatePreview } from "./mau/TemplatePreview";

const TABS = [["chat-lieu", "Chất liệu"], ["font", "Font cut-out"], ["mau", "Mẫu"]] as const;

// Admin → Chất liệu Scrapbook: 3 tab (Chất liệu · Font cut-out · Mẫu)
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "chat-lieu";
  return (
    <AdminPage>
      <PageHeader title="Chất liệu Scrapbook" />
      <nav className="mb-6 inline-flex rounded-[10px] border border-[#e5e5e7] bg-white p-1">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/admin/scrapbook?tab=${id}`}
            className={cx("rounded-[8px] px-4 py-1.5 text-[14px] font-medium", tab === id ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:text-[#18181b]")}>{label}</Link>
        ))}
      </nav>
      {tab === "font" ? <CutoutAdmin /> : tab === "mau" ? <TemplatePreview /> : <ScrapbookAdmin />}
    </AdminPage>
  );
}
