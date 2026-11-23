import Link from "next/link";
import { loadAdminSettings } from "@/lib/adminSettings";
import { ShowcaseAdmin } from "../san-pham/ShowcaseAdmin";
import { ReviewsAdmin } from "../san-pham/ReviewsAdmin";
import { GuideAdmin } from "../huong-dan/GuideAdmin";
import { ContactForm } from "../lien-he/ContactForm";
import { AdminPage, PageHeader } from "@/components/admin/ui";

// Admin → Nội dung: gộp Gallery · Hướng dẫn · Liên hệ thành 3 tab (?tab=gallery | huong-dan | lien-he)
const TABS = [["gallery", "Gallery"], ["huong-dan", "Hướng dẫn"], ["lien-he", "Liên hệ"]] as const;
type Tab = (typeof TABS)[number][0];

export default async function ContentAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const q = (await searchParams).tab;
  const tab: Tab = TABS.some(([k]) => k === q) ? (q as Tab) : "gallery";
  const contact = tab === "lien-he" ? (await loadAdminSettings()).contact : null;
  return (
    <AdminPage>
      <PageHeader title="Nội dung" />
      <nav className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-[#e5e5e7]">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/admin/noi-dung?tab=${k}`} className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-[14px] font-medium ${tab === k ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-transparent text-[#52525b] hover:text-[#18181b]"}`}>{l}</Link>
        ))}
      </nav>
      {tab === "gallery" && <div className="space-y-8"><ShowcaseAdmin /><ReviewsAdmin /></div>}
      {tab === "huong-dan" && <GuideAdmin />}
      {tab === "lien-he" && contact && <ContactForm initial={contact} />}
    </AdminPage>
  );
}
