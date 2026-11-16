import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { services } from "@/lib/services";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { ContactButtons } from "@/components/site/ContactButtons";
import { CdIcon, FlowerIcon, HeartIcon, NoteIcon, SparkleIcon, StarIcon } from "@/components/decor/Icons";
import { Scallop } from "@/components/decor/Scallop";

// Lấy lại nội dung banner/liên hệ mới nhất từ database tối đa mỗi 60 giây.
export const revalidate = 60;

const tilts = ["-rotate-1", "rotate-1", "rotate-[0.6deg]", "-rotate-[0.8deg]", "rotate-1", "-rotate-1"];

export default async function HomePage() {
  const { home, contact } = await getSettings();

  return (
    <>
      {/* ---------- BANNER ---------- */}
      <section className="px-4 pt-6">
        <div className="pop stitch relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-pink-100 px-6 py-10 sm:px-10 sm:py-14">
          {/* hoạ tiết bay lơ lửng */}
          <NoteIcon className="absolute left-5 top-5 h-8 w-8 text-cocoa-400 animate-float" />
          <SparkleIcon className="absolute right-[42%] top-6 h-5 w-5 text-pink-400 animate-wiggle" />
          <StarIcon className="absolute bottom-6 left-[46%] hidden h-7 w-7 text-butter-200 animate-wiggle sm:block" />
          <FlowerIcon className="absolute -bottom-3 -left-3 h-16 w-16 text-matcha-300" />

          <div className="relative grid items-center gap-8 sm:grid-cols-[1.4fr_1fr]">
            <div className="text-center sm:text-left">
              {home.banner_note && (
                <span className="pop-sm mb-4 inline-block -rotate-2 rounded-full bg-butter-100 px-4 py-1 font-display text-sm">
                  {home.banner_note}
                </span>
              )}
              <h1 className="text-4xl sm:text-5xl">{home.banner_title}</h1>
              <p className="mt-4 text-base text-cocoa-500 sm:text-lg">{home.banner_subtitle}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
                <Link href="/dat-don" className="btn bg-pink-300">Đặt đơn ngay ♡</Link>
                <Link href="/san-pham" className="btn bg-cream-50">Xem sản phẩm</Link>
              </div>
            </div>

            {/* minh hoạ: đĩa CD + hộp */}
            <div className="relative mx-auto h-48 w-48 sm:h-64 sm:w-64" aria-hidden>
              <div className="sticker absolute left-0 top-4 h-36 w-36 rotate-[-8deg] rounded-md bg-matcha-200 sm:h-48 sm:w-48">
                <div className="flex h-full flex-col items-start gap-1 p-3">
                  <span className="font-display text-lg leading-none">my CD</span>
                  <HeartIcon className="h-8 w-8 text-pink-300" />
                </div>
              </div>
              <CdIcon className="absolute bottom-0 right-0 h-36 w-36 animate-spin-slow drop-shadow-md sm:h-44 sm:w-44" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 6 DỊCH VỤ ---------- */}
      <section className="mx-auto max-w-5xl px-4 pt-12">
        <h2 className="mb-6 text-center text-3xl">
          Bạn muốn làm gì hôm nay? <SparkleIcon className="inline h-6 w-6 text-pink-400" />
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
          {services.map((s, i) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className={`pop stitch group flex h-full flex-col items-center rounded-[2rem] ${s.color} ${tilts[i]} px-3 pb-5 pt-6 text-center transition hover:-translate-y-1 hover:rotate-0`}
              >
                <span className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-cream-50 pop-sm transition group-hover:scale-110 sm:h-20 sm:w-20">
                  <ServiceIcon name={s.icon} className="h-10 w-10 text-cocoa-700 sm:h-12 sm:w-12" />
                </span>
                <span className="font-display text-lg leading-tight sm:text-2xl">{s.title}</span>
                <span className="mt-1 text-xs text-cocoa-500 sm:text-sm">{s.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- LIÊN HỆ ---------- */}
      <section id="lien-he" className="mx-auto max-w-3xl px-4 pt-14">
        <div className="relative">
          <Scallop color="var(--color-butter-100)" hole="var(--color-cream-100)" up />
          <div className="bg-butter-100 px-6 py-8 text-center">
            <h2 className="text-3xl">Liên hệ với tiệm</h2>
            {contact.note && <p className="mx-auto mt-2 max-w-md text-cocoa-500">{contact.note}</p>}
            <div className="mt-5">
              <ContactButtons contact={contact} />
            </div>
            {contact.hours && <p className="mt-4 text-sm text-cocoa-400">Giờ làm việc: {contact.hours}</p>}
          </div>
          <Scallop color="var(--color-butter-100)" hole="var(--color-cream-100)" />
        </div>
      </section>
    </>
  );
}
