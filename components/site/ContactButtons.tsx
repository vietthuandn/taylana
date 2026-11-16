import type { ContactSettings } from "@/lib/settings";

export function ContactButtons({ contact, className = "" }: { contact: ContactSettings; className?: string }) {
  const items = [
    { label: "Zalo", href: contact.zalo },
    { label: "Shopee", href: contact.shopee },
    { label: "Facebook", href: contact.facebook },
  ].filter((i) => i.href);
  if (!items.length && !contact.phone) return <p className="text-sm text-ink-500">Tiệm sẽ cập nhật thông tin liên hệ sớm.</p>;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((i) => (
        <a key={i.label} href={i.href} target="_blank" rel="noopener noreferrer" className="btn btn-sm">{i.label}</a>
      ))}
      {contact.phone && (
        <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="btn btn-ghost btn-sm">☎ {contact.phone}</a>
      )}
    </div>
  );
}
