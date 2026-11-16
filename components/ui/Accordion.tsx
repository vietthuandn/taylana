// Mục mở rộng: thanh bo tròn, icon "+" xanh chanh; đang mở → nền tím chữ trắng
export function Accordion({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <details key={it.q} className="group overflow-hidden rounded-[28px] border-[1.5px] border-ink-900 bg-white open:border-violet-500 open:bg-violet-500">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-ink-900 group-open:text-white [&::-webkit-details-marker]:hidden">
            {it.q}
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-500 text-xl font-bold text-ink-900 transition group-open:rotate-45">+</span>
          </summary>
          <div className="px-5 pb-5 text-white/90">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
