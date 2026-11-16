/* Mockup xem trước bản in: hộp CD, bìa sau, mặt đĩa, booklet.
   Vùng tô hồng gạch chéo = có thể bị cắt; nét đứt = vùng an toàn. */
import type { PrintSpec } from "@/lib/print";

type AreaProps = {
  spec: PrintSpec;
  src?: string | null;
  isPdf?: boolean;
  bg?: string; // màu nền phía sau (để "đục" lỗ đĩa và góc ngoài đĩa)
  guides?: boolean;
  placeholder?: string;
};

export function PrintArea({ spec, src, isPdf, bg = "var(--color-cream-50)", guides = true, placeholder }: AreaProps) {
  const { w, h, cut, safe } = spec;
  const id = `hatch-${spec.kind}`;
  const isDisc = spec.shape === "disc";
  const r = w / 2;

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${w} / ${h}` }}>
      {src && !isPdf ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(45deg,var(--color-cream-200)_0_8px,var(--color-cream-100)_8px_16px)] p-2 text-center">
          <span className="font-display text-sm text-ink-500">
            {isPdf ? "📄 File PDF\n(không xem trước được)" : (placeholder ?? spec.label)}
          </span>
        </div>
      )}

      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <pattern id={id} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="3" fill="rgb(255 95 162 / 0.5)" />
            <line x1="0" y1="0" x2="0" y2="3" stroke="rgb(255 255 255 / 0.7)" strokeWidth="1" />
          </pattern>
        </defs>

        {isDisc ? (
          <>
            {/* phần ngoài đĩa và lỗ giữa: che bằng màu nền */}
            <path fillRule="evenodd" fill={bg}
              d={`M0 0H${w}V${h}H0Z M${r} ${r - r}a${r} ${r} 0 1 0 0.001 0Z`} />
            {guides && (
              <>
                <path fillRule="evenodd" fill={`url(#${id})`}
                  d={`M${r} 0a${r} ${r} 0 1 0 0.001 0Z M${r} ${cut}a${r - cut} ${r - cut} 0 1 0 0.001 0Z`} />
                <circle cx={r} cy={r} r={spec.hub! / 2} fill={`url(#${id})`} />
                <circle cx={r} cy={r} r={r - safe} fill="none" stroke="#fff" strokeWidth="0.6" strokeDasharray="2 1.5" />
                <circle cx={r} cy={r} r={spec.hub! / 2 + 2} fill="none" stroke="#fff" strokeWidth="0.6" strokeDasharray="2 1.5" />
              </>
            )}
            <circle cx={r} cy={r} r={spec.hole! / 2} fill={bg} stroke="rgb(20 20 20 / 0.4)" strokeWidth="0.5" />
            <circle cx={r} cy={r} r={r - 0.3} fill="none" stroke="rgb(20 20 20 / 0.35)" strokeWidth="0.6" />
          </>
        ) : (
          guides && (
            <>
              <path fillRule="evenodd" fill={`url(#${id})`}
                d={`M0 0H${w}V${h}H0Z M${cut} ${cut}V${h - cut}H${w - cut}V${cut}Z`} />
              <rect x={safe} y={safe} width={w - safe * 2} height={h - safe * 2} fill="none"
                stroke="#fff" strokeWidth="0.6" strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" />
              {spec.spine && (
                <>
                  <rect x={0} y={0} width={spec.spine} height={h} fill="rgb(20 20 20 / 0.18)" />
                  <rect x={w - spec.spine} y={0} width={spec.spine} height={h} fill="rgb(20 20 20 / 0.18)" />
                  <line x1={spec.spine} y1={0} x2={spec.spine} y2={h} stroke="#fff" strokeWidth="0.5" strokeDasharray="1.5 1" />
                  <line x1={w - spec.spine} y1={0} x2={w - spec.spine} y2={h} stroke="#fff" strokeWidth="0.5" strokeDasharray="1.5 1" />
                </>
              )}
            </>
          )
        )}
      </svg>
    </div>
  );
}

// Hộp CD nhìn từ trước: khung nhựa trong + bản lề bên trái + ánh bóng
export function CaseFront(props: AreaProps) {
  return (
    <div className="relative rounded-md bg-gradient-to-br from-white to-cream-200 p-[5%] pl-[11%] shadow-[0_10px_25px_rgb(75_51_41/0.25)] ring-2 ring-ink-900/70">
      <div className="absolute inset-y-[3%] left-[2.5%] w-[5%] rounded-sm bg-[repeating-linear-gradient(0deg,#e8ddd0_0_4px,#f8f2ea_4px_8px)]" />
      <PrintArea {...props} />
      <div className="pointer-events-none absolute inset-0 rounded-md bg-[linear-gradient(120deg,rgb(255_255_255/0.45)_0%,transparent_35%,transparent_70%,rgb(255_255_255/0.25)_100%)]" />
    </div>
  );
}

// Bìa sau (khay đĩa): có 2 gáy gập ở 2 bên
export function CaseBack(props: AreaProps) {
  return (
    <div className="relative rounded-md bg-gradient-to-br from-white to-cream-200 p-[4%] shadow-[0_10px_25px_rgb(75_51_41/0.25)] ring-2 ring-ink-900/70">
      <PrintArea {...props} />
      <div className="pointer-events-none absolute inset-0 rounded-md bg-[linear-gradient(120deg,rgb(255_255_255/0.4)_0%,transparent_35%)]" />
    </div>
  );
}

export function Disc(props: AreaProps) {
  return (
    <div className="relative mx-auto w-full rounded-full shadow-[0_10px_25px_rgb(75_51_41/0.3)]">
      <PrintArea {...props} />
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgb(255_255_255/0.35)_40deg,transparent_80deg,transparent_180deg,rgb(255_255_255/0.3)_220deg,transparent_260deg)]" />
    </div>
  );
}

export function BookletPage({ pageNo, ...props }: AreaProps & { pageNo: number }) {
  return (
    <div className="relative bg-white p-[3%] shadow-[0_6px_14px_rgb(75_51_41/0.2)] ring-1 ring-ink-900/40">
      <PrintArea {...props} />
      {/* bóng nếp gấp bên trái */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[8%] bg-gradient-to-r from-ink-900/20 to-transparent" />
      <span className="absolute -top-2 left-2 rounded-full bg-lime-300 px-2 text-[10px] font-bold">
        {pageNo === 1 ? "Trang 1 · Bìa" : `Trang ${pageNo}`}
      </span>
    </div>
  );
}

export function GuideLegend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-600">
      <span className="flex items-center gap-1">
        <span className="h-3 w-5 rounded-sm bg-[repeating-linear-gradient(45deg,#ff5fa2_0_3px,#fff_3px_4px)]" /> Mép có thể bị cắt
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-5 rounded-sm border-2 border-dashed border-ink-500" /> Vùng an toàn (để chữ bên trong)
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-5 rounded-sm bg-ink-900/20" /> Gáy hộp (bìa sau)
      </span>
    </div>
  );
}
