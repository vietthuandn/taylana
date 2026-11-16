"use client";

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const btn = "grid h-9 w-9 place-items-center rounded-full text-lg font-bold text-ink-900 hover:bg-lime-500 disabled:opacity-30";
  return (
    <div className="inline-flex items-center rounded-full border-[1.5px] border-ink-900 bg-white p-0.5">
      <button type="button" aria-label="Giảm" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="w-8 text-center font-display text-lg text-ink-900">{value}</span>
      <button type="button" aria-label="Tăng" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}
