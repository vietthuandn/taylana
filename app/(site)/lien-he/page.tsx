import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/SectionTitle";
import { FlowerBadge, StampBadge } from "@/components/ui/Shapes";

export const metadata = { title: "Liên hệ" };
export const revalidate = 60;

export default async function ContactPage() {
  const { contact } = await getSettings();
  const rows = [
    { label: "Zalo", value: contact.zalo, href: contact.zalo, color: "violet" as const },
    { label: "Shopee", value: contact.shopee, href: contact.shopee, color: "hot" as const },
    { label: "Facebook", value: contact.facebook, href: contact.facebook, color: "violet" as const },
    { label: "Số điện thoại", value: contact.phone, href: contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : "", color: "lime" as const },
    { label: "Địa chỉ", value: contact.address, href: "", color: "hot" as const },
    { label: "Giờ làm việc", value: contact.hours, href: "", color: "lime" as const },
  ].filter((r) => r.value);

  return (
    <>
      <PageHeader eyebrow="Taylana" title="Liên Hệ" subtitle={contact.note || undefined} />
      <div className="mx-auto max-w-3xl px-4">
        {rows.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((r, i) => {
              const Badge = i % 2 === 0 ? FlowerBadge : StampBadge;
              const inner = (
                <>
                  <Badge color={r.color} className="h-14 w-14 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-widest text-ink-500">{r.label}</span>
                    <span className="block break-words font-semibold text-ink-900">{r.value}</span>
                  </span>
                </>
              );
              return (
                <li key={r.label}>
                  {r.href ? (
                    <a href={r.href} target={r.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer"
                      className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">{inner}</a>
                  ) : (
                    <div className="card flex items-center gap-4 p-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-center">Tiệm sẽ cập nhật thông tin liên hệ sớm.</p>
        )}
      </div>
    </>
  );
}
