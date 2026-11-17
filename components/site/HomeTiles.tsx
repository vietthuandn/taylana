import Link from "next/link";
import { optionIcons, TEXT_COLORS, type HomeOption } from "@/lib/settings";
import { ServiceIcon } from "@/components/site/ServiceIcon";


// ô nền trắng thì có viền xám mảnh
const border = (bg: string) => (/^#?f{6}$/i.test(bg.trim()) ? { boxShadow: "inset 0 0 0 1px #e5e5e7" } : {});

// Tên menu: phần trong [ngoặc vuông] được tô tím nhạt (giống mẫu "[Sips]")
export function TileTitle({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <span style={{ color }}>
      {parts.map((p, i) => (p.startsWith("[") ? <span key={i} style={{ color: color === TEXT_COLORS.ink ? "#ff5fa2" : color === TEXT_COLORS.lilac ? TEXT_COLORS.brown : TEXT_COLORS.lilac }}>{p}</span> : p))}
    </span>
  );
}

// 1 ô menu: vuông, icon chính giữa (~40% chiều rộng), tên ngay dưới icon
export function Tile({ o, index, preview = false }: { o: HomeOption; index: number; preview?: boolean }) {
  const color = TEXT_COLORS[o.text_color];
  const body = (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-[7%] p-[8%] text-center">
      <span className="relative block aspect-square w-[40%] shrink-0" style={{ color }}>
        {o.image_url ? (
          // icon riêng admin upload: giữ đúng tỉ lệ, không cắt
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.image_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <ServiceIcon name={optionIcons[index]} className="h-full w-full" />
        )}
      </span>
      <span className={`font-tile font-bold leading-[1.1] tracking-[-0.02em] ${preview ? "text-[13px]" : "text-base sm:text-xl lg:text-2xl"}`}>
        <TileTitle text={o.title} color={color} />
      </span>
    </span>
  );
  const cls = "relative block aspect-square overflow-hidden rounded-[16px] transition duration-300";
  if (preview) return <div className={cls} style={{ background: o.bg, ...border(o.bg) }}>{body}</div>;
  return (
    <Link href={o.href || "/"} className={`${cls} md:hover:-translate-y-1 md:hover:shadow-[0_14px_30px_rgba(0,0,0,.08)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff5fa2]`}
      style={{ background: o.bg, ...border(o.bg) }}>
      {body}
    </Link>
  );
}

export function HomeTiles({ options }: { options: HomeOption[] }) {
  return (
    <ul className="mx-auto grid w-full max-w-[900px] grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
      {options.map((o, i) => (
        <li key={i} className="animate-[rise_.6s_cubic-bezier(.2,.8,.2,1)_both]" style={{ animationDelay: `${i * 60}ms` }}>
          <Tile o={o} index={i} />
        </li>
      ))}
    </ul>
  );
}
