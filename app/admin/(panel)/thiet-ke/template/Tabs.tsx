import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

// Admin → Thiết kế → Quản lý template: các tab (mỗi tab 1 đường dẫn riêng)
export const TEMPLATE_TABS = [
  ["cd-template", "CD Template"], ["booklet-template", "Booklet Template"], ["cd-nang-cao", "CD nâng cao"],
  ["photostrip", "Khung Photostrip"], ["booklet-lyrics", "Booklet Lyrics"], ["canva", "Template Canva"], ["mockup", "Mockup"],
] as const;
export type TemplateTab = (typeof TEMPLATE_TABS)[number][0];

export function TemplateTabs({ tab, title = true }: { tab: TemplateTab; title?: boolean }) {
  return (
    <>
      {title && <PageHeader title="Quản lý template" />}
      <nav className="mb-6 flex max-w-full flex-wrap gap-0.5 rounded-[10px] border border-[#e5e5e7] bg-white p-1">
        {TEMPLATE_TABS.map(([id, label]) => (
          <Link key={id} href={`/admin/thiet-ke/template/${id}`}
            className={cx("rounded-[8px] px-3.5 py-1.5 text-[14px] font-medium", tab === id ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:text-[#18181b]")}>{label}</Link>
        ))}
      </nav>
    </>
  );
}
