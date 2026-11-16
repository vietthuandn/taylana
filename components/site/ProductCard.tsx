import Image from "next/image";
import type { Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { CdDisc, WavyFrame } from "@/components/ui/Shapes";
import { PlusButton } from "@/components/ui/Button";

const bgs = ["bg-violet-100", "bg-lime-100", "bg-hot-100"];

// Thẻ gói sản phẩm: ảnh trong khung lượn sóng, tên in hoa, giá hồng đậm, nút "+"
export function ProductCard({ pkg, index = 0, big = false }: { pkg: Package; index?: number; big?: boolean }) {
  return (
    <article className={`card flex h-full flex-col ${big ? "p-5 sm:p-7" : "p-4"}`}>
      <WavyFrame shape="cloud" border={index % 2 ? "violet" : "lime"} className="aspect-square w-full">
        {pkg.image_url ? (
          <Image src={pkg.image_url} alt={pkg.name} fill sizes={big ? "(min-width:1024px) 480px, 100vw" : "(min-width:1024px) 240px, 50vw"} className="object-cover" />
        ) : (
          <div className={`grid h-full place-items-center ${bgs[index % 3]}`}><CdDisc className="w-1/2" /></div>
        )}
      </WavyFrame>
      {big ? (
        <div className="mt-4 flex flex-1 items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-3xl sm:text-4xl">{pkg.name}</h3>
            <p className="font-display text-3xl text-hot-500">{formatVND(pkg.price)}</p>
          </div>
          <PlusButton href={`/dat-don?goi=${pkg.id}`} label={`Đặt ${pkg.name}`} />
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col">
          <h3 className="flex-1 text-lg leading-tight sm:text-xl">{pkg.name}</h3>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="font-display text-lg text-hot-500 sm:text-xl">{formatVND(pkg.price)}</p>
            <PlusButton href={`/dat-don?goi=${pkg.id}`} label={`Đặt ${pkg.name}`} className="!h-9 !w-9 !text-xl" />
          </div>
        </div>
      )}
      {big && pkg.description && <p className="mt-2 text-sm">{pkg.description}</p>}
      {big && pkg.features.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {pkg.features.map((f) => <li key={f} className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-ink-900">{f}</li>)}
        </ul>
      )}
    </article>
  );
}
