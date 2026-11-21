/* Trang Hướng dẫn làm file — dùng chung cho /huong-dan (có thanh điều hướng của web) và /xem/huong-dan (bản chia sẻ, chỉ 1 trang).
   Mục có ảnh → các thẻ đều nhau (ảnh trong khung cao cố định · tiêu đề · dòng phụ · nút), giống modal Template Canva.
   Nút link có icon trước chữ. Khối "tiện ích thiết kế" (admin bật / tắt), chọn gói CD → danh sách file cần chuẩn bị,
   thanh cố định ở cuối: "Nhắn tin Zalo" + "Đặt đơn". */
import Link from "next/link";
import { ArrowRight, ExternalLink, ImageIcon, MessageCircle, ShoppingBag } from "lucide-react";
import type { GuideLink, GuideSection } from "@/lib/types";
import type { GuideSettings } from "@/lib/guide";
import { RichText } from "@/components/site/RichText";
import { btnClass } from "@/components/ui/styles";
import { PackChecklist, type GuidePack } from "./PackChecklist";

const isCanva = (u: string) => /(^|\.)canva\.(com|link)\//i.test(u.replace(/^https?:\/\//, ""));

function LinkBtn({ l, className, canvaIcon }: { l: GuideLink; className?: string; canvaIcon?: string | null }) {
  const icon = l.icon || (isCanva(l.url) ? canvaIcon : null);
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon && <img src={icon} alt="" className="h-5 w-5 shrink-0 object-contain" />}
      <span>{l.label || (l.url.startsWith("/") ? l.url : "Mở link")}</span>
      {!icon && (l.url.startsWith("/") ? <ArrowRight size={16} /> : <ExternalLink size={16} />)}
    </>
  );
  return l.url.startsWith("/")
    ? <Link href={l.url} className={className ?? btnClass("secondary")}>{inner}</Link>
    : <a href={l.url} target="_blank" rel="noopener noreferrer" className={className ?? btnClass("secondary")}>{inner}</a>;
}
const gradient = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-[#00C4CC] to-[#7D2AE8] text-[14px] font-bold text-white shadow-sm transition-opacity hover:opacity-90";
const pink = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--c-primary)] text-[14px] font-bold text-white shadow-sm hover:bg-[var(--c-primary-hover)]";

export function GuideView({ sections, guide, zalo, packs, canvaIcon }: { sections: GuideSection[]; guide: GuideSettings; zalo: string; packs: GuidePack[]; canvaIcon: string | null }) {
  const imgIdx = sections.findIndex((s) => s.images.length > 0);
  return (
    <div className="pb-28">
      <h1 className="mx-auto max-w-4xl px-4 pb-6 pt-8 text-center text-[26px] font-bold uppercase tracking-[0.02em] text-[#18181b] sm:text-[30px]">Hướng dẫn làm file</h1>
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4">
        {packs.length > 0 && <PackChecklist packs={packs} />}
        {sections.map((s, i) => {
          // ảnh ↔ nút: ảnh có link riêng, hoặc số link = số ảnh thì ghép theo thứ tự
          const paired = s.images.length > 0 && !s.images.some((x) => x.link) && s.links.length === s.images.length;
          const cardLink = (j: number): GuideLink | null => { const im = s.images[j]; return im.link ? { url: im.link, label: im.link_label ?? "" } : paired ? s.links[j] : null; };
          const rest = paired ? [] : s.links;
          return (
            <div key={s.id} className="space-y-4">
              <section id={`muc-${s.id}`} className="scroll-mt-24 rounded-[14px] border border-[#e5e5e7] bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--c-secondary)] text-[13px] font-semibold text-[var(--c-primary)]">{i + 1}</span>
                  <h2 className="text-[18px] font-semibold">{s.title.replace(/^\d+\.\s*/, "")}</h2>
                </div>
                {s.body && <RichText text={s.body} className="mt-3 text-[15px] leading-relaxed text-[#3f3f46]" />}
                {s.images.length > 0 && (
                  <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {s.images.map((img, j) => {
                      const l = cardLink(j);
                      return (
                        <li key={j} className="flex flex-col rounded-[14px] border border-[#e5e5e7] p-3">
                          <div className="flex h-[200px] items-center justify-center overflow-hidden rounded-[12px] bg-[#f7f7f8] p-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {img.url ? <img src={img.url} alt={img.caption} className="h-full w-full object-contain object-center drop-shadow-[0_6px_14px_rgba(0,0,0,0.16)]" loading="lazy" /> : <ImageIcon size={28} className="text-[#a1a1aa]" />}
                          </div>
                          {img.caption && <p className="mt-3 text-[15px] font-semibold text-[#18181b]">{img.caption}</p>}
                          {img.sub && <p className="text-[13px] text-[#71717a]">{img.sub}</p>}
                          {l && <div className="mt-auto pt-3"><LinkBtn l={l} canvaIcon={canvaIcon} className={isCanva(l.url) ? gradient : pink} /></div>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {rest.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[#efeff1] pt-4">
                    {rest.map((l, j) => <LinkBtn key={j} l={l} canvaIcon={canvaIcon} />)}
                  </div>
                )}
              </section>
              {i === imgIdx && guide.show_tools && guide.tools.length > 0 && (
                <section className="rounded-[14px] border border-[#ffd1e6] bg-[#fff7fb] p-5">
                  <p className="text-[15px] font-medium text-[#18181b]">{guide.tools_title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{guide.tools.map((t) => <LinkBtn key={t.href} l={{ label: t.label, url: t.href }} />)}</div>
                </section>
              )}
            </div>
          );
        })}
        {!sections.length && <p className="py-12 text-center text-[#71717a]">Tiệm đang soạn hướng dẫn, bạn quay lại sau nhé!</p>}
      </div>
      {/* thanh cố định cuối trang */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {zalo
            ? <a href={zalo} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#0068ff] text-[15px] font-semibold text-white hover:bg-[#0057d6]"><MessageCircle size={18} /> Nhắn tin Zalo</a>
            : <span className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#e4e4e7] text-[15px] font-semibold text-[#a1a1aa]"><MessageCircle size={18} /> Nhắn tin Zalo</span>}
          {guide.order_enabled
            ? <Link href={guide.order_href} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--c-primary)] text-[15px] font-semibold text-white hover:bg-[var(--c-primary-hover)]"><ShoppingBag size={18} /> Đặt đơn</Link>
            : <button type="button" disabled title="Sắp ra mắt" className="inline-flex h-11 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-[10px] bg-[#fbcfe8] text-[15px] font-semibold text-white"><ShoppingBag size={18} /> Đặt đơn</button>}
        </div>
      </div>
    </div>
  );
}
