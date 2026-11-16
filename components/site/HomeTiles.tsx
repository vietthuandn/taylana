import Image from "next/image";
import Link from "next/link";
import { optionIcons, TEXT_COLORS, type HomeOption } from "@/lib/settings";
import { ServiceIcon } from "@/components/site/ServiceIcon";

const V = { top: "justify-start", middle: "justify-center", bottom: "justify-end" } as const;
const H = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" } as const;

// Tên menu: phần trong [ngoặc vuông] được tô tím nhạt (giống mẫu "[Sips]")
export function TileTitle({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <span style={{ color }}>
      {parts.map((p, i) => (p.startsWith("[") ? <span key={i} style={{ color: color === TEXT_COLORS.lilac ? TEXT_COLORS.brown : TEXT_COLORS.lilac }}>{p}</span> : p))}
    </span>
  );
}

// 1 ô menu: màu phẳng hoặc ảnh phủ kín, chữ đặt theo vị trí admin chọn
export function Tile({ o, index, preview = false }: { o: HomeOption; index: number; preview?: boolean }) {
  const color = TEXT_COLORS[o.text_color];
  // icon mặc định nằm phía đối diện với chữ
  const iconPos = `${o.text_v === "bottom" ? "top-[12%]" : "bottom-[12%]"} ${o.text_h === "left" ? "right-[12%]" : o.text_h === "right" ? "left-[12%]" : "left-1/2 -translate-x-1/2"}`;
  const body = (
    <>
      {o.image_url ? (
        <Image src={o.image_url} alt="" fill unoptimized={o.image_url.endsWith(".svg")} sizes="(min-width:768px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
      ) : (
        <span className={`pointer-events-none absolute w-[34%] transition duration-500 group-hover:-rotate-6 group-hover:scale-110 ${iconPos}`} style={{ color }} aria-hidden>
          <ServiceIcon name={optionIcons[index]} className="h-full w-full" />
        </span>
      )}
      <span className={`absolute inset-0 flex flex-col p-[9%] ${V[o.text_v]} ${H[o.text_h]}`}>
        <span className={`font-tile font-bold leading-[1.05] tracking-[-0.02em] ${preview ? "text-[17px]" : "text-[22px] sm:text-3xl lg:text-[38px]"}`}>
          <TileTitle text={o.title} color={color} />
        </span>
      </span>
    </>
  );
  const cls = "group relative block aspect-[4/5] overflow-hidden rounded-[10px] transition duration-300";
  if (preview) return <div className={cls} style={{ background: o.bg }}>{body}</div>;
  return (
    <Link href={o.href || "/"} className={`${cls} hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(59,21,16,.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3b1510]`}
      style={{ background: o.bg }}>
      {body}
    </Link>
  );
}

export function HomeTiles({ options }: { options: HomeOption[] }) {
  return (
    <ul className="grid w-full grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5">
      {options.map((o, i) => (
        <li key={i} className="animate-[rise_.6s_cubic-bezier(.2,.8,.2,1)_both]" style={{ animationDelay: `${i * 60}ms` }}>
          <Tile o={o} index={i} />
        </li>
      ))}
    </ul>
  );
}
