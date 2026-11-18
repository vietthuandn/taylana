import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/PageHeader";
import { Clock, ExternalLink, Facebook, MapPin, MessageCircle, Phone, ShoppingBag } from "lucide-react";

export const metadata = { title: "Liên hệ" };
export const revalidate = 60;

export default async function ContactPage() {
  const { contact } = await getSettings();
  const rows = [
    { icon: MessageCircle, label: "Zalo", value: contact.zalo, href: contact.zalo },
    { icon: ShoppingBag, label: "Shopee", value: contact.shopee, href: contact.shopee },
    { icon: Facebook, label: "Facebook", value: contact.facebook, href: contact.facebook },
    { icon: Phone, label: "Số điện thoại", value: contact.phone, href: contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : "" },
    { icon: MapPin, label: "Địa chỉ", value: contact.address, href: "" },
    { icon: Clock, label: "Giờ làm việc", value: contact.hours, href: "" },
  ].filter((r) => r.value);

  return (
    <>
      <PageHeader title="Liên hệ" />
      <div className="mx-auto w-full max-w-3xl px-4 pb-12">
        {rows.length ? (
          <ul className="divide-y divide-[#efeff1] overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
            {rows.map((r) => {
              const Icon = r.icon;
              const inner = (
                <>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#fff0f6] text-[#ff5fa2]"><Icon size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-[#71717a]">{r.label}</span>
                    <span className="block break-words text-[15px] font-medium text-[#18181b]">{r.value}</span>
                  </span>
                  {r.href && <ExternalLink size={16} className="shrink-0 text-[#a1a1aa]" />}
                </>
              );
              return (
                <li key={r.label}>
                  {r.href ? (
                    <a href={r.href} target={r.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#fafafa]">{inner}</a>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-12 text-center text-[#71717a]">Tiệm sẽ cập nhật thông tin liên hệ sớm.</p>
        )}
      </div>
    </>
  );
}
