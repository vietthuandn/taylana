import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import type { GuideSection } from "@/lib/types";
import { PageTitle } from "@/components/site/PageTitle";
import { RichText } from "@/components/site/RichText";
import { GalleryIcon, NoteIcon } from "@/components/decor/Icons";

export const metadata = { title: "Hướng dẫn làm file" };
export const revalidate = 60;

const bgs = ["bg-cream-50", "bg-matcha-100", "bg-pink-100", "bg-butter-100"];
const tilts = ["-rotate-2", "rotate-2", "-rotate-1", "rotate-1"];

export default async function GuidePage() {
  const sb = publicClient();
  let sections: GuideSection[] = [];
  if (sb) {
    const { data } = await sb.from("guide_sections").select("*").eq("is_active", true).order("sort_order").order("created_at");
    sections = data ?? [];
  }

  return (
    <>
      <PageTitle title="Hướng dẫn làm file" subtitle="Chuẩn bị file đúng chuẩn để CD in ra thật sắc nét nha ♡" />

      {sections.length > 1 && (
        <nav className="mx-auto mb-8 flex max-w-3xl flex-wrap justify-center gap-2 px-4">
          {sections.map((s) => (
            <a key={s.id} href={`#muc-${s.id}`} className="pop-sm rounded-full bg-cream-50 px-4 py-2 text-sm hover:bg-pink-100">{s.title}</a>
          ))}
        </nav>
      )}

      <div className="mx-auto max-w-3xl space-y-10 px-4">
        {sections.map((s, i) => (
          <section key={s.id} id={`muc-${s.id}`} className={`tape pop relative scroll-mt-28 rounded-[2rem] px-5 pb-6 pt-8 sm:px-8 ${bgs[i % bgs.length]}`}>
            <h2 className="flex items-center gap-2 text-2xl sm:text-3xl">
              <NoteIcon className="h-7 w-7 shrink-0 text-pink-400" />
              {s.title}
            </h2>
            {s.body && <RichText text={s.body} className="mt-3 leading-relaxed text-cocoa-600" />}

            {s.images.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3">
                {s.images.map((img, j) => (
                  <figure key={j} className={`${tilts[j % 4]}`}>
                    {img.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a href={img.url} target="_blank" rel="noreferrer"><img src={img.url} alt={img.caption} loading="lazy" className="sticker w-full rounded-sm bg-white" /></a>
                    ) : (
                      <div className="sticker grid aspect-square place-items-center rounded-sm bg-cream-200">
                        <GalleryIcon className="h-12 w-12 text-cocoa-400" />
                      </div>
                    )}
                    {img.caption && <figcaption className="mt-2 text-center font-display text-sm">{img.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}

            {s.links.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {s.links.map((l, j) =>
                  l.url.startsWith("/") ? (
                    <Link key={j} href={l.url} className="btn bg-pink-200 !text-base">{l.label || l.url} →</Link>
                  ) : (
                    <a key={j} href={l.url} target="_blank" rel="noopener noreferrer" className="btn bg-pink-200 !text-base">{l.label || "Mở link"} ↗</a>
                  ),
                )}
              </div>
            )}
          </section>
        ))}
        {!sections.length && <p className="text-center text-cocoa-500">Tiệm đang soạn hướng dẫn, bạn quay lại sau nhé!</p>}
      </div>
    </>
  );
}
