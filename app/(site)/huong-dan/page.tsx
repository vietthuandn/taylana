import Image from "next/image";
import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import type { GuideSection } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { RichText } from "@/components/site/RichText";
import { GalleryIcon } from "@/components/decor/Icons";

export const metadata = { title: "Hướng dẫn làm file" };
export const revalidate = 60;

const numberBg = ["bg-lime-500 text-ink-900", "bg-violet-500 text-white", "bg-hot-500 text-white"];

export default async function GuidePage() {
  const sb = publicClient();
  let sections: GuideSection[] = [];
  if (sb) {
    const { data } = await sb.from("guide_sections").select("*").eq("is_active", true).order("sort_order").order("created_at");
    sections = data ?? [];
  }

  const audioIdx = sections.findIndex((s) => /audio|nhạc/i.test(s.title));
  return (
    <>
      <PageHeader eyebrow="Trước khi gửi file in" title="Hướng dẫn làm file" subtitle="Chuẩn bị file đúng chuẩn để CD in ra thật sắc nét." />

      {sections.length > 1 && (
        <nav className="no-scrollbar mx-auto mb-8 flex max-w-6xl gap-2 overflow-x-auto px-4">
          {sections.map((s, i) => <a key={s.id} href={i === audioIdx ? "#audio" : `#muc-${s.id}`} className="chip shrink-0">{s.title}</a>)}
        </nav>
      )}

      <div className="mx-auto max-w-4xl space-y-6 px-4">
        {sections.map((s, i) => (
          <section key={s.id} id={i === audioIdx ? "audio" : `muc-${s.id}`} className="card scroll-mt-24 p-5 sm:p-8">
            <div className="flex items-start gap-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-2xl ${numberBg[i % 3]}`}>{i + 1}</span>
              <h2 className="pt-1 text-3xl sm:text-4xl">{s.title.replace(/^\d+\.\s*/, "")}</h2>
            </div>
            {s.body && <RichText text={s.body} className="mt-4 leading-relaxed" />}

            {s.images.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {s.images.map((img, j) => (
                  <figure key={j}>
                    {img.url ? (
                      <a href={img.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[16px] border-[3px] border-lime-500 bg-cream-50">
                        <Image src={img.url} alt={img.caption} width={480} height={480} sizes="(min-width:640px) 260px, 45vw" className="h-auto w-full" />
                      </a>
                    ) : (
                      <div className="grid aspect-square place-items-center rounded-[16px] border-[3px] border-dashed border-lime-500 bg-lime-100">
                        <GalleryIcon className="h-12 w-12 text-ink-900" />
                      </div>
                    )}
                    {img.caption && <figcaption className="mt-2 text-center text-sm font-bold uppercase tracking-wide text-ink-900">{img.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}

            {s.links.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {s.links.map((l, j) =>
                  l.url.startsWith("/") ? (
                    <Link key={j} href={l.url} className="btn">{l.label || l.url} →</Link>
                  ) : (
                    <a key={j} href={l.url} target="_blank" rel="noopener noreferrer" className="btn">{l.label || "Mở link"} ↗</a>
                  ),
                )}
              </div>
            )}
          </section>
        ))}
        {!sections.length && <p className="text-center">Tiệm đang soạn hướng dẫn, bạn quay lại sau nhé!</p>}
      </div>
    </>
  );
}
