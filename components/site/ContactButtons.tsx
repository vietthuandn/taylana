import type { ContactSettings } from "@/lib/settings";

export function ContactButtons({ contact }: { contact: ContactSettings }) {
  const items = [
    { label: "Zalo", href: contact.zalo, cls: "bg-[#d8ecff]" },
    { label: "Shopee", href: contact.shopee, cls: "bg-[#ffe0d2]" },
    { label: "Facebook", href: contact.facebook, cls: "bg-[#dde4ff]" },
  ].filter((i) => i.href);

  if (!items.length && !contact.phone) {
    return <p className="text-cocoa-400">Tiệm sẽ cập nhật thông tin liên hệ sớm nhé!</p>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {items.map((i) => (
        <a key={i.label} href={i.href} target="_blank" rel="noopener noreferrer" className={`btn ${i.cls}`}>
          {i.label}
        </a>
      ))}
      {contact.phone && (
        <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="btn bg-matcha-200">
          ☎ {contact.phone}
        </a>
      )}
    </div>
  );
}
