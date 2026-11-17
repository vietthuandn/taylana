import Image from "next/image";
import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import type { GuideSection } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { RichText } from "@/components/site/RichText";
import { ArrowRight, ExternalLink, ImageIcon } from "lucide-react";
import { btnClass } from "@/components/ui/styles";

export const metadata = { title: "Hướng dẫn làm file" };
export const revalidate = 60;

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
      <PageHeader title="Hướng dẫn làm file" subtitle="Chuẩn bị file đúng chuẩn để CD in ra thật sắc nét." />

      {sections.length > 1 && (
        <nav className="no-scrollbar mx-auto mb-6 flex max-w-6xl gap-2 overflow-x-auto px-4">
          {sections.map((s, i) => (
            <a key={s.id} href={i === audioIdx ? "#audio" : `#muc-${s.id}`}
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-[#e5e5e7] bg-white px-3 text-[13px] font-medium text-[#3f3f46] hover:border-[#ff5fa2] hover:text-[#ff5fa2]">{s.title}</a>
          ))}
        </nav>
      )}

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-12">
        {sections.map((s, i) => (
          <section key={s.id} id={i === audioIdx ? "audio" : `muc-${s.id}`} className="scroll-mt-24 rounded-[12px] border border-[#e5e5e7] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff0f6] text-[13px] font-semibold text-[#ff5fa2]">{i + 1}</span>
              <h2 className="text-[18px] font-semibold">{s.title.replace(/^\d+\.\s*/, "")}</h2>
            </div>
            {s.body && <RichText text={s.body} className="mt-3 text-[15px] leading-relaxed text-[#3f3f46]" />}

            {s.images.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {s.images.map((img, j) => (
                  <figure key={j}>
                    {img.url ? (
                      <a href={img.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[10px] border border-[#e5e5e7] bg-[#fafafa]">
                        <Image src={img.url} alt={img.caption} width={480} height={480} sizes="(min-width:640px) 260px, 45vw" className="h-auto w-full" />
                      </a>
                    ) : (
                      <div className="grid aspect-square place-items-center rounded-[10px] border border-dashed border-[#d4d4d8] bg-[#fafafa]">
                        <ImageIcon size={24} className="text-[#a1a1aa]" />
                      </div>
                    )}
                    {img.caption && <figcaption className="mt-2 text-center text-[13px] text-[#71717a]">{img.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}

            {s.links.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[#efeff1] pt-4">
                {s.links.map((l, j) =>
                  l.url.startsWith("/") ? (
                    <Link key={j} href={l.url} className={btnClass("secondary")}>{l.label || l.url} <ArrowRight size={16} /></Link>
                  ) : (
                    <a key={j} href={l.url} target="_blank" rel="noopener noreferrer" className={btnClass("secondary")}>{l.label || "Mở link"} <ExternalLink size={16} /></a>
                  ),
                )}
              </div>
            )}
          </section>
        ))}
        {!sections.length && <p className="py-12 text-center text-[#71717a]">Tiệm đang soạn hướng dẫn, bạn quay lại sau nhé!</p>}
      </div>
    </>
  );
}
